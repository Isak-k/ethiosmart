# Results Permissions Management Guide

## Overview
Super Admin can now grant/revoke permissions for viewing and deleting results in the "All Results" page.

## New Permissions Added

### 1. **View All Results** (`viewAllResults`)
- **Purpose**: Controls whether an examiner can see the "All Results" page
- **Location**: Results & Grading section in permission management
- **Default**: Disabled for new examiners (deny-by-default)

### 2. **View Exam Results** (`viewExamResults`)
- **Purpose**: Controls whether an examiner can click the eye icon to view individual exam results
- **Location**: Results & Grading section in permission management
- **Default**: Disabled for new examiners (deny-by-default)

### 3. **Delete Results** (`deleteResults`) - NEW
- **Purpose**: Controls whether an examiner can delete student exam results
- **Location**: Results & Grading section in permission management
- **Default**: Disabled for new examiners (deny-by-default)

## How to Manage Permissions

### Step 1: Go to Manage Examiners
1. Login as Super Admin (isak@gmail.com)
2. Click on **"Manage Examiners"** in the sidebar

### Step 2: Click "Permissions" Button
1. Find the examiner you want to manage
2. Click the **"Permissions"** button (purple button with settings icon)

### Step 3: Grant/Revoke Permissions
In the permission dialog, find the **"Results & Grading"** section:

```
Results & Grading
├── ☐ View All Results      (checkbox to enable/disable)
├── ☐ View Exam Results     (checkbox to enable/disable)
├── ☐ Delete Results        (checkbox to enable/disable)
└── ☐ Export Results        (checkbox to enable/disable)
```

### Step 4: Save Changes
Click **"Save Permissions"** button to apply changes

## Permission Combinations

### Scenario 1: Examiner can only VIEW results
- ✅ View All Results
- ✅ View Exam Results
- ❌ Delete Results
- ✅ Export Results

### Scenario 2: Examiner can VIEW and DELETE results
- ✅ View All Results
- ✅ View Exam Results
- ✅ Delete Results
- ✅ Export Results

### Scenario 3: Examiner has NO access to results
- ❌ View All Results
- ❌ View Exam Results
- ❌ Delete Results
- ❌ Export Results

## Super Admin Capabilities

Super Admin (isak@gmail.com) automatically has:
- ✅ View All Results
- ✅ View Exam Results
- ✅ Delete Results
- ✅ Export Results

Super Admin can:
1. View all exam results in the "All Results" page
2. Click eye icons to view individual exam results
3. Delete any exam result
4. Export results to CSV/PDF
5. Grant/revoke these permissions to other examiners

## Frontend UI Changes

### All Results Page
- **Eye Icon**: Only visible if examiner has "View Exam Results" permission
- **Delete Icon**: Only visible if examiner has "Delete Results" permission
- **Export Button**: Only visible if examiner has "Export Results" permission

### Backend Protection
All delete operations are protected by:
1. Frontend permission check (UI hiding)
2. Backend permission validation (deleteAttemptProtected function)

## Permission Enforcement

### View All Results Page
```
if (canViewAllResults()) {
  // Show All Results page
}
```

### View Individual Results
```
if (canViewExamResults()) {
  // Show eye icon to view results
}
```

### Delete Results
```
if (canDeleteResults()) {
  // Show delete icon
  // Backend validates deleteResults permission
}
```

## Files Modified

- `src/types/permissions.ts` - Added deleteResults permission
- `src/pages/AdminAllResults.tsx` - Uses new permissions
- `src/hooks/useGranularPermissions.ts` - Checks new permissions
- `src/lib/firebase-admin-protected.ts` - Validates deleteResults permission
- `src/pages/ManageExaminers.tsx` - Displays permissions in dialog

## Testing

1. Create a test examiner account
2. Go to Manage Examiners
3. Click "Permissions" for the test examiner
4. Toggle "Delete Results" permission OFF
5. Try to delete a result - should see "User lacks permission to delete results"
6. Toggle "Delete Results" permission ON
7. Try to delete a result - should work successfully
