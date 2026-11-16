import { admin } from '../_lib/firebase-admin';
import { createHandler } from '../_lib/http';
import * as ca from '../_lib/content-access-core';

export default createHandler(async (req, _res, ctx) => {
  return await ca.createStudentExamAttempt(ctx.db, admin, ctx.uid, req.body, ctx.token);
});
