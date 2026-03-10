// Permission types for Role-Based Access Control (RBAC)

export interface UserPermissions {
  // Dashboard & Navigation
  viewDashboard: boolean;
  
  // Exam Management (Full CRUD)
  createExams: boolean;
  editExams: boolean;
  deleteExams: boolean;
  publishExams: boolean;
  viewAllExams: boolean;
  
  // Results & Grading
  viewAllResults: boolean;
  exportResults: boolean;
  
  // Student Management (Full CRUD)
  viewStudents: boolean;
  addStudents: boolean;
  editStudents: boolean;
  deleteStudents: boolean;
  
  // Departments (Full CRUD)
  viewDepartments: boolean;
  createDepartments: boolean;
  editDepartments: boolean;
  deleteDepartments: boolean;
  
  // Leaderboard
  viewLeaderboard: boolean;
  manageLeaderboard: boolean;
  
  // Examiner Management (Super Admin only)
  viewExaminers: boolean;
  addExaminers: boolean;
  editExaminerPermissions: boolean;
  deleteExaminers: boolean;
  enableDisableExaminers: boolean;
}

export type PermissionKey = keyof UserPermissions;

export const DEFAULT_PERMISSIONS: UserPermissions = {
  viewDashboard: true,
  createExams: true,
  editExams: true,
  deleteExams: true,
  publishExams: true,
  viewAllExams: true,
  viewStudents: true,
  addStudents: false,
  editStudents: false,
  deleteStudents: false,
  viewDepartments: true,
  createDepartments: false,
  editDepartments: false,
  deleteDepartments: false,
  viewAllResults: false,
  exportResults: true,
  viewLeaderboard: true,
  manageLeaderboard: false,
  viewExaminers: false,
  addExaminers: false,
  editExaminerPermissions: false,
  deleteExaminers: false,
  enableDisableExaminers: false,
};

// Restricted permissions for newly created examiners (deny by default)
export const RESTRICTED_PERMISSIONS: UserPermissions = {
  viewDashboard: false,
  createExams: false,
  editExams: false,
  deleteExams: false,
  publishExams: false,
  viewAllExams: false,
  viewStudents: false,
  addStudents: false,
  editStudents: false,
  deleteStudents: false,
  viewDepartments: false,
  createDepartments: false,
  editDepartments: false,
  deleteDepartments: false,
  viewAllResults: false,
  exportResults: false,
  viewLeaderboard: false,
  manageLeaderboard: false,
  viewExaminers: false,
  addExaminers: false,
  editExaminerPermissions: false,
  deleteExaminers: false,
  enableDisableExaminers: false,
};

export const FULL_ADMIN_PERMISSIONS: UserPermissions = {
  viewDashboard: true,
  createExams: true,
  editExams: true,
  deleteExams: true,
  publishExams: true,
  viewAllExams: true,
  viewStudents: true,
  addStudents: true,
  editStudents: true,
  deleteStudents: true,
  viewDepartments: true,
  createDepartments: true,
  editDepartments: true,
  deleteDepartments: true,
  viewAllResults: true,
  exportResults: true,
  viewLeaderboard: true,
  manageLeaderboard: true,
  viewExaminers: false,
  addExaminers: false,
  editExaminerPermissions: false,
  deleteExaminers: false,
  enableDisableExaminers: false,
};

export const SUPER_ADMIN_PERMISSIONS: UserPermissions = {
  ...FULL_ADMIN_PERMISSIONS,
  viewExaminers: true,
  addExaminers: true,
  editExaminerPermissions: true,
  deleteExaminers: true,
  enableDisableExaminers: true,
};

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  viewDashboard: 'View Dashboard',
  createExams: 'Create Exams',
  editExams: 'Edit Exams',
  deleteExams: 'Delete Exams',
  publishExams: 'Publish/Unpublish Exams',
  viewAllExams: 'View All Exams',
  viewStudents: 'View Students',
  addStudents: 'Add Students',
  editStudents: 'Edit Students',
  deleteStudents: 'Delete Students',
  viewDepartments: 'View Departments',
  createDepartments: 'Create Departments',
  editDepartments: 'Edit Departments',
  deleteDepartments: 'Delete Departments',
  viewAllResults: 'View All Results',
  exportResults: 'Export Results',
  viewLeaderboard: 'View Leaderboard',
  manageLeaderboard: 'Manage Leaderboard',
  viewExaminers: 'View Examiners',
  addExaminers: 'Add Examiners',
  editExaminerPermissions: 'Edit Examiner Permissions',
  deleteExaminers: 'Delete Examiners',
  enableDisableExaminers: 'Enable/Disable Examiners',
};

export const PERMISSION_GROUPS = {
  'Dashboard & Navigation': ['viewDashboard'] as PermissionKey[],
  'Exam Management': [
    'createExams',
    'editExams',
    'deleteExams',
    'publishExams',
    'viewAllExams',
  ] as PermissionKey[],
  'Student Management': [
    'viewStudents',
    'addStudents',
    'editStudents',
    'deleteStudents',
  ] as PermissionKey[],
  'Departments': [
    'viewDepartments',
    'createDepartments',
    'editDepartments',
    'deleteDepartments',
  ] as PermissionKey[],
  'Results & Grading': [
    'viewAllResults',
    'exportResults',
  ] as PermissionKey[],
  'Leaderboard': ['viewLeaderboard', 'manageLeaderboard'] as PermissionKey[],
  'Examiner Management': [
    'viewExaminers',
    'addExaminers',
    'editExaminerPermissions',
    'deleteExaminers',
    'enableDisableExaminers',
  ] as PermissionKey[],
};

// Super Admin email - hardcoded for security
export const SUPER_ADMIN_EMAIL = 'isak@gmail.com';
