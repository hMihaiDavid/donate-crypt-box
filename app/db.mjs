import Database from 'better-sqlite3';
import assert from 'assert';
import _ from 'lodash';
import { LEASE_MAX_AGE_SECS } from './config.mjs';

let sqlite = null;

export async function beginTransaction(req) {
    assert(req);
    sqlite.prepare('BEGIN TRANSACTION;').run();
    req.session.txActive = true;
}

export async function commitTransaction(req) {
    assert(req);
    assert(req.session.txActive);
    sqlite.prepare('COMMIT TRANSACTION;').run();
    req.session.txActive = false;
}

export async function rollbackTransaction(req) {
    assert(req.session.txActive);
    sqlite.prepare('ROLLBACK TRANSACTION;').run();
    req.session.txActive = false;
}

// Note: with sqlite, right now this does not need to be async since sqlite apis are synchronous.
// TODO Long queries might block main event loop too much, so we might wanna use worker thread poool as documented here:
// https://github.com/WiseLibs/better-sqlite3/blob/master/docs/threads.md
export function init() {
    assert(sqlite === null);
    sqlite = new Database(process.env.SQLITE3_DB_PATH || './db/foobar.db');
    sqlite.pragma('journal_mode = WAL');

    // Note: on sqlite, there's an implicit integer primary key called rowid, it is by default indexed (sort of), see
    // https://www.sqlite.org/rowidtable.html
    let q = `
    CREATE TABLE IF NOT EXISTS "pool" (
      "crypto_symbol" TEXT NOT NULL,
      "bip32_path" TEXT,
      "address"	TEXT NOT NULL,
      "inserted_at" TEXT NOT NULL,
      "soft_deleted" INTEGER NOT NULL DEFAULT 0,
      "last_deleted_at" TEXT,
      "from" TEXT,
      "j"	TEXT NOT NULL DEFAULT '{}',
      UNIQUE("crypto_symbol", "address")
    );
    CREATE TABLE IF NOT EXISTS "leases" (
      "pool_rowid" INTEGER NOT NULL,
      "ip" TEXT NOT NULL,
      "user_agent" TEXT,
      "leased_at" TEXT NOT NULL,
      "soft_deleted" INTEGER NOT NULL DEFAULT 0,
      "last_deleted_at" TEXT,
      "j"	TEXT NOT NULL DEFAULT '{}'
    );`;

    // TODO
    // INDICES AND FOREIGN KEY CONSTRAINTS.
    return sqlite.exec(q);
}

export function getLeases({ ip }) {
    assert(typeof(ip) === 'string' && ip.trim().length > 0);
    let q = `
    SELECT
      p.rowid AS pool_rowid, p.crypto_symbol, p.address
    FROM
      leases l
    INNER JOIN
      pool p ON p.rowid = l.pool_rowid
    WHERE
      p.soft_deleted = 0
    AND
      l.soft_deleted = 0
    AND
      l.ip = @ip
    ;`;

    return sqlite.prepare(q).all({ ip });
}

export function getAllCryptoSymbols() {
    let q = `
    SELECT DISTINCT
      p.crypto_symbol
    FROM
      pool p
    WHERE
      p.soft_deleted = 0
    ;`;

    return sqlite.prepare(q).pluck().all();
}

export function getFreshLeases({ limit = 1, cryptoSymbol }) {
    assert(limit >= 1);
    assert(typeof(cryptoSymbol) === 'string' && cryptoSymbol.trim().length > 0);

    let q = `
    SELECT
      p.rowid as pool_rowid, p.crypto_symbol, p.address, 1 as fresh
    FROM
      pool p
    WHERE
      p.soft_deleted = 0
    AND
      p.crypto_symbol = @cryptoSymbol
    AND
      p.rowid NOT IN (
        SELECT
          l.pool_rowid
        FROM
          leases l
      )
    ORDER BY p.rowid ASC
    LIMIT @limit
    ;`;

    const freshLeases = sqlite.prepare(q).all({ limit, cryptoSymbol });
    if (freshLeases.length >= limit) { return freshLeases; }
    //limit = limit + 3;
    
    // not enough fresh (ie. unleased) addresses in db, need to reuse.
    // ask for reused leases, then merge with previous ones.
    q = `
    SELECT
      p.rowid as pool_rowid, p.crypto_symbol, p.address, 0 as fresh
    FROM
      pool p
    WHERE
      p.soft_deleted = 0
    AND
      p.crypto_symbol = @cryptoSymbol
    AND
      p.rowid IN (
        SELECT
          l.pool_rowid
        FROM
          leases l
      )
    ORDER BY p.rowid ASC
    LIMIT @limit
    ;`;

    const dirtyLeases = sqlite.prepare(q).all({ limit: limit - freshLeases.length, cryptoSymbol });

    // merge results
    return _.concat(freshLeases, dirtyLeases);
}

export function destroyExpiredLeases({ ip, maxAgeSecs = LEASE_MAX_AGE_SECS } = {}) {
  assert(_.isInteger(maxAgeSecs) && maxAgeSecs >= 0);
  
  let qIp = '';
  const bindParams = {};
  if (ip !== undefined) {
    assert(typeof(ip) === 'string' && ip.trim().length > 0);
    qIp += ' AND ip = @ip';
    bindParams.ip = ip;
  }

  // TODO USE A GENERATED COLUMN FOR UNIX EPOCH
  // https://www.sqlite.org/gencol.html
  let q = `
  UPDATE leases
  SET
    soft_deleted = 1,
    last_deleted_at = datetime('now')
  WHERE
    unixepoch('now') - unixepoch((
                        SELECT ll.leased_at
                        FROM   leases AS ll
                        WHERE  ll.soft_deleted = 0
                        AND    ll.rowid = rowid )) > @maxAgeSecs
  ${qIp}
  ;`;
  bindParams.maxAgeSecs = maxAgeSecs;

  return sqlite.prepare(q).run(bindParams);
}

export function insertLeases({ cryptoSymbol, ip, userAgent, leases }) {
  assert(typeof(cryptoSymbol) === 'string' && cryptoSymbol.trim().length > 0);
  assert(typeof(ip) === 'string' && ip.trim().length > 0);
  assert(userAgent === undefined || (typeof(userAgent) === 'string' && userAgent.trim().length > 0));
  
  let q = `
  INSERT INTO leases (pool_rowid, ip, user_agent, leased_at)
  VALUES (?, ?, ?, datetime('now'))
  ;`;
  const query = sqlite.prepare(q);
  
  // TODO PUT A FOREIGN KEY CONSTRAINT WHEN CREATING TABLE
  const rv = [];
  _.forEach(leases, (lease) => {
    rv.push(query.run([lease.pool_rowid, ip, userAgent || null]));
  });

  return rv;
}