# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Fault Condition** - Grade Button Visible Without Permission
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the Grade button is visible to admins without `gradeExams` permission
  - **Scoped PBT Approach**: Scope the property to the concrete failing case: render ExamResults with `canGradeExams()` returning false
  - Test that the Grade button (Pencil icon) element does NOT exist in the DOM when `canGradeExams()` returns false (from Fault Condition in design)
  - Assert: `screen.queryByTitle("Grade exam") === null` when user lacks permission
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists, because the Grade button is currently rendered even without permission)
  - Document counterexample found: "Grade button with Pencil icon is visible in DOM for admins without canGradeExams permission"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Delete Button and UI Elements Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: Delete button remains visible when `canDelete('manageExams')` is true on unfixed code
  - Observe: Delete button click handler works correctly on unfixed code
  - Observe: Table data, column headers, and other UI elements render consistently on unfixed code
  - Write property-based tests capturing these observed behaviors from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees that nothing breaks
  - Test cases should cover: various permission states, multiple attempts in table, different admin roles
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Fix for Grade Button Permission Check

  - [x] 3.1 Implement the fix
    - Import `useGranularPermissions` hook from `@/hooks/useGranularPermissions` at the top of ExamResults.tsx
    - Add hook initialization in ExamResults component: `const { canGradeExams } = useGranularPermissions();`
    - Wrap Grade button (Pencil icon) rendering with permission check: `{canGradeExams() && (...Grade button JSX...)}`
    - Ensure Delete button remains independent with its own permission check
    - _Bug_Condition: Grade button rendered without canGradeExams() permission check_
    - _Expected_Behavior: Grade button only renders when canGradeExams() returns true_
    - _Preservation: Delete button, Export buttons, and all other UI elements remain unchanged_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Grade Button Visible Without Permission
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (Grade button should NOT be visible without permission)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed - Grade button no longer visible without permission)
    - _Requirements: 2.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Delete Button and UI Elements Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions - Delete button and other UI still work exactly the same)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run the full test suite to ensure all tests pass
  - Verify that the fix successfully hides the Grade button from admins without `gradeExams` permission
  - Verify that admins WITH `gradeExams` permission still see and can click the Grade button
  - Verify that all other functionality (Delete button, Export, etc.) continues to work correctly
  - Confirm no regressions have been introduced
