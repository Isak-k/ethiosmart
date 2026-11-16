import * as payments from '../_lib/payments-core';
import { admin } from '../_lib/firebase-admin';
import { createHandler } from '../_lib/http';

export default createHandler(async (req, _res, ctx) => {
  return await payments.createReceiptUploadSignature(ctx.uid, req.body);
});
