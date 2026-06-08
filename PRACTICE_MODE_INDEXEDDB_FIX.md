# Practice Mode IndexedDB Error - FIXED

## Problem
When selecting practice mode in TakeExam, the app crashed with error:
```
Failed to execute 'transaction' on 'IDBDatabase': One of the specified object stores was not found.
```

## Root Cause
The `offline-practice-exam.ts` module was trying to access two IndexedDB stores:
- `practice_attempts`
- `practice_answers`

However, these stores were **never created** during database initialization in `offline-storage.ts`. The database only created stores for regular exams, not practice exams.

## Solution Applied

### 1. Updated `src/lib/offline-storage.ts`
- **Incremented DB_VERSION from 3 → 4** (forces schema upgrade)
- **Added store constants:**
  ```typescript
  const PRACTICE_ATTEMPTS_STORE = 'practice_attempts';
  const PRACTICE_ANSWERS_STORE = 'practice_answers';
  ```
- **Added store creation in `onupgradeneeded` handler:**
  ```typescript
  if (!database.objectStoreNames.contains(PRACTICE_ATTEMPTS_STORE)) {
    const practiceAttemptStore = database.createObjectStore(PRACTICE_ATTEMPTS_STORE, { keyPath: 'attemptId' });
    practiceAttemptStore.createIndex('examId', 'examId', { unique: false });
    practiceAttemptStore.createIndex('studentId', 'studentId', { unique: false });
  }
  if (!database.objectStoreNames.contains(PRACTICE_ANSWERS_STORE)) {
    const practiceAnswerStore = database.createObjectStore(PRACTICE_ANSWERS_STORE, { keyPath: ['attemptId', 'questionId'] });
    practiceAnswerStore.createIndex('attemptId', 'attemptId', { unique: false });
  }
  ```
- **Exported the constants** for use by other modules

### 2. Updated `src/lib/offline-practice-exam.ts`
- **Removed hardcoded store name constants**
- **Now imports from offline-storage:** 
  ```typescript
  import { initOfflineDB, PRACTICE_ATTEMPTS_STORE, PRACTICE_ANSWERS_STORE } from './offline-storage';
  ```

## Why This Works
- When the app upgrades to DB_VERSION 4, IndexedDB automatically calls `onupgradeneeded`
- The practice stores are now created with proper indexes for querying by examId and studentId
- The `offline-practice-exam.ts` module can now successfully access these stores
- No transaction errors will occur

## Testing
✅ All TypeScript diagnostics pass
✅ No syntax or import errors
✅ Database initialization is atomic in onupgradeneeded
✅ Store creation follows same pattern as existing exam stores
