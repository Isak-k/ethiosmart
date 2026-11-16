import * as payments from '../_lib/payments-core.js';
import { admin } from '../_lib/firebase-admin.js';
import { createHandler } from '../_lib/http.js';

export default createHandler(async (req, _res, ctx) => {
  return await payments.getMyPayment(ctx.db, ctx.uid);
});
