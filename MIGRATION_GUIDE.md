# Migration Guide - Offline Features

## Overview

This guide helps you integrate the new offline features into your existing ExamPro installation without breaking existing functionality.

## Pre-Migration Checklist

- [ ] Backup your database
- [ ] Backup your code
- [ ] Test in staging environment first
- [ ] Review all changes
- [ ] Plan maintenance window if needed
- [ ] Notify users of new features

## Step 1: Update Code

### 1.1 Pull Latest Changes

```bash
git pull origin main
# or
git fetch && git merge origin/main
```

### 1.2 Install Dependencies (if any)

```bash
npm install
# or
yarn install
# or
bun install
```

### 1.3 Verify No Breaking Changes

```bash
npm run build
npm run type-check
```

## Step 2: Database Schema Updates

### No Database Changes Required ✓

The new features use:
- **localStorage** for sessions (client-side)
- **IndexedDB** for offline data (client-side)
- **Existing Firebase collections** for normal exams

No database migrations needed.

## Step 3: Configuration Updates

### 3.1 Update Exam Type Field

Ensure your Firestore `exams` collection has the `examType` field:

```typescript
// In Firebase console or via code:
exam.examType = 'normal'  // Default for existing exams
exam.examType = 'practice'  // For new practice exams
```

### 3.2 Update Offline Download Flag

Ensure your Firestore `exams` collection has the `allowOfflineDownload` field:

```typescript
// In Firebase console or via code:
exam.allowOfflineDownload = true  // Allow download for normal exams
exam.allowOfflineDownload = false  // Don't allow download (default)
```

### 3.3 Firestore Security Rules

No changes needed. Existing rules still apply.

## Step 4: Frontend Integration

### 4.1 Add Routes

Update your router configuration (e.g., `src/App.tsx` or `src/routes.tsx`):

```tsx
import { PracticeExamResultsPage } from '@/pages/PracticeExamResultsPage';

// Add this route:
<Route 
  path="/dashboard/results/:attemptId" 
  element={<PracticeExamResultsPage />} 
/>
```

### 4.2 Add Downloads Component

Update your department page component:

```tsx
import { DepartmentDownloads } from '@/components/department/DepartmentDownloads';

export function DepartmentPage() {
  // ... existing code ...
  
  return (
    <div>
      {/* Existing content */}
      
      {/* Add this section */}
      <DepartmentDownloads 
        departmentId={departmentId}
        exams={exams}
      />
    </div>
  );
}
```

### 4.3 Verify AuthContext

The AuthContext has been updated with session persistence. Verify it's working:

```tsx
// In your app, users should stay logged in after refresh
// No code changes needed - it's automatic
```

## Step 5: Testing

### 5.1 Test Persistent Login

```
1. Login to the app
2. Refresh the page
3. Verify you're still logged in
4. Close the browser
5. Reopen the browser
6. Verify you're still logged in
```

### 5.2 Test Downloads

```
1. Go to department page
2. Scroll to "Offline Storage" section
3. Click "Download" on a practice exam
4. Verify progress shows
5. Verify download completes
6. Verify storage usage updates
```

### 5.3 Test Offline Practice Exams

```
1. Download a practice exam
2. Go offline (DevTools or network)
3. Open the practice exam
4. Answer questions
5. Submit exam
6. Verify results show instantly
7. Go online
8. Verify no sync needed
```

### 5.4 Test Normal Exams

```
1. Take a normal exam online
2. Verify it works as before
3. Download a normal exam
4. Go offline
5. Take the exam offline
6. Go online
7. Verify results sync to server
```

## Step 6: Deployment

### 6.1 Staging Deployment

```bash
# Deploy to staging
npm run build
# Deploy to staging environment
```

### 6.2 Run Full Test Suite

```bash
npm run test
npm run test:e2e
```

### 6.3 Production Deployment

```bash
# Deploy to production
npm run build
# Deploy to production environment
```

### 6.4 Monitor

- Check error logs
- Monitor storage usage
- Check user feedback
- Monitor performance metrics

## Step 7: Post-Migration

### 7.1 Notify Users

Send notification about new features:
- Persistent login (no need to log in again)
- Download exams for offline use
- Take practice exams offline

### 7.2 Update Documentation

- Update user guide
- Update admin guide
- Update help documentation
- Create video tutorials

### 7.3 Monitor Metrics

- Session persistence rate
- Download usage
- Offline exam usage
- Storage usage
- Error rates

## Rollback Plan

If issues occur, rollback is simple:

### 7.1 Rollback Code

```bash
git revert <commit-hash>
npm run build
# Redeploy
```

