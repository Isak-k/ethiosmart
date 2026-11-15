# Server-Enforced Content Access — Migration Plan

## Why a direct rules-only change is unsafe

The current content model mixes catalog metadata and protected learning content:

- `books/{bookId}` stores both display metadata and learning content (for example `content`, `sections`, `exercises`) alongside Google Drive identifiers.
- Student book listings read directly from the `books` collection.
- Exam metadata and nested question documents are read directly by student clients.
- `subjects/{subjectId}/chapters/{chapterId}` is currently readable without an entitlement check.
- `api/drive/download` accepts an arbitrary Google Drive `fileId`, does not authenticate the caller, and responds with public cache headers.
- The current Firestore rules allow authenticated reads of books, exams, questions, chapters and their related content.

Changing `books` or question rules immediately would break existing catalog queries and readers. Hiding content in React would not protect the underlying Firestore documents.

## Required target design

### 1. Separate catalog metadata from learning content

- `bookCatalog/{bookId}`: safe listing fields only (title, resource type, subject/chapter labels, cover, publication state, language, display order). Never include `driveFileId`, `driveUrl`, note sections, exercises, answer keys, or full text.
- `books/{bookId}`: protected content and private source metadata.
- Student catalog retrieval goes through an authenticated callable that returns only published catalog records.
- Student content retrieval goes through an authenticated callable that checks entitlements before returning the content.
- Admin CRUD retains privileged access and updates both catalog and protected content atomically where possible.

### 2. Server-side entitlement records and usage

- Lifetime paid access is read from the authoritative user/payment account record and remains permanent.
- Explicit free chapter, exam and note selections are checked on the server.
- The configured per-subject free chapter allowance is resolved from the actual chapter order, not trusted from client input.
- Free chapter, exam and note usage is tracked independently per user.
- Usage increments and grant creation happen in Firestore transactions, with idempotent grants so refreshes do not consume the same free item repeatedly.
- Only server code can create or modify access grants and usage counters.
- Admin-granted lifetime access is permanent, consistent with the payment-system requirement.

Suggested private collections:
- `contentAccess/{uid}/items/{contentKey}`: server-created access grants.
- `freeAccessUsage/{uid}`: server-maintained per-type counters and granted item IDs.

### 3. Secure exam access and attempts

- Student clients must not read `exams/{examId}/questions` directly.
- A callable validates lifetime or free-exam eligibility and returns the exam questions.
- Starting a free exam attempt must be server-authorized and counted transactionally. A client-created attempt document must not be able to reset or bypass the free attempt limit.
- Offline exam downloads are issued only after an online entitlement check. Existing downloaded practice exams remain available offline according to the product's offline policy.

### 4. Secure document files

- The existing Drive download endpoint must stop accepting arbitrary file IDs.
- The target is a server-authenticated download endpoint that receives a book ID, checks entitlement, and streams the associated file.
- Google Drive files shared as “Anyone with the link” can still be opened outside EthioSmart if their raw URL or file ID is known. For a real paywall, move protected files to private Firebase Storage (or another private object store) and issue short-lived authorized downloads.
- Never send private storage credentials or signing secrets to the browser.

### 5. Offline behavior

- Only successfully authorized content can be newly downloaded for offline use.
- Keep the existing IndexedDB/offline reader workflow, but record which content was authorized when downloaded.
- Do not silently delete users' existing offline files during migration. A migration policy and user-facing explanation are required if cached content must be revalidated.

## Safe implementation order

1. Add server callables for safe book catalog and entitlement-checked content retrieval.
2. Add an idempotent migration utility that copies current book metadata into `bookCatalog`; verify counts and representative records before switching reads.
3. Switch student book listing/reader code to the callables; retain admin CRUD paths.
4. Tighten Firestore rules only after the client no longer depends on broad student reads.
5. Add server-authorized exam question retrieval and attempt counting.
6. Move protected Drive files to private storage and replace the public file-ID download route.
7. Add Firebase Emulator tests for paid, free, expired/unauthorized, admin, and offline-download cases.

## Release safety

- Do not deploy this migration until catalog counts, content checksums, student/admin flows, and emulator security tests pass.
- Keep the existing source documents intact until the new catalog and content paths are verified.
- Do not change the main branch or production data as part of feature-branch implementation.
- Never suspend or revoke lifetime access after a successful payment approval.
