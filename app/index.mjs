import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { slowDown } from 'express-slow-down'
import basicAuth from 'express-basic-auth';

import { mw_handle_get_donate } from './controller_donate.mjs';
import { mkmw_render_view_or_json, mkmw_err_render_view_or_json, mw_rollback_active_transaction,
         mw_err_rollback_active_transaction, mkmw_start_time_measure, mkmw_end_time_measure, 
         mw_err_render_json,
         mw_render_json, 
         mw_err_map_sqlite_error,
         mw_err_log} from './util.mjs';
import { mw_handle_get_info } from './controller_info.mjs';
import * as db from './db.mjs';

const app = express();
const port = process.env.PORT || 8080;

app.set('views', 'app/views');
app.set('view engine', 'ejs')

app.use(rateLimit({ windowMs: 10 * 60 * 1000, limit: 2000, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use(slowDown({  windowMs: 5  * 60 * 1000, delayAfter: 100, delayMs: (hits) => hits * 100, }));

app.use((req, res, next) => { req.session = {}; next(); });
app.use((req, res, next) => { res.data = {};    next(); });

// TODO disable qs parsing globally and put it only where needed, with appropriate local limits.

app.get('/donate',
  // normal path starts here.
  mkmw_start_time_measure('req.session.startMillis'),
  mw_handle_get_donate,
  // test jumping to error path...
  //(req, res) => {throw "Test normal error middleware."},
  //(req, res) => {throw new Error("Test internal server error middleware.")},
  mw_rollback_active_transaction,
  mkmw_end_time_measure('req.session.startMillis', 'res.data.ellapsedMillis'),
  mkmw_render_view_or_json('donate'),
  // error path starts here.
  mw_err_rollback_active_transaction,
  mw_err_log,
  mw_err_map_sqlite_error,
  mkmw_err_render_view_or_json('donate'));

// TODO REMOVE ME OR USE BASICHTTPAUTH
// app.get('/test_destroy_all_leases',
//   (req, res) => {
//     let rv = db.destroyExpiredLeases({maxAgeSecs: 1 });
//     res.send('done, with maxAgeSecs 1, rv = '+JSON.stringify(rv));
//   }
// )

app.get('/info/:entity',
  // normal path starts here.
  mkmw_start_time_measure('req.session.startMillis'),
  basicAuth({users: { 'admin': 'hunter2' }, challenge: true}),
  mw_handle_get_info,
  mw_rollback_active_transaction,
  mkmw_end_time_measure('req.session.startMillis', 'res.data.ellapsedMillis'),
  mw_render_json,
  // error path starts here.
  mw_err_rollback_active_transaction,
  mw_err_log,
  mw_err_map_sqlite_error,
  mw_err_render_json
);

app.use(express.static('static'))

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("Internal Server Error.");
});

db.init();

if (process.argv.includes('--exit'))
  process.exit(0);

app.listen(port, '0.0.0.0', () => {
  console.log(`app listening on port ${port}`)
})