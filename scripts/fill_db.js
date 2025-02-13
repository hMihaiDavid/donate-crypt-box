'use strict';

const process = require('process');
const fs = require('fs');
const assert = require('assert');

//const csv = require('csv');
const { parse } = require("csv-parse");
//const _ = require('lodash'); // mostly for _.cloneDeep(...)

const db = require('better-sqlite3')('foobar.db', {});
db.pragma('journal_mode = WAL');

function runSync(str, data) {
  console.log(str);
  const query = db.prepare(str);
  let res;
  if (typeof(data) !== 'undefined')
    res = query.run(data);
  else
    res = query.run();

  console.log(res, '\n');
  return res;
}


// MAIN

console.log(process.argv);

// if anything throws and/or the program exits befor the commit transaction at th end, everything will be rolled back.
runSync('BEGIN TRANSACTION;');
//run('DROP TABLE *;'); // XXX for testing.

let rv;

// this leaves the default rowid integer col as fast primary key.
// see https://www.sqlite.org/rowidtable.html
let q = `
CREATE TABLE IF NOT EXISTS "pool" (
  "crypto_symbol"	TEXT NOT NULL,
  "bip32_path" TEXT,
  "address"	TEXT NOT NULL,
  "inserted_at_datetime_utc" TEXT NOT NULL,
  "from" TEXT,
  "j"	TEXT NOT NULL DEFAULT '{}',
  UNIQUE("crypto_symbol", "address")
);
`;
rv = runSync(q);

fs.createReadStream('../test/btc.csv').pipe(parse({delimiter: ',', from_line: 2}))
.on('data', function(csv_row) {
  q = `
    INSERT INTO "pool" ("crypto_symbol", "bip32_path", "address", "from", "inserted_at_datetime_utc") VALUES (
      ?, ?, ?, ?, datetime());
  `;

  runSync(q, ['BTC', csv_row[0], csv_row[1], "wallet"]);
})
//.on('error', function(error) { console.log(error.message); })
.on('finish', function() {
  runSync('COMMIT TRANSACTION;');
  console.log('\n\nAll done.');
});