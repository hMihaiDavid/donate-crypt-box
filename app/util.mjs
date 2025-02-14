import _ from 'lodash';
import * as db from './db.mjs';

export function render(res, view, { data, err, status }) {
  return res.status(status).render(view, {
    status: status || 200,
    data: data || null,
    err: err || null,
    _, // inject lodash
  });
}

export function mkmw_render_view_or_json(view) {
  return (req, res) => {
    if (req.query.json === 'true')
      res.status(res.statusCode || 200).json(res.data || {});
    else
      render(res, view, { data: res.data, status: res.statusCode });
  };
}

export function mkmw_err_render_view_or_json(view) {
  return (err, req, res, next) => {
    if (err instanceof Error) return next(err); // give it to the last-resort internal server error mw.

    if (req.query.json === 'true')
      res.status(err.status || 500).json(err);
    else
      render(res, view, { err, status: err.status || 500 });
  };
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

// returns a new array of objects (aka rows) with only the selected fields in the objects.
// ex. projectRows([{a:1, b:2}, {a:3, c:4}], ['a']) ==> [{a:1}, {a:3}]
export const projectRows = (rows, fields) => _.map(rows, (row) => projectObject(row, fields));