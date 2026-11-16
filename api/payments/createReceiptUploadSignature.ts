import * as payments from '';
import { admin } from '';
import { createHandler } from '';

export default createHandler(async (req, _res, ctx) => {
  return await payments.createReceiptUploadSignature(ctx.uid, req.body);
});
