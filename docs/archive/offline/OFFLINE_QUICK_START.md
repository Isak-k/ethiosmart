# Offline Features - Quick Start Guide

## For Developers

### 1. Persistent Login - Already Working ✓

No code changes needed. Session persistence is automatically integrated in `AuthContext`.

**What happens:**
- User logs in → Session saved
- Browser refreshes → User stays logged in
- Browser closes → Session persists
- 30 days pass → Session expires

### 2. Add Downloads Section to Department Page

```tsx
import { DepartmentDownloads } from '@/components/department/DepartmentDownloads';

export function DepartmentPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const departmentId = 'your-department-id';

  return (
    <div>
      {/* Your existing content */}
      
      {/* Add this section */}
      <DepartmentDownloads 
        departmentId={departmentId}
        exams={exams}
      />
    </div>
  );
}
```

### 3. Add Practice Exam Results Route

```tsx
// In your router configuration (e.g., App.tsx or routes.tsx)
import { PracticeExamResultsPage } from '@/pages/PracticeExamResultsPage';

<Route 
  path="/dashboard/results/:attemptId" 
  element={<PracticeExamResultsPage />} 
/>
```

### 4. Mark Exams as Practice (Admin)

When creating/editing an exam, set:
```typescript
exam.examType = 'practice'  // For 100% offline exams
exam.examType = 'normal'    // For normal exams (default)
```

Or enable offline download for normal exams:
```typescript
exam.allowOfflineDownload = true
```

## For Students

### Download an Exam

1. Go to your department page
2. Scroll to "Offline Storage" section
3. Click "Download" on any practice exam
4. Wait for download to complete
5. Exam is now available offline

### Take a Practice Exam Offline

1. Download the practice exam (see above)
2. Go offline (or just open the exam)
3. Click "Start Exam"
4. Answer all questions
5. Click "Submit Exam"
6. Results appear instantly
7. Download results as CSV if needed

### Clear Downloaded Exams

1. Go to department page
2. Scroll to "Offline Storage" section
3. Click "Clear All Downloads"
4. Confirm deletion

## Common Tasks

### Check if Exam is Downloaded

```typescript
import { useOfflineDownloadManager } from '@/hooks/useOfflineDownloadManager';

function MyComponent() {
  const { getStatus } = useOfflineDownloadManager();
  
  const checkStatus = async (exam) => {
    const status = await getStatus(exam);
    console.log(status.status); // 'downloaded', 'not-downloaded', etc.
  };
}
```

### Get Storage Usage

```typescript
import { useOfflineDownloadManager } from '@/hooks/useOfflineDownloadManager';

function StorageInfo() {
  const { storageUsage, formatStorageSize } = useOfflineDownloadManager();
  
  return <p>Using: {formatStorageSize(storageUsage)}</p>;
}
```

### Get Practice Exam Results

```typescript
import { getPracticeAttempt } from '@/lib/offline-practice-exam';

async function getResults(attemptId) {
  const attempt = await getPracticeAttempt(attemptId);
  console.log({
    score: attempt.totalScore,
    maxScore: attempt.maxScore,
    percentage: attempt.percentage,
    passed: attempt.passStatus === 'pass'
  });
}
```

## Troubleshooting

### "Download Failed"
- Check internet connection
- Verify exam has `allowOfflineDownload: true` or `examType: 'practice'`
- Try again in a few seconds

### "Exam Not Found"
- Verify exam is published
- Check you have access to the exam
- Try refreshing the page

### "Results Not Showing"
- Verify you submitted the exam
- Check browser console for errors
- Try clearing browser cache

### "Session Not Persisting"
- Check localStorage is enabled
- Verify session hasn't expired (30 days)
- Try logging out and back in

## API Reference

### Session Functions
```typescript
import { 
  saveSession, 
  getStoredSession, 
  clearSession,
  hasValidSession,
  refreshSessionExpiry,
  getRemainingSessionTime
} from '@/lib/session-persistence';
```

### Download Functions
```typescript
import { 
  downloadExam,
  getDownloadStatus,
  deleteDownload,
  getDownloadedExams,
  clearAllDownloads,
  getDownloadStorageUsage,
  formatStorageSize
} from '@/lib/offline-download-manager';
```

### Practice Exam Functions
```typescript
import {
  createPracticeAttempt,
  savePracticeAnswer,
  getPracticeAnswers,
  submitPracticeExam,
  getPracticeAttempt,
  getStudentPracticeAttempts,
  deletePracticeAttempt
} from '@/lib/offline-practice-exam';
```

### React Hook
```typescript
import { useOfflineDownloadManager } from '@/hooks/useOfflineDownloadManager';

const {
  downloadProgress,
  storageUsage,
  formatStorageSize,
  downloadExam,
  getStatus,
  deleteDownload,
  getDownloadedExams,
  clearAllDownloadsForDepartment,
  updateStorageUsage
} = useOfflineDownloadManager();
```

## File Structure

```
src/
├── lib/
│   ├── session-persistence.ts          # Session management
│   ├── offline-download-manager.ts     # Download management
│   └── offline-practice-exam.ts        # Practice exam logic
├── hooks/
│   └── useOfflineDownloadManager.ts    # Download hook
├── components/
│   ├── department/
│   │   └── DepartmentDownloads.tsx     # Downloads UI
│   └── exam/
│       └── PracticeExamResults.tsx     # Results UI
├── pages/
│   ├── TakeExam.tsx                    # Updated for practice exams
│   └── PracticeExamResultsPage.tsx     # Results page
└── contexts/
    └── AuthContext.tsx                 # Updated with session persistence
```

## Environment Variables

No new environment variables needed. Uses existing Firebase configuration.

## Browser Storage

### localStorage
- `exampro_session` - User session data
- `exampro_session_expiry` - Session expiry timestamp

### IndexedDB
- Database: `exam_pro_offline`
- Stores: exams, questions, metadata, practice_attempts, practice_answers

### Service Worker Cache
- `exampro-v2` - Static assets
- `exampro-runtime-v2` - Dynamic content
- `exampro-images-v2` - Images

## Performance Tips

1. **Limit downloads**: Keep total downloads under 100MB
2. **Clear old downloads**: Regularly clear unused exams
3. **Use practice exams**: Faster than normal exams offline
4. **Monitor storage**: Check storage usage regularly
5. **Test on slow networks**: Ensure good UX on 3G

## Security Notes

- Sessions expire after 30 days
- Practice results stored locally only
- No sensitive data in IndexedDB
- Use HTTPS in production
- Firebase security rules still apply

## Next Steps

1. ✓ Session persistence is ready
2. Add DepartmentDownloads component to your department page
3. Add PracticeExamResultsPage route
4. Mark practice exams with `examType: 'practice'`
5. Test on mobile and offline
6. Monitor storage usage
7. Gather user feedback

## Support

For detailed information, see:
- `OFFLINE_IMPLEMENTATION_GUIDE.md` - Full technical guide
- `IMPLEMENTATION_SUMMARY.md` - Implementation details
- Code comments in each file

## Questions?

Check the implementation guide or review the code comments in:
- `src/lib/session-persistence.ts`
- `src/lib/offline-download-manager.ts`
- `src/lib/offline-practice-exam.ts`
- `src/components/department/DepartmentDownloads.tsx`
