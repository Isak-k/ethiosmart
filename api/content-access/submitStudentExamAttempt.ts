import * as ca from '';
import { admin } from '';
import { createHandler } from '';

export default createHandler(async (req, _res, ctx) => {
  return await ca.submitStudentExamAttempt(ctx.db, admin, ctx.uid, req.body);
});
