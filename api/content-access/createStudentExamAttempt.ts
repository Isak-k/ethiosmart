import { admin } from '../_lib/firebase-admin.js';
import { createHandler } from '../_lib/http.js';
import * as ca from '../_lib/content-access-core.js';

export default createHandler(async (req, _res, ctx) => {
  return await ca.createStudentExamAttempt(ctx.db, admin, ctx.uid, req.body, ctx.token);
});
