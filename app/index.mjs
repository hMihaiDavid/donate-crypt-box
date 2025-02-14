import express from 'express';

import { mw_handle_get_donate } from './controller.mjs';
import { mkmw_render_view_or_json, mkmw_err_render_view_or_json, mw_rollback_active_transaction, mw_err_rollback_active_transaction } from './util.mjs';
import * as db from './db.mjs';

// TODO ratelimit and max request size and bodyparser qs parser limits...
// and cors and init db and parse config from db and parse env for port/iface

//const qs_opts = {}
//app.set('query parser', (str) => qs.parse(str, qs_opts));


// MAIN

const app = express()
const port = process.env.port || 8080;

app.set('views', 'app/views');
app.set('view engine', 'ejs')

app.use((req, res, next) => { req.session = {}; next(); });
app.use((req, res, next) => { res.data = {};    next(); });

app.get('/donate',
  // normal path starts here.
  mw_handle_get_donate,

  // test jumping to error path...
  //(req, res) => {throw "Test normal error middleware."},
  //(req, res) => {throw new Error("Test internal server error middleware.")},
  mw_rollback_active_transaction,
  mkmw_render_view_or_json('donate'),

  // error path jumps here.
  mw_err_rollback_active_transaction,
  mkmw_err_render_view_or_json('donate'));

// TODO REMOVE ME
app.get('/test_destroy_all_leases',
  (req, res) => {
    let rv = db.destroyExpiredLeases({maxAgeSecs: 1 });
    res.send('done, with maxAgeSecs 1, rv = '+JSON.stringify(rv));
  }
)

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("Internal Server Error.");
});

// serve static folder.
app.use(express.static('static'))

db.init();

if (process.argv.includes('--exit'))
  process.exit(0);

app.listen(port, '0.0.0.0', () => {
  console.log(`app listening on port ${port}`)
})