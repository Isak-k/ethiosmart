# Offline Implementation Guide

## Overview

This guide documents the implementation of persistent login, offline practice exams, and department downloads for the ExamPro examination system.

## 1. Persistent Login (Remember User Session)

### Implementation Files
- `src/lib/session-persistence.ts` - Session storage and retrieval
- `src/contexts/AuthContext.tsx` - Updated to save/restore sessions

### How It Works

1. **Session Storage**: When a user logs in successfully, their session is saved to `localStorage`:
   - User ID, email, display name
   - User profile data
   - User role (admin/student)
   - Session timestamp
   - Expiry time (30 days from login)

2. **Session Restoration**: On app startup:
   - AuthContext checks for a valid stored session
   - If valid (not expired), user is automatically logged in
   - No login page is shown
   - User is redirected to their dashboard

3. **Session Expiry**: Sessions expire after 30 days of inactivity
   - Expiry time is refreshed on each auth state change
   - Expired sessions are automatically cleared

### Key Functions

```typescript
// Save session after successful login
saveSession(user, profile, role)

// Retrieve stored session
getStoredSession()

// Clear session on logout
clearSession()

// Check if valid session exists
hasValidSession()

// Refresh session expiry
refreshSessionExpiry()
```

### Usage in AuthContext

```typescript
// In AuthProvider useEffect:
if (currentUser) {
  // ... load profile and role ...
  saveSession(currentUser, userProfile, userRole);
  refreshSessionExpiry();
} else {
  clearSession();
}
```

## 2. Department Downloads for PWA/Mobile

### Implementation Files
- `src/lib/offline-download-manager.ts` - Download management
- `src/hooks/useOfflineDownloadManager.ts` - React hook for downloads
- `src/components/department/DepartmentDownloads.tsx` - UI component

### Features

#### Download Management
- Download exams for offline use
- Track download progress (0-100%)
- Store download metadata (size, date, version)
- Detect update availability
- Delete individual downloads
- Clear all downloads

#### Storage Usage
- Display total storage used
- Show storage per exam
- Format sizes (B, KB, MB, GB)
- Estimate download sizes

#### Download Status
- **not-downloaded**: Available for download
- **downloaded**: Already downloaded
- **update-available**: New version available
- **downloading**: Currently downloading
- **failed**: Download failed

### Key Functions

```typescript
// Download an exam
downloadExam(exam, departmentId)

// Get download status
getDownloadStatus(exam, remoteVersion)

// Delete a download
deleteDownload(examId)

// Get all downloaded exams for department
getDownloadedExams(departmentId)

// Clear all downloads
clearAllDownloads()

// Get storage usage
getDownloadStorageUsage()

// Format storage size
formatStorageSize(bytes)
```

### UI Component Usage

```tsx
<DepartmentDownloads 
  departmentId={departmentId}
  exams={exams}
/>
```

## 3. Full Offline Practice Exam Support

### Implementation Files
- `src/lib/offline-practice-exam.ts` - Practice exam logic
- `src/pages/TakeExam.tsx` - Updated to support practice exams
- `src/components/exam/PracticeExamResults.tsx` - Results display
- `src/pages/PracticeExamResultsPage.tsx` - Results page

### How It Works

#### Practice Exam Flow

1. **Download**: Student downloads practice exam
   - Exam data stored in IndexedDB
   - Questions stored in IndexedDB
   - No Firebase calls needed

2. **Take Exam**: Student opens practice exam
   - All data loaded from IndexedDB
   - No network requests
   - Instant loading

3. **Answer Questions**: Student answers questions
   - Answers saved to IndexedDB
   - Marks tracked locally
   - No server communication

4. **Submit Exam**: Student submits exam
   - Score calculated locally
   - Results displayed instantly
   - No Firebase calls
   - Results stored locally (not synced to server)

#### Result Calculation

