import * as ca from '';
import { admin } from '';
import { createHandler } from '';

export default createHandler(async (req, _res, ctx) => {
  return await ca.getStudentExamQuestions(ctx.db, ctx.uid, req.body);
});