### 7.2 Clear Client Data

Users can clear their local data:
- Clear browser cache
- Clear localStorage
- Clear IndexedDB

### 7.3 No Server Data Loss

All server data is safe:
- Firebase data unchanged
- Normal exams unaffected
- Results preserved

## Troubleshooting

### Issue: Session Not Persisting

**Solution:**
1. Check localStorage is enabled
2. Check session hasn't expired (30 days)
3. Clear browser cache
4. Try logging out and back in

### Issue: Downloads Not Working

**Solution:**
1. Check internet connection
2. Verify exam has `allowOfflineDownload: true` or `examType: 'practice'`
3. Check available storage space
4. Try downloading again

### Issue: Offline Exams Not Loading

**Solution:**
1. Verify exam was downloaded successfully
2. Check IndexedDB in DevTools
3. Clear browser cache
4. Re-download the exam

### Issue: Results Not Showing

**Solution:**
1. Verify practice exam was submitted
2. Check IndexedDB for attempt data
3. Check browser console for errors
4. Try refreshing the page

### Issue: Normal Exams Broken

**Solution:**
1. Verify Firebase is still configured
2. Check Firebase security rules
3. Check network connection
4. Check browser console for errors

## Performance Considerations

### Storage Usage

- Practice exams: ~2KB per question
- Sessions: ~1KB per user
- Metadata: ~1KB per exam

**Recommendation:** Monitor storage and set limits per department (100MB recommended).

### Network Usage

- Downloads: One-time cost
- Offline exams: No network usage
- Normal exams: Same as before

### Battery Usage

- Minimal impact
- IndexedDB queries are fast
- No background sync for practice exams

## Security Considerations

### Session Storage

- Sessions stored in localStorage (not secure for sensitive data)
- 30-day expiry limits exposure
- Clear on logout
- Consider HTTPS only

### Offline Data

- Practice results stored locally only
- No backup on server
- User responsible for device security

### Firebase Integration

- Normal exams still use Firebase security rules
- Practice exams bypass Firebase (local only)
- No sensitive data in IndexedDB

## Compatibility

### Browser Support

- Chrome/Edge: ✓ Full support
- Firefox: ✓ Full support
- Safari: ✓ Full support (iOS 11.3+)
- Mobile browsers: ✓ Full support

### Device Support

- Desktop: ✓ Full support
- Tablet: ✓ Full support
- Mobile: ✓ Full support
- Low-end devices: ✓ Supported

### Network Support

- Fast networks: ✓ Optimal
- Slow networks: ✓ Works
- Offline: ✓ Works (for downloaded exams)

## FAQ

### Q: Will existing exams break?
**A:** No. Existing exams continue to work as before. The new features are additive.

### Q: Do I need to update my database?
**A:** No. The new features use client-side storage (localStorage, IndexedDB).

### Q: Will users lose their sessions?
**A:** No. Sessions are automatically saved and restored.

### Q: Can I disable the new features?
**A:** Yes. Don't add the DepartmentDownloads component or PracticeExamResultsPage route.

### Q: What about existing practice exams?
**A:** Mark them with `examType: 'practice'` to use the new offline features.

### Q: How do I migrate existing exams to practice exams?
**A:** Update the `examType` field in Firestore for each exam.

### Q: What about user data privacy?
**A:** Practice results are stored locally only. No data sent to server.

### Q: Can I sync practice results to the server?
**A:** Not in the current implementation. This is a future enhancement.

## Support

For issues or questions:

1. Check `OFFLINE_IMPLEMENTATION_GUIDE.md`
2. Check `OFFLINE_QUICK_START.md`
3. Review code comments
4. Check browser console for errors
5. Check Firebase logs

## Next Steps

1. ✓ Review this guide
2. ✓ Test in staging
3. ✓ Deploy to production
4. ✓ Monitor metrics
5. ✓ Gather user feedback
6. ✓ Plan future enhancements

## Timeline

- **Day 1**: Code review and testing
- **Day 2**: Staging deployment and testing
- **Day 3**: Production deployment
- **Day 4-7**: Monitoring and user feedback
- **Week 2+**: Optimization and enhancements

## Success Metrics

- Session persistence rate > 95%
- Download success rate > 99%
- Offline exam success rate > 99%
- User satisfaction > 4/5
- No critical bugs
- Performance acceptable

## Conclusion

The migration is straightforward with no breaking changes. All new features are backward compatible with existing functionality. Follow this guide for a smooth integration.

For detailed technical information, see `OFFLINE_IMPLEMENTATION_GUIDE.md`.
