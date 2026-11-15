# Permission System Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     EXAMINER PERMISSION SYSTEM                  │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                        SUPER ADMIN DASHBOARD                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 1. View Examiners List                                     │  │
│  │ 2. Click "Edit Permissions"                                │  │
│  │ 3. Uncheck "Delete Examiners"                              │  │
│  │ 4. Click "Save"                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                      FIRESTORE DATABASE                          │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ users/examiner-id                                          │  │
│  │ {                                                          │  │
│  │   userId: "examiner-id"                                    │  │
│  │   email: "examiner@example.com"                            │  │
│  │   permissions: {                                           │  │
│  │     deleteExaminers: false  ← UPDATED                      │  │
│  │     ...                                                    │  │
│  │   }                                                        │  │
│  │ }                                                          │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                    EXAMINER LOGS IN                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ AuthContext.tsx                                            │  │
│  │ → getUserProfile(userId)                                   │  │
│  │ → Loads permissions from Firestore                         │  │
│  │ → Sets profile.permissions                                 │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                    EXAMINER TRIES TO DELETE                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ManageExaminers.tsx                                        │  │
│  │ ┌──────────────────────────────────────────────────────┐   │  │
│  │ │ FRONTEND CHECK (useSectionPermissions)              │   │  │
│  │ │ canDelete('examiners') → false                       │   │  │
│  │ │ → Delete button is HIDDEN ✓                          │   │  │
│  │ └──────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│              EXAMINER TRIES TO BYPASS (Console)                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ // Attacker tries to call API directly                     │  │
│  │ await deleteExaminerProtected(currentUser, 'id');          │  │
│  │                                                            │  │
│  │ ┌──────────────────────────────────────────────────────┐   │  │
│  │ │ BACKEND CHECK (permission-middleware.ts)            │   │  │
│  │ │ enforcePermission(currentUser, 'deleteExaminers')   │   │  │
│  │ │ → currentUser.permissions.deleteExaminers === false │   │  │
│  │ │ → Throws Error: "Permission denied" ✓               │   │  │
│  │ └──────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │ Result: API call REJECTED ✓                               │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Permission Validation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER INITIATES ACTION                        │
│              (e.g., Delete Examiner Button Click)               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              STEP 1: FRONTEND PERMISSION CHECK                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ useSectionPermissions.canDelete('examiners')             │  │
│  │                                                           │  │
│  │ if (!canDelete) {                                         │  │
│  │   return null;  // Hide button                            │  │
│  │ }                                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Result: Button hidden or shown to user                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              STEP 2: CALL PROTECTED FUNCTION                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ await deleteExaminerProtected(currentUser, userId);      │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              STEP 3: BACKEND PERMISSION CHECK                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ enforcePermission(currentUser, 'deleteExaminers')        │  │
│  │                                                           │  │
│  │ Checks:                                                   │  │
│  │ 1. Is user authenticated? ✓                              │  │
│  │ 2. Is user disabled? ✗                                   │  │
│  │ 3. Is user admin/superadmin? ✓                           │  │
│  │ 4. Does user have permission? ✗ DENIED                  │  │
│  │                                                           │  │
│  │ Result: Throws Error                                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Error: "Permission denied: User lacks permission:             │
│          deleteExaminers"                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              STEP 4: ERROR HANDLING                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ try {                                                     │  │
│  │   await deleteExaminerProtected(currentUser, userId);    │  │
│  │ } catch (error) {                                         │  │
│  │   toast.error(error.message);                            │  │
│  │   // Show error to user                                  │  │
│  │ }                                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Result: User sees error message                               │
└─────────────────────────────────────────────────────────────────┘
```

## Permission Middleware Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                  PERMISSION MIDDLEWARE                           │
│                 (permission-middleware.ts)                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ checkUserPermission(user, permission)                     │ │
│  │ ├─ Check: user exists?                                   │ │
│  │ ├─ Check: user.disabled === false?                       │ │
│  │ ├─ Check: user.role === 'admin' or 'superadmin'?         │ │
│  │ ├─ Check: user.permissions[permission] === true?         │ │
│  │ └─ Return: { allowed: boolean, reason?: string }         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ enforcePermission(user, permission)                       │ │
│  │ ├─ Call: checkUserPermission()                            │ │
│  │ ├─ If not allowed:                                        │ │
│  │ │  └─ Throw Error(reason)                                 │ │
│  │ └─ If allowed:                                            │ │
│  │    └─ Return (continue execution)                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ checkUserAnyPermission(user, permissions[])               │ │
│  │ └─ Check if user has ANY of the permissions              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ checkUserAllPermissions(user, permissions[])              │ │
│  │ └─ Check if user has ALL of the permissions              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Protected Functions Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│              PROTECTED FUNCTIONS                                 │
│           (firebase-admin-protected.ts)                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ createExaminerAccountProtected(user, email, pwd, name)   │ │
│  │ ├─ enforcePermission(user, 'addExaminers')               │ │
│  │ ├─ Create secondary auth app                             │ │
│  │ ├─ Create user in Firebase Auth                          │ │
│  │ ├─ Create user profile in Firestore                      │ │
│  │ └─ Return userId                                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ updateExaminerProtected(user, userId, updates)           │ │
│  │ ├─ enforcePermission(user, 'editExaminerPermissions')    │ │
│  │ ├─ Update Firestore document                             │ │
│  │ └─ Set updatedAt timestamp                               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ toggleExaminerStatusProtected(user, userId, disabled)    │ │
│  │ ├─ enforcePermission(user, 'enableDisableExaminers')     │ │
│  │ ├─ Update disabled flag in Firestore                     │ │
│  │ └─ Set updatedAt timestamp                               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ deleteExaminerProtected(user, userId)                    │ │
│  │ ├─ enforcePermission(user, 'deleteExaminers')            │ │
│  │ ├─ Delete Firestore document                             │ │
│  │ └─ User cannot login anymore                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Permission Enforcement Comparison

### BEFORE (Vulnerable)
```
┌─────────────────────────────────────────────────────────────────┐
│ User Action                                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Frontend Check                                                  │
│ (Button hidden if no permission)                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Firestore Operation                                             │
│ (NO VALIDATION - Anyone can call!)                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ ❌ VULNERABLE: User can bypass frontend and call API directly  │
└─────────────────────────────────────────────────────────────────┘
```

### AFTER (Secure)
```
┌─────────────────────────────────────────────────────────────────┐
│ User Action                                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Frontend Check                                                  │
│ (Button hidden if no permission)                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Backend Permission Validation                                   │
│ (enforcePermission checks user.permissions)                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Firestore Operation                                             │
│ (Only executed if permission check passes)                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ ✅ SECURE: Permission enforced at every level                  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow: Permission Update

```
Super Admin Dashboard
        ↓
    [Edit Permissions Modal]
        ↓
    [Uncheck "Delete Examiners"]
        ↓
    [Click Save]
        ↓
    updateExaminerProtected(superAdmin, examinerId, {
      permissions: {
        ...
        deleteExaminers: false
      }
    })
        ↓
    enforcePermission(superAdmin, 'editExaminerPermissions')
        ↓
    updateDoc(db, 'users/examinerId', {
      permissions: { deleteExaminers: false },
      updatedAt: now()
    })
        ↓
    Firestore Updated
        ↓
    Examiner Logs Out
        ↓
    Examiner Logs In
        ↓
    AuthContext loads profile with updated permissions
        ↓
    useSectionPermissions reads new permissions
        ↓
    Delete button is now HIDDEN
        ↓
    If examiner tries API: Permission DENIED
```

---

This architecture ensures permissions are enforced at every level:
1. **Frontend**: UI feedback (buttons hidden)
2. **Backend**: Permission validation (API protected)
3. **Database**: Permissions stored and updated
4. **Session**: Permissions reloaded on login
