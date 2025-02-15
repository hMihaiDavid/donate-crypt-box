import assert from 'assert';
import _ from 'lodash';
import * as db from './db.mjs';
import { bool, foldListInPlace, int, parseFilter, parseProject, projectList, projectListInPlace } from './util.mjs';

function mw_handle_get_info_crypto_symbol(req, res, next) {
    res.data.result = db.getAllCryptoSymbols();
    next();
}

function mw_handle_get_info_lease(req, res, next) {
    const count = bool(req.query.count);
    const limit = int(req.query.limit,  { check: (v) => v > 0, errMsg: 'Invalid limit.'});
    const project = parseProject(req.query.project);

    if (!count && (!limit || limit > 100))
        return next({ status: 400, message: "limit missing or too big (> 100) for non-count query." });
    
    const result = db.getLeases({
        count,
        limit,
        filter: parseFilter(req.session.userFilter),
        offset: int(req.query.offset, { check: (v) => v >= 0, errMsg: 'Invalid offset.' }),
        showDeleted: bool(req.query.showDeleted),
    });

    foldListInPlace(result);
    if (project.length > 0)
        projectListInPlace(result, project);

    res.data.result = result;
    next();
}

export function mw_handle_get_info(req, res, next) {
    switch(req.params?.entity) {
        case 'crypto_symbol':
            return mw_handle_get_info_crypto_symbol(req, res, next);
        case 'lease':
            return mw_handle_get_info_lease(req, res, next);
    }

    next({status: 404, message: "Not found"});
}