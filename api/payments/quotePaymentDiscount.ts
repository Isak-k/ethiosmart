import * as payments from '';
import { admin } from '';
import { createHandler } from '';

export default createHandler(async (req, _res, ctx) => {
  return await payments.quotePaymentDiscount(ctx.db, ctx.uid, ctx.profile, req.body);
});
