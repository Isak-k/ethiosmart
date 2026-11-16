import * as ca from '../_lib/content-access-core.js';
import { admin } from '../_lib/firebase-admin.js';
import { createHandler } from '../_lib/http.js';

export default createHandler(async (req, _res, ctx) => {
  return await ca.getStudentBook(ctx.db, admin, ctx.uid, req.body);
});