Results are calculated entirely on the device:
- Total Score: Sum of marks for correct answers
- Max Score: Sum of all question marks
- Correct Answers: Count of correct responses
- Incorrect Answers: Count of incorrect responses
- Percentage: (Total Score / Max Score) * 100
- Pass/Fail: Based on passing threshold (default 50%)
- Time Spent: Calculated from start to submission

### Key Functions

```typescript
// Create a new practice attempt
createPracticeAttempt(examId, studentId, maxScore)

// Save an answer
savePracticeAnswer(attemptId, questionId, selectedOptionIndex, isCorrect, marks)

// Get all answers for an attempt
getPracticeAnswers(attemptId)

// Submit exam and calculate results
submitPracticeExam(attemptId, passingPercentage)

// Get a practice attempt
getPracticeAttempt(attemptId)

// Get all attempts for a student
getStudentPracticeAttempts(studentId)

// Delete a practice attempt
deletePracticeAttempt(attemptId)
```

### Data Structure

```typescript
interface PracticeAttempt {
  attemptId: string;
  examId: string;
  studentId: string;
  startedAt: number;
  submittedAt: number | null;
  isSubmitted: boolean;
  timeSpentSeconds: number | null;
  totalScore: number | null;
  maxScore: number | null;
  correctAnswers: number;
  incorrectAnswers: number;
  percentage: number | null;
  passStatus: 'pass' | 'fail' | null;
  createdAt: number;
}

interface PracticeExamResult {
  attemptId: string;
  examId: string;
  totalScore: number;
  maxScore: number;
  correctAnswers: number;
  incorrectAnswers: number;
  percentage: number;
  passStatus: 'pass' | 'fail';
  timeSpentSeconds: number;
  submittedAt: number;
}
```

## 4. PWA Offline Architecture

### Service Worker (`public/sw.js`)

The service worker implements intelligent caching strategies:

#### Caching Strategies

1. **Cache-First** (for static assets):
   - Check cache first
   - If not found, fetch from network
   - Store in cache for future use
   - Used for: images, fonts, CSS, JS

2. **Network-First** (for dynamic content):
   - Try network first
   - If network fails, use cached version
   - Used for: HTML pages, API calls

3. **Firebase Bypass**:
   - Firebase API calls bypass service worker
   - Firebase handles its own offline persistence
   - Prevents conflicts with Firebase offline sync

#### Cache Names
- `exampro-v2`: Main cache for static assets
- `exampro-runtime-v2`: Runtime cache for dynamic content
- `exampro-images-v2`: Image cache

### IndexedDB Storage

#### Database: `exam_pro_offline` (v2)

Object Stores:
1. **exams**: Downloaded exam metadata
   - Key: examId
   - Stores: Exam data, download timestamp

2. **questions**: Exam questions
   - Key: questionId
   - Index: examId (for querying by exam)
   - Stores: Question text, options, correct answer, marks

3. **metadata**: Download metadata
   - Key: examId
   - Stores: Download info, size, status, version

4. **practice_attempts**: Practice exam attempts
   - Key: attemptId
   - Indexes: examId, studentId
   - Stores: Attempt data, scores, results

5. **practice_answers**: Practice exam answers
   - Key: [attemptId, questionId]
   - Index: attemptId
   - Stores: Selected option, correctness, marks

6. **attempts**: Normal exam attempts (offline fallback)
   - Key: attemptId
   - Indexes: examId, studentId

7. **answers**: Normal exam answers (offline fallback)
   - Key: [attemptId, questionId]
   - Index: attemptId

### Firebase Offline Persistence

Firebase Firestore has built-in offline persistence:
- Enabled in `src/integrations/firebase/client.ts`
- Multi-tab support with fallback to single-tab
- Automatic sync when connection restored
- Handles normal exam data

## 5. Distinguishing Normal vs Practice Exams

### Exam Type Field

In `Exam` interface:
```typescript
examType?: 'normal' | 'practice';
```

### Behavior Differences

