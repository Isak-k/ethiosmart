# Permission System - Quick Reference Guide

## For Super Admin

### How to Grant Permissions to an Examiner

1. Go to **Manage Examiners** page
2. Find the examiner in the list
3. Click **"Permissions"** button
4. A dialog opens with 28 permissions in 8 groups
5. Check/uncheck permissions as needed
6. Click **"Save Permissions"**
7. Permissions take effect immediately

### Permission Groups

| Group | Permissions | Use Case |
|-------|-------------|----------|
| Dashboard & Navigation | View Dashboard | Basic access |
| Exam Management | Create, Edit, Delete, Publish, View, Disable | Manage exams |
| Student Management | View, Add, Edit, Delete, Disable | Manage students |
| Departments | View, Create, Edit, Delete | Manage departments |
| Results & Grading | View, Export | View and export results |
| Feedback | View, Reply, Delete | Manage student feedback |
| Leaderboard | View, Manage | View and manage leaderboard |
| Examiner Management | View, Add, Edit, Delete, Enable/Disable | Super Admin only |

### Common Permission Sets

**Exam Creator**
- View Dashboard
- Create Exams, Edit Exams, Delete Exams, Publish Exams, View All Exams

**Student Manager**
- View Students, Add Students, Edit Students, Delete Students
- View Departments, Create Departments, Edit Departments, Delete Departments

**Results Reviewer**
- View All Results, Export Results

**Feedback Manager**
- View Feedback, Reply to Feedback, Delete Feedback

**Full Admin** (except Super Admin features)
- All permissions except Examiner Management and Disable features

---

## For Examiners

### What You Can See

Your sidebar shows only the features you have permission for:

- **Dashboard** - Always visible if you have `viewDashboard`
- **Manage Exams** - Visible if you have exam permissions
- **All Results** - Visible if you have result permissions
- **Students** - Visible if you have student permissions
- **Feedback** - Visible if you have feedback permissions
- **Leaderboard Admin** - Visible if you have leaderboard permissions
- **Departments** - Visible if you have department permissions
- **AI Study Assistant** - Always visible
- **Super Admin** - Only for Super Admin

### What You Can Do

Within each page, you can only see and use buttons for actions you have permission for:

- **Create button** - Only if you have create permission
- **Edit button** - Only if you have edit permission
- **Delete button** - Only if you have delete permission
- **Disable button** - Only if you have disable permission
- **Export button** - Only if you have export permission
- **Reply button** - Only if you have reply permission

### If You Don't Have Permission

- Menu item is hidden from sidebar
- Page shows "Permission Denied" message
- Buttons are hidden or disabled
- You cannot access the feature even by typing URL

---

## Permission Hierarchy

### Super Admin (isak@gmail.com)
- Has ALL 28 permissions
- Can manage all examiners' permissions
- Can access all features

### Full Admin
- Has most permissions
- Cannot manage examiners
- Cannot disable exams/students
- Cannot manage feedback

### Regular Examiner
- Has only permissions granted by Super Admin
- Starts with NO permissions
- Can only access granted features

---

## Common Tasks

### Task: Let Examiner Create Exams
1. Go to Manage Examiners
2. Click Permissions on examiner
3. Check: `Create Exams`, `Edit Exams`, `Delete Exams`, `Publish Exams`, `View All Exams`
4. Save

### Task: Let Examiner View Results Only
1. Go to Manage Examiners
2. Click Permissions on examiner
3. Check: `View All Results`
4. Save

### Task: Let Examiner Manage Students
1. Go to Manage Examiners
2. Click Permissions on examiner
3. Check: `View Students`, `Add Students`, `Edit Students`, `Delete Students`
4. Save

### Task: Let Examiner Reply to Feedback
1. Go to Manage Examiners
2. Click Permissions on examiner
3. Check: `View Feedback`, `Reply to Feedback`
4. Save

### Task: Remove All Permissions
1. Go to Manage Examiners
2. Click Permissions on examiner
3. Uncheck ALL permissions
4. Save
5. Examiner can only see Dashboard and AI Study Assistant

---

## Troubleshooting

### "Permission Denied" Message
- You don't have permission for this feature
- Ask Super Admin to grant permission
- Check Manage Examiners > Permissions

### Button is Hidden
- You don't have permission for that action
- Ask Super Admin to grant permission
- Check which permission is needed

### Cannot Access Page by URL
- Backend is blocking access
- You don't have permission
- Ask Super Admin to grant permission

### Permissions Not Updated
- Clear browser cache
- Logout and login again
- Permissions take effect immediately after save

---

## Permission Reference

### Exam Management
- `viewAllExams` - See all exams
- `createExams` - Create new exams
- `editExams` - Edit exams
- `deleteExams` - Delete exams
- `publishExams` - Publish/unpublish exams
- `disableExams` - Disable/enable exams

### Student Management
- `viewStudents` - See all students
- `addStudents` - Create students
- `editStudents` - Edit student info
- `deleteStudents` - Delete students
- `disableStudents` - Disable/enable students

### Results
- `viewAllResults` - See all results
- `exportResults` - Export to CSV/PDF

### Feedback
- `viewFeedback` - See feedback messages
- `replyFeedback` - Reply to feedback
- `deleteFeedback` - Delete feedback

### Departments
- `viewDepartments` - See departments
- `createDepartments` - Create departments
- `editDepartments` - Edit departments
- `deleteDepartments` - Delete departments

### Leaderboard
- `viewLeaderboard` - See leaderboard
- `manageLeaderboard` - Manage leaderboard

### Examiner Management (Super Admin Only)
- `viewExaminers` - See examiners
- `addExaminers` - Create examiners
- `editExaminerPermissions` - Edit permissions
- `deleteExaminers` - Delete examiners
- `enableDisableExaminers` - Enable/disable examiners

### Dashboard
- `viewDashboard` - Access dashboard

---

## Key Points

✅ **Deny by Default** - New examiners have NO permissions
✅ **Super Admin Controls** - Only Super Admin can grant permissions
✅ **Two-Layer Protection** - Frontend + Backend
✅ **Immediate Effect** - Permissions take effect right away
✅ **No Bypass** - Cannot access by URL without permission
✅ **Clear Feedback** - "Permission Denied" message if blocked
✅ **Organized** - 28 permissions in 8 logical groups
✅ **Full CRUD** - Create, Read, Update, Delete for each feature

---

**Last Updated**: March 10, 2026
**Version**: 1.0

