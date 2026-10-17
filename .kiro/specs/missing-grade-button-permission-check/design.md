# Missing Grade Button Permission Check - Bugfix Design

## Overview

The Grade button (Pencil icon) appears in the Actions column of the student results table in ExamResults.tsx without checking the `canGradeExams()` permission. This allows admins without grading permissions to see and click the button, which violates the principle of permission-based access control. The fix involves adding a permission check before rendering the Grade button to match the permission model used for the Delete button.

## Glossary

- **Bug_Condition (C)**: The Grade button is rendered without verifying the `canGradeExams()` permission check
- **Property (P)**: The Grade button should only be visible to admins who have the `canGradeExams` permission
- **Preservation**: The Delete button and other UI elements must continue to work exactly as before
- **canGradeExams()**: A function from `useGranularPermissions()` hook that returns true if the current admin has permission to grade exams
- **ExamResults Component**: The React component in `src/pages/ExamResults.tsx` that displays the student results table
- **Attempt**: A student's exam submission with attempt ID, student info, and scores

## Bug Details

### Fault Condition

The Grade button is rendered unconditionally in the Actions column without checking the `canGradeExams()` permission. The button exists in the code at lines 313-319 of ExamResults.tsx but is not guarded by any permission check, allowing any admin viewing the exam results page to see and interact with it regardless of their permissions.

**Formal Specification:**
```
FUNCTION isBugCondition(admin)
  INPUT: admin of type AuthenticatedAdmin
  OUTPUT: boolean
  
  RETURN admin views ExamResults page
         AND Grade button (Pencil icon) is rendered
         AND admin.canGradeExams() = false
         AND button is visible in Actions column
END FUNCTION
```

### Examples

- **Example 1 (Bug Manifest)**: Admin A logs in without `gradeExams` permission, navigates to an exam's results page (via AdminAllResults → Eye icon), and sees the Grade button (Pencil icon) in the Actions column. They can click it and are taken to the grading page.

- **Example 2 (Bug Manifest)**: Admin B has `viewExamResults` permission but not `gradeExams` permission. The Grade button appears in the student results table, suggesting they can grade when they shouldn't be able to.

- **Example 3 (Correct)**: Admin C has both `viewExamResults` and `gradeExams` permissions. The Grade button appears and is functional.

- **Example 4 (Correct)**: Admin D has `viewExamResults` permission but not `gradeExams`. The Grade button should NOT appear in the Actions column.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Delete button (Trash icon) must continue to display and function based on `canDelete('manageExams')` permission
- All other UI elements in the student results table must remain unchanged
- Navigation functionality when Delete button is clicked must be preserved
- Score display, student info, and other table columns must be unaffected
- The Export and Publish Results buttons functionality must be preserved

**Scope:**
All permissions checks and UI rendering logic unrelated to the Grade button should be completely unaffected by this fix. This includes:
- Delete button permission checking and rendering
- Export functionality and buttons
- Publish/Hide Results button functionality
- All other admin dashboard features

## Hypothesized Root Cause

Based on the bug description, the most likely issue is:

1. **Missing Permission Check in Render Logic**: The Grade button (Pencil icon) at lines 313-319 is rendered unconditionally without wrapping it in a permission check condition, unlike the Delete button which is wrapped in `{canDelete('manageExams') && (...)}`

2. **Permission Hook Not Imported**: The `useGranularPermissions()` hook may not have been imported into ExamResults.tsx when the Grade button code was added

3. **Inconsistent Pattern**: While the Delete button uses `canDelete()` from `useSectionPermissions()`, the Grade button should use `canGradeExams()` from `useGranularPermissions()`, suggesting the developer may not have been aware of or familiar with the permission system when implementing the Grade button

## Correctness Properties

Property 1: Fault Condition - Grade Button Permission Check

_For any_ admin without the `gradeExams` permission navigating to the exam results page, the fixed ExamResults component SHALL NOT render the Grade button (Pencil icon) in the Actions column of the student results table.

**Validates: Requirements 2.2**

Property 2: Preservation - Delete Button and Other UI Elements

