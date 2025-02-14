'use strict';


// TODO FINISH THIS.

const process = require('process');
const fs = require('fs');
const assert = require('assert');

//const csv = require('csv');
const { parse } = require("csv-parse");
//const _ = require('lodash'); // mostly for _.cloneDeep(...)

const db = require('better-sqlite3')('db/foobar.db', { fileMustExist: true });
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

fs.createReadStream('test/btc.csv').pipe(parse({delimiter: ',', from_line: 2}))
.on('data', function(csv_row) {
  let q = `
    INSERT INTO "pool" ("crypto_symbol", "bip32_path", "address", "from", "inserted_at") VALUES (
      ?, ?, ?, ?, datetime());
  `;

  runSync(q, ['BTC', csv_row[0], csv_row[1], "wallet1"]);
})
//.on('error', function(error) { console.log(error.message); })
.on('finish', function() {
  runSync('COMMIT TRANSACTION;');
  console.log('\n\nAll done.');
});