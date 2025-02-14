import assert from 'assert';
import _ from 'lodash';

import * as db from"./db.mjs";
import { getRemoteIp } from "./util.mjs";
import { LEASE_MAX_AGE_SECS, LEASE_SET_SIZE } from './config.mjs';

// turns [{crypto_symbol: 'XXX', a: A ...}, ...]
// into  {XXX: [{crypto_symbol: 'XXX', a: A ...}, ...], YYY: ...}
// easier to grok for templates.
function foldLeaseSet(leases) {
  const rv = {};
  _.forEach(leases, (lease) => {
    rv[lease.crypto_symbol] = rv[lease.crypto_symbol] || [];
    rv[lease.crypto_symbol].push(lease);
  });

  return rv;
}

export function mw_handle_get_donate(req, res, next) {
  const ip = getRemoteIp(req);
  const userAgent = req.headers['user-agent'] || null;
  
  db.beginTransaction(req);
  
  db.destroyExpiredLeases({ ip });
  
  let leaseSet = db.getLeases({ ip });
  if (leaseSet.length > 0) {
    db.commitTransaction(req);
    res.data.leaseSet = foldLeaseSet(leaseSet);
    return next();
  }

  // first time call or previous leases expired, get new ones for this ip.

  const cryptoSymbols = db.getAllCryptoSymbols();

  leaseSet = {};
  _.forEach(cryptoSymbols, (cryptoSymbol) => {
    const newLeasesForSymbol = db.getFreshLeases({ limit: LEASE_SET_SIZE, cryptoSymbol });
    db.insertLeases({ cryptoSymbol, ip, userAgent, leases: newLeasesForSymbol });
    _.forEach(newLeasesForSymbol, (lease) => {
      assert(lease.crypto_symbol === cryptoSymbol);
      leaseSet[cryptoSymbol] = leaseSet[cryptoSymbol] || [];
      leaseSet[cryptoSymbol].push(lease);
    });
  });

  db.commitTransaction(req);

  // TODO pick only 1 (or CONFIG.NUM_GIVEN_ADDRESSES) for each cryptoSymbol of the leaseSet.
  
  res.data.leaseSet = leaseSet;
  next();
}
