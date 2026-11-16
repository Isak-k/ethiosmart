import { admin } from '';
import { createHandler } from '';
import * as ca from '';

export default createHandler(async (req, _res, ctx) => {
  return await ca.createStudentExamAttempt(ctx.db, admin, ctx.uid, req.body, ctx.token);
});