_For any_ interaction with the Delete button, Export functionality, or other UI elements that do NOT involve the Grade button, the fixed ExamResults component SHALL produce exactly the same behavior as the original component, preserving all existing functionality including button visibility, permission checks, and navigation.

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/pages/ExamResults.tsx`

**Function**: `ExamResults` (hook usage update)

**Specific Changes**:
1. **Import useGranularPermissions Hook**: Add import for `useGranularPermissions` at the top of the file
   - This provides access to the `canGradeExams()` permission check

2. **Add Hook Initialization**: Inside the ExamResults component, add `const { canGradeExams } = useGranularPermissions();`
   - This makes the permission check function available within the component

3. **Add Permission Check to Grade Button**: Wrap the Grade button (Pencil icon) in a conditional render
   - Change from unconditional rendering to `{canGradeExams() && (...Grade button JSX...)}`
   - This ensures the button only appears for admins with `gradeExams` permission

4. **Verify No Side Effects**: Ensure the permission check doesn't affect other UI elements or functionality
   - Delete button remains independent with its own `canDelete()` check
   - All other table elements remain unchanged

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code (Grade button visible to admins without permission), then verify the fix works correctly and preserves existing behavior.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that the Grade button is indeed visible and functional for admins without `gradeExams` permission on unfixed code. Verify our root cause hypothesis.

**Test Plan**: Write tests that simulate the ExamResults component rendering with an admin who lacks `gradeExams` permission, and verify that the Grade button element is present in the DOM. Run these tests on the UNFIXED code to observe the button appearing when it shouldn't.

**Test Cases**:
1. **Grade Button Visibility Without Permission**: Render ExamResults component with `canGradeExams()` returning false, verify Grade button (Pencil icon) is visible in DOM (will fail on unfixed code - button should not exist)
2. **Grade Button Click Without Permission**: Verify Grade button can be clicked and navigates to grading page when user lacks permission (confirms bug exists on unfixed code)
3. **Grade Button in Multiple Rows**: Verify Grade button appears in Actions column for multiple student attempts when user lacks permission (confirms pervasive bug)
4. **Multiple Permissions Combinations**: Test Grade button visibility with various permission combinations (e.g., has delete permission but not grade permission)

**Expected Counterexamples**:
- Grade button with Pencil icon is visible in the DOM for admins without `gradeExams` permission
- Button remains clickable and can navigate to grading page
- Possible root cause confirmation: No conditional rendering around the Grade button code

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (admin without `gradeExams` permission), the fixed component does not render the Grade button.

**Pseudocode:**
```
FOR ALL admin WHERE NOT canGradeExams(admin) DO
  result := renderExamResults(admin)
  ASSERT gradeButtonNotVisible(result)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed component produces the same result as the original component. Also verify that admins WITH `gradeExams` permission still see the Grade button, and that the Delete button functionality is completely preserved.

**Pseudocode:**
```
FOR ALL admin WHERE NOT isBugCondition(admin) DO
  ASSERT originalExamResults(admin) = fixedExamResults(admin)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking to generate many test cases across different permission combinations and admin types, ensuring no regressions occur.

**Test Plan**: Observe behavior on UNFIXED code for admins WITH `gradeExams` permission and admins with various other permissions (delete, view, etc.), then write property-based tests capturing that behavior.

**Test Cases**:
1. **Grade Button With Permission**: Render ExamResults with `canGradeExams()` returning true, verify Grade button IS visible (preservation of correct behavior)
2. **Delete Button Preservation**: Verify Delete button continues to display and function exactly as before regardless of grading permission status
3. **Export Functionality Preservation**: Verify Export CSV/PDF buttons continue to work exactly as before
4. **Publish Results Preservation**: Verify Publish/Hide Results button functionality is unchanged
5. **Table Display Preservation**: Verify table columns, sorting, student data display remain exactly the same
6. **Multiple Permission States**: Test rendering with different permission combinations to verify only Grade button is affected

### Unit Tests

- Test Grade button visibility with `canGradeExams()` returning true vs false
- Test Grade button click handler navigation to grading page
- Test Delete button visibility and functionality is not affected
- Test rendering with various permission combinations

### Property-Based Tests

- Generate random permission states and verify Grade button visibility matches `canGradeExams()` return value
- Generate multiple admin profiles with different permission sets and verify only Grade button visibility changes
- Test that all other UI elements remain constant regardless of grading permission state

### Integration Tests

- Test full flow: admin without grading permission views exam results (Grade button hidden), admin with grading permission views same page (Grade button visible)
- Test switching between different exam results pages with different permission states
- Test that clicking Delete button (when permitted) works independent of grading permission
