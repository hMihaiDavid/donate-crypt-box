import Database from 'better-sqlite3';
import assert from 'assert';
import _ from 'lodash';

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
      "inserted_at_datetime_utc" TEXT NOT NULL,
      "from" TEXT,
      "j"	TEXT NOT NULL DEFAULT '{}',
      UNIQUE("crypto_symbol", "address")
    );
    CREATE TABLE IF NOT EXISTS "leases" (
      "pool_rowid" INTEGER NOT NULL,
      "ip" TEXT NOT NULL,
      "xff_ip" TEXT,
      "user_agent" TEXT,
      "leased_at_datetime_utc" TEXT NOT NULL,
      "j"	TEXT NOT NULL DEFAULT '{}'
    );
    `;
    return sqlite.exec(q);
}

// TODO change name to getLeasesForIp and do group by having and order_by_random() to pick just one from each coin 
// TODO after so much random() queries might be slow, defer them to thread pool.
export function getAllLeaseSetsForIp({ip, limit = 1}) {
    assert(limit >= 1);
    let q = `
    SELECT
      p.crypto_symbol, p.address
    FROM
      leases l
    INNER JOIN
      pool p ON p.rowid = l.pool_rowid
    WHERE
      l.ip = @ip
    LIMIT @limit
    ;
    `;

    return sqlite.prepare(q).all({ ip, limit });
}

export function getAllCryptoSymbols() {
    let q = `
    SELECT DISTINCT
      p.crypto_symbol
    FROM
      pool p
    ;
    `;

    return sqlite.prepare(q).pluck().all();
}

export function getNewLeaseSet({ limit = 1, cryptoSymbol }) {
    assert(limit >= 1);
    assert(typeof(cryptoSymbol) === 'string');

    
    let q = `
    SELECT
      p.crypto_symbol, p.address, 1 as fresh
    FROM
      pool p
    WHERE
      p.crypto_symbol = @cryptoSymbol
    AND
      p.rowid NOT IN (
        SELECT
          l.pool_rowid
        FROM
          leases l
      )
    ORDER BY RANDOM()
    LIMIT @limit
    ;
    `;

    // TODO optimize the order by rand() here and below.
    // see https://stackoverflow.com/a/24591696/3537530

    const freshLeases = sqlite.prepare(q).all({ limit, cryptoSymbol });
    console.log('freshLeases', freshLeases);
    if (freshLeases.length >= limit) { return freshLeases; }
    //limit = limit + 3;
    
    // not enough fresh (ie. unleased) addresses in db, need to reuse.
    // ask for reused leases, then merge with previous ones.
    q = `
    SELECT
      p.crypto_symbol, p.address, 0 as fresh
    FROM
      pool p
    WHERE
      p.crypto_symbol = @cryptoSymbol
    AND
      p.rowid IN (
        SELECT
          l.pool_rowid
        FROM
          leases l
      )
    ORDER BY RANDOM()
    LIMIT @limit
    ;
    `;

    const dirtyLeases = sqlite.prepare(q).all({ limit: limit - freshLeases.length, cryptoSymbol });
    console.log('dirtyLeases', dirtyLeases);

    // merge results
    return _.concat(freshLeases, dirtyLeases);
    
}