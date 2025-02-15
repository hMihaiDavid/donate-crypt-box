import assert from 'assert';
import _ from 'lodash';

import * as db from"./db.mjs";
import { foldListInPlace, getRemoteIp, hashCode, projectList, projectListInPlace } from "./util.mjs";
import { GIVE_FULL_LEASE_SET, LEASE_MAX_AGE_SECS, LEASE_SET_SIZE, MAX_AGE_SECS } from './config.mjs';

// turns [{crypto_symbol: 'XXX', a: A ...}, ...]
// into  {XXX: [{crypto_symbol: 'XXX', a: A ...}, ...], YYY: ...}
// easier to grok for templates.
// function foldLeaseSet(leases) {
//   const rv = {};
//   _.forEach(leases, (lease) => {
//     rv[lease.crypto_symbol] = rv[lease.crypto_symbol] || [];
//     rv[lease.crypto_symbol].push(lease);
//   });

//   return rv;
// }

function leaseSetPickOneInPlace({ leaseSet, ip, userAgent }) {
  assert(typeof(leaseSet) === 'object'); // quick check it is folded.
  _.forEach(leaseSet, (leases, cryptoSymbol) => {
    if (leases.length <= 0) { return; } // skip

    const timeKey = Math.floor(Date.now()/(1000*(MAX_AGE_SECS||1)));
    const key = `salty123_${cryptoSymbol||''}_${ip||''}_${userAgent||''}_${timeKey}_`;
    const idx = hashCode(key) % leases.length;

    const picked = leases[idx]; 

    leaseSet[cryptoSymbol] = [picked];
  });
}

export function mw_handle_get_donate(req, res, next) {
  const ip = getRemoteIp(req).trim();
  const userAgent = req.headers['user-agent'] || null;
  if (!ip) throw new Error();
  
  db.beginTransaction(req);

  db.destroyExpiredLeases({ ip });
  let leaseSet = db.getLeases({ filter: { ip } });

  if (leaseSet.length === 0) {
    // First time for this ip, or previous leases expired.
    // For each coin, get fresh leases and also insert them in db.

    const cryptoSymbols = db.getAllCryptoSymbols();
    leaseSet = [];
    _.forEach(cryptoSymbols, (cryptoSymbol) => {
      const newLeasesForSymbol = db.getFreshLeases({ limit: LEASE_SET_SIZE, cryptoSymbol });
      db.insertLeases({ cryptoSymbol, ip, userAgent, leases: newLeasesForSymbol });

      leaseSet.push(newLeasesForSymbol);
    });

    leaseSet = _.flatten(leaseSet);
  }

  db.commitTransaction(req);
  
  // XXX rename
  projectListInPlace(leaseSet, ['pool_rowid.address', 'pool_rowid.crypto_symbol']);

  if (!GIVE_FULL_LEASE_SET) {
    //leaseSetPickOneInPlace({ leaseSet, ip, userAgent });
  }

  res.data.leaseSet = leaseSet;
  next();
}