# Quick Permission System Test Guide

## 🚀 Quick Start

### Prerequisites
- App is running locally or deployed
- You have Super Admin access (isak@gmail.com)
- You have at least one examiner account to test with

---

## ⚡ Quick Test (5 minutes)

### Step 1: Login as Super Admin
1. Go to login page
2. Enter: `isak@gmail.com` / your password
3. Click "Login"

### Step 2: Go to Manage Examiners
1. Click "Dashboard" in sidebar
2. Click "Manage Examiners"
3. You should see a list of examiners

### Step 3: Revoke Delete Permission
1. Find an examiner (not yourself)
2. Click the "Permissions" button (gear icon)
3. Scroll down to "Examiner Management" section
4. **Uncheck** "Delete Examiners"
5. Click "Save Permissions"
6. You should see: "Permissions updated successfully"

### Step 4: Verify Frontend Works
1. Logout (click your profile → Logout)
2. Login as the examiner you just modified
3. Go to "Manage Examiners"
4. **Expected**: Delete button (trash icon) should be HIDDEN
5. **If visible**: Permission system is broken

### Step 5: Verify Backend Works
1. Open browser console (F12)
2. Try to delete an examiner via console:
   ```javascript
   // This should fail with permission error
   await deleteExaminerProtected(currentUser, 'examiner-id');
   ```
3. **Expected**: Error message about missing permission
4. **If succeeds**: Backend protection is broken

### Step 6: Grant Permission Back
1. Logout and login as Super Admin again
2. Go to Manage Examiners
3. Click "Permissions" on the same examiner
4. **Check** "Delete Examiners"
5. Click "Save Permissions"
6. Logout and login as examiner
7. Go to Manage Examiners
8. **Expected**: Delete button should now be VISIBLE

---

## 🧪 Full Test Suite (15 minutes)

### Test 1: Create Permission
- [ ] Revoke "Add Examiners" permission
- [ ] Logout and login as examiner
- [ ] Go to Manage Examiners
- [ ] Verify "Add Examiner" button is HIDDEN
- [ ] Grant permission back
- [ ] Verify button is VISIBLE

### Test 2: Edit Permission
- [ ] Revoke "Edit Examiner Permissions" permission
- [ ] Logout and login as examiner
- [ ] Go to Manage Examiners
- [ ] Verify "Edit" button (pencil icon) is HIDDEN
- [ ] Grant permission back
- [ ] Verify button is VISIBLE

### Test 3: Enable/Disable Permission
- [ ] Revoke "Enable/Disable Examiners" permission
- [ ] Logout and login as examiner
- [ ] Go to Manage Examiners
- [ ] Verify toggle switch is HIDDEN
- [ ] Grant permission back
- [ ] Verify toggle is VISIBLE

### Test 4: Disable User Account
- [ ] Go to Manage Examiners
- [ ] Click toggle to disable an examiner
- [ ] Logout and try to login as that examiner
- [ ] **Expected**: Login should fail or show disabled message
- [ ] Re-enable the examiner
- [ ] Verify they can login again

### Test 5: Multiple Permissions
- [ ] Revoke multiple permissions at once
- [ ] Logout and login as examiner
- [ ] Verify all buttons are hidden
- [ ] Grant all permissions back
- [ ] Verify all buttons are visible

---

## 🔍 Debugging

### If buttons are still visible after revoking permissions:
1. **Clear browser cache**: Ctrl+Shift+Delete
2. **Hard refresh**: Ctrl+Shift+R
3. **Check Firestore**: 
   - Go to Firebase Console
   - Check `users/[userId]/sectionPermissions`
   - Verify permissions were saved correctly
4. **Check browser console**: F12 → Console
   - Look for permission check logs
   - Look for any errors

### If backend is not blocking API calls:
1. **Check permission middleware**: `src/lib/permission-middleware.ts`
2. **Check protected functions**: `src/lib/firebase-admin-protected.ts`
3. **Check browser console**: F12 → Network tab
   - Look for 403 Forbidden responses
   - Check error messages

### If permissions are not saving:
1. **Check Firestore**: 
   - Go to Firebase Console
   - Check if `permissions` field exists
   - Check if `sectionPermissions` field exists
2. **Check browser console**: F12 → Console
   - Look for save errors
   - Look for network errors
3. **Check network tab**: F12 → Network
   - Look for failed requests
   - Check response status codes

---

## ✅ Success Indicators

### Frontend Working ✅
- [ ] Buttons hide when permission revoked
- [ ] Buttons show when permission granted
- [ ] No console errors
- [ ] Permissions persist after logout/login

### Backend Working ✅
- [ ] API calls blocked with 403 Forbidden
- [ ] Error messages are clear
- [ ] Disabled users cannot perform actions
- [ ] Permission checks happen on every operation

### System Working ✅
- [ ] Both frontend and backend working together
- [ ] No way to bypass frontend and access backend
- [ ] Permissions are synchronized
- [ ] No breaking changes to existing features

---

## 📊 Test Results Template

```
Date: ___________
Tester: ___________

Frontend Tests:
- [ ] Delete permission revoke: PASS / FAIL
- [ ] Create permission revoke: PASS / FAIL
- [ ] Edit permission revoke: PASS / FAIL
- [ ] Enable/Disable permission revoke: PASS / FAIL
- [ ] Multiple permissions: PASS / FAIL

Backend Tests:
- [ ] API blocked with 403: PASS / FAIL
- [ ] Error messages clear: PASS / FAIL
- [ ] Disabled users blocked: PASS / FAIL

Overall Status: ✅ PASS / ❌ FAIL

Issues Found:
1. ___________
2. ___________
3. ___________

Notes:
___________
```

---

## 🚀 Ready to Deploy?

Before deploying to production, verify:
- [ ] All tests pass
- [ ] No console errors
- [ ] No network errors
- [ ] Permissions persist correctly
- [ ] Disabled users cannot access
- [ ] Backend blocks unauthorized access
- [ ] Frontend buttons show/hide correctly

---

**Last Updated**: March 10, 2026
**Status**: Ready for Testing
