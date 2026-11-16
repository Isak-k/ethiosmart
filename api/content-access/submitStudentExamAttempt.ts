import * as ca from '../_lib/content-access-core';
import { admin } from '../_lib/firebase-admin';
import { createHandler } from '../_lib/http';

export default createHandler(async (req, _res, ctx) => {
  return await ca.submitStudentExamAttempt(ctx.db, admin, ctx.uid, req.body);
});