| Feature | Normal Exam | Practice Exam |
|---------|------------|---------------|
| Storage | Firebase + Offline fallback | IndexedDB only |
| Submission | Saved to Firebase | Saved locally only |
| Results | Stored on server | Stored locally only |
| Sync | Syncs to server | No sync |
| Offline | Works offline if downloaded | Always offline |
| Password | Supported | Not supported |
| Max Attempts | Enforced | Not enforced |

### Implementation in TakeExam

```typescript
// Check if practice exam
if (exam.examType === 'practice') {
  // Use practice exam module
  await createPracticeAttempt(...)
  await savePracticeAnswer(...)
  await submitPracticeExam(...)
} else {
  // Use normal exam flow
  await createAttempt(...)
  await saveAnswer(...)
  await submitAttempt(...)
}
```

## 6. Integration Points

### Adding Downloads Section to Department Page

```tsx
import { DepartmentDownloads } from '@/components/department/DepartmentDownloads';

// In your department page component:
<DepartmentDownloads 
  departmentId={departmentId}
  exams={exams}
/>
```

### Displaying Practice Exam Results

```tsx
import { PracticeExamResultsPage } from '@/pages/PracticeExamResultsPage';

// Add route:
<Route path="/dashboard/results/:attemptId" element={<PracticeExamResultsPage />} />
```

### Checking Session on App Startup

The AuthContext automatically handles session restoration. No additional code needed.

## 7. User Experience Flow

### Persistent Login Flow
1. User logs in → Session saved
2. User closes browser → Session persists
3. User reopens app → Automatically logged in
4. User clicks Logout → Session cleared

### Download Flow
1. Student views department page
2. Sees "Downloads" section with available exams
3. Clicks "Download" on practice exam
4. Progress bar shows download status
5. Once complete, can take exam offline

### Offline Practice Exam Flow
1. Student downloads practice exam
2. Opens practice exam (no network needed)
3. Answers questions (all saved locally)
4. Submits exam
5. Results calculated and displayed instantly
6. Can download results as CSV

## 8. Testing Checklist

### Persistent Login
- [ ] Login and refresh page - user stays logged in
- [ ] Close browser and reopen - user stays logged in
- [ ] Wait 30 days - session expires
- [ ] Logout - session cleared
- [ ] Multiple tabs - session syncs

### Downloads
- [ ] Download exam - progress shows
- [ ] Check storage usage - displays correctly
- [ ] Delete download - removed from storage
- [ ] Clear all - all downloads removed
- [ ] Update available - shows update button

### Offline Practice Exams
- [ ] Download practice exam
- [ ] Go offline (DevTools or network)
- [ ] Open practice exam - loads instantly
- [ ] Answer questions - saves locally
- [ ] Submit exam - results show instantly
- [ ] Check results - all calculations correct
- [ ] Download results - CSV file created

### PWA
- [ ] Install app on mobile
- [ ] Use offline - works correctly
- [ ] Download exams - stored on device
- [ ] Take practice exam - works offline
- [ ] Go online - syncs if needed

## 9. Performance Considerations

### Storage Limits
- IndexedDB: Typically 50MB+ per origin
- Recommended max: 100MB per department
- Monitor storage usage in UI

### Download Optimization
- Compress question data
- Batch download requests
- Show progress to user
- Allow pause/resume (future)

### Offline Performance
- All data in IndexedDB (fast access)
- No network latency
- Instant result calculation
- Minimal memory usage

## 10. Security Considerations

### Session Storage
- Sessions stored in localStorage (not secure for sensitive data)
- 30-day expiry limits exposure
- Clear on logout
- Consider HTTPS only

### Offline Data
- Practice exam results not synced to server
- Local data only
- No backup on server
- User responsible for device security

### Firebase Integration
- Normal exams still use Firebase security rules
- Practice exams bypass Firebase (local only)
- No sensitive data in IndexedDB
- Validate data on server if needed

## 11. Future Enhancements

- [ ] Pause/resume downloads
- [ ] Selective question download
- [ ] Sync practice results to server (optional)
- [ ] Offline leaderboard
- [ ] Offline study materials
- [ ] Encrypted local storage
- [ ] Backup/restore functionality
- [ ] Offline messaging
