import _ from 'lodash';
import assert from 'assert';
import { SqliteError } from 'better-sqlite3';

import * as db from './db.mjs';

export const bool = (str) => typeof(str) === 'string' && (str?.trim() === '' || str?.trim() === 'true' || str?.trim() === '1');

export function int(v, { check = (v) => true, errMsg = 'Invalid int.' } = {}) {
  if (v === '' || v === undefined || v === null ) return undefined;
  
  try {
    v = parseInt(v);
    assert(_.isInteger(v));
    assert(check(v) === true);
  } catch {
    throw { status: 400, message: errMsg };
  };

  return v;
}

export function parseFilter(str) {
  try {
    const rv = JSON.parse(str || '{}');
    assert(_.isPlainObject(rv));
    return rv;
  } catch {
    return next({status: 400, message: 'Invalid filter.'});
  }
}

export function withError(err, fn) {
  try {
    return fn();
  } catch {
    throw err;
  }
}

export const parseProject = (projectStr) => withError({ status: 400, message: "Invalid project" }, () => { 
    const lst = JSON.parse(projectStr || '[]');
    //try {
    assert(Array.isArray(lst));
    _.forEach(lst, (path) => assert((new RegExp('^[a-zA-Z0-9_.]+$')).test(path)));
    //} catch(e) { console.log('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', e); }
    return lst;
});

export function render(res, view, { data, err, status }) {
  return res.status(status).render(view, {
    status: status || 200,
    data: data || null,
    err: err || null,
    _, // inject lodash
  });
}

export function mw_err_map_sqlite_error(err, req, res, next) {
  if (err instanceof SqliteError) {
    err = { status: 500, message: "Database Error", code: err.code };
  }

  next(err);
}

export function mw_render_json(req, res) {
  res.status(res.statusCode || 200).json(res.data || {});
}

export function mw_err_render_json(err, req, res, _) {
  res.status(err.status || 500).json(err || {});
}

export function mkmw_render_view_or_json(view) {
  return (req, res) => {
    if (bool(req.query.json))
      mw_render_json(req, res);
    else
      render(res, view, { data: res.data, status: res.statusCode });
  };
}

export function mkmw_err_render_view_or_json(view) {
  return (err, req, res, next) => {
    if (err instanceof Error) return next(err); // give it to the last-resort internal server error mw.

    if (bool(req.query.json))
      mw_err_render_json(err, req, res, next);
    else
      render(res, view, { err, status: err.status || 500 });
  };
}

export function mw_err_log(err, req, res, next) {
  console.error(err);
  next(err);
}

export function mw_rollback_active_transaction(req, res, next) {
  if (req.session.txActive) {
    console.log('AUTOROLLBACK from normal mw.');
    db.rollbackTransaction(req);
  }
  next();
}

export function mw_err_rollback_active_transaction(err, req, res, next) {
  if (req.session.txActive) {
    console.log('AUTOROLLBACK from error mw.');
    db.rollbackTransaction(req);
  }
  next(err);
}

export function mkmw_start_time_measure(pathStart) {
  return (req, res, next) => {
    _.set({ req, res }, pathStart, Date.now());
    next();
  }
}

export function mkmw_end_time_measure(pathStart, pathEllapsed) {
  return (req, res, next) => {
    _.set({ req, res }, pathEllapsed, Date.now() - _.get({ req, res }, pathStart));
    next();
  }
}

export function getRemoteIp(req) {
  return String(req.connection?.remoteAddress || req.socket?.remoteAddress);
}

// returns a new object with only the selected fields,
// ex. projectObject({a: 1, b: 2, c: 3}, ['a', 'b']) ==> {a: 1, b: 2}
export const projectObject = (obj, fields) => _.pick(obj, fields);

// returns a new array of objects with only the selected fields.
// ex. projectList([{a:1, b:2}, {a:3, c:4}], ['a']) ==> [{a:1}, {a:3}]
export const projectList = (lst, fields) => _.map(lst, (o) => projectObject(o, fields));

// same as projectList but mutates the array in place. Each individual object is not modified in place.
export function projectListInPlace(lst, fields) {
  assert(Array.isArray(lst, fields));
  for (let i = 0; i < lst.length; ++i) {
    lst[i] = projectObject(lst[i], fields);
  }

  return lst;
}

/**
 * Given a plain object like this:
 * { 'a': 1, 'b.c': '2', 'b.c.d': 4, b.c.e: 5, 'b.c': 6 }
 * 
 * Returns a new plain object like this:
 * { 'a': 1, 'b': { c: { d: 4, e: 5 } } }
 * 
 * Notice how deeper paths take precedence over shallower.
 */
export const foldObject = (obj) => {
  // console.log(obj);
  assert(_.isPlainObject(obj));
  const rv = {};

  _.forEach(obj, (v, path) => {
    if (!_.isPlainObject(_.get(rv, path))) {
      _.setWith(rv, path, v, Object);
      // console.log(`set(rv, ${path}, ${v})`);
      // console.log(' ', rv);
    }
  });

  // console.log('\n\n\n\n\n\n\n\n\n\n')
  return rv;
};

// does lst[i] = foldObject(lst[i]) for all objects in array lst.
export function foldListInPlace(lst) {
  assert(Array.isArray(lst));
  for (let i = 0; i < lst.length; ++i) {
    lst[i] = foldObject(lst[i]);
  }

  return lst;
}

// https://gist.github.com/hyamamoto/fd435505d29ebfa3d9716fd2be8d42f0
// Small mod: add Math.abs
export function hashCode(s) {
  for(var i = 0, h = 0; i < s.length; i++)
      h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return Math.abs(h);
}