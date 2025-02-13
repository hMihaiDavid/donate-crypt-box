import assert from 'assert';

import * as db from"./db.mjs";
import { getRemoteIp } from "./util.mjs";

export function mw_handle_get_donate(req, res, next) {
  //console.log("params handle_get_donate", req.params);
  const ip = getRemoteIp(req);
  //const ip = '1.1.1.1';
  const userAgent = req.headers['user-agent'] || '';
  console.log(ip);
  
  db.beginTransaction(req);
  
  let leaseSet = db.getAllLeaseSetsForIp({ip, limit: 2});
  assert(Array.isArray(leaseSet));
  if (leaseSet.length > 0) {
    db.commitTransaction(req);
    res.data.leaseSet = leaseSet;
    return next();
  }

  // first time or previous lease set expired, get a new one for this ip.

  leaseSet = db.getNewLeaseSet({ limit: 5, cryptoSymbol: 'BTC' });        
  
  db.commitTransaction(req);
  
  res.data.leaseSet = leaseSet;
  next();
}
