import * as payments from '';
import { admin } from '';
import { createHandler } from '';

export default createHandler(async (req, _res, ctx) => {
  return await payments.savePaymentSettings(ctx.db, admin, ctx.uid, ctx.profile, req.body);
});
