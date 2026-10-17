# Bugfix Requirements Document

## Introduction

When an admin clicks the eye icon on the exam results page to view a student's exam attempt, the Grade button (pencil icon) should appear in the Actions column of the student results table. Currently, the pencil icon is not visible because it lacks the proper permission check. The button is implemented in the code but is being displayed without validating whether the logged-in admin has the `canGradeExams` permission, which is required to access the grading functionality.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN an admin without `canGradeExams` permission navigates to the exam results page (by clicking the eye icon) THEN the system displays an incomplete Actions column that may contain the Grade button but the button is not properly gated by permissions

1.2 WHEN an admin views the student results table in ExamResults.tsx THEN the system does not check `canGradeExams()` permission before rendering the Grade button, allowing users without permission to see it

### Expected Behavior (Correct)

2.1 WHEN an admin with `canGradeExams` permission navigates to the exam results page THEN the system SHALL display the Grade button (pencil icon) in the Actions column for each student attempt

2.2 WHEN an admin without `canGradeExams` permission navigates to the exam results page THEN the system SHALL NOT display the Grade button in the Actions column

2.3 WHEN the Grade button is visible and clicked THEN the system SHALL navigate to the grading page for that student's exam attempt

### Unchanged Behavior (Regression Prevention)

3.1 WHEN an admin with `canDelete('manageExams')` permission views the results table THEN the system SHALL CONTINUE TO display the delete button (Trash icon) in the Actions column

3.2 WHEN an admin views the student results table in AdminAllResults.tsx THEN the system SHALL CONTINUE TO display other action buttons that are already working correctly

3.3 WHEN the page is initially loaded THEN the system SHALL CONTINUE TO load the exam results and student attempts correctly
