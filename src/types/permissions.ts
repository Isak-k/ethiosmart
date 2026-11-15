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
  disableExams: boolean;
  
  // Results & Grading
  viewAllResults: boolean;
  viewExamResults: boolean;
  deleteResults: boolean;
  exportResults: boolean;
  gradeExams: boolean;
  
  // Student Management (Full CRUD)
  viewStudents: boolean;
  addStudents: boolean;
  editStudents: boolean;
  deleteStudents: boolean;
  disableStudents: boolean;
  
  // Departments (Full CRUD)
  viewDepartments: boolean;
  createDepartments: boolean;
  editDepartments: boolean;
  deleteDepartments: boolean;
  
  // Feedback
  viewFeedback: boolean;
  replyFeedback: boolean;
  deleteFeedback: boolean;
  
  // AI Study Assistant
  viewAIAssistant: boolean;
  
  // Leaderboard
  viewLeaderboard: boolean;
  manageLeaderboard: boolean;
  
  // Payment review access for selected administrators
  managePayments: boolean;
  
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
  disableExams: false,
  viewStudents: true,
  addStudents: false,
  editStudents: false,
  deleteStudents: false,
  disableStudents: false,
  viewDepartments: true,
  createDepartments: false,
  editDepartments: false,
  deleteDepartments: false,
  viewAllResults: false,
  viewExamResults: false,
  deleteResults: false,
  exportResults: true,
  gradeExams: true,
  viewFeedback: false,
  replyFeedback: false,
  deleteFeedback: false,
  viewAIAssistant: false,
  viewLeaderboard: true,
  manageLeaderboard: false,
  viewExaminers: false,
  addExaminers: false,
  editExaminerPermissions: false,
  deleteExaminers: false,
  enableDisableExaminers: false,
  managePayments: false,
};

// Restricted permissions for newly created examiners (deny by default)
export const RESTRICTED_PERMISSIONS: UserPermissions = {
  viewDashboard: false,
  createExams: false,
  editExams: false,
  deleteExams: false,
  publishExams: false,
  viewAllExams: false,
  disableExams: false,
  viewStudents: false,
  addStudents: false,
  editStudents: false,
  deleteStudents: false,
  disableStudents: false,
  viewDepartments: false,
  createDepartments: false,
  editDepartments: false,
  deleteDepartments: false,
  viewAllResults: false,
  viewExamResults: false,
  deleteResults: false,
  exportResults: false,
  gradeExams: false,
  viewFeedback: false,
  replyFeedback: false,
  deleteFeedback: false,
  viewAIAssistant: false,
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
  disableExams: false,
  viewStudents: true,
  addStudents: true,
  editStudents: true,
  deleteStudents: true,
  disableStudents: false,
  viewDepartments: true,
  createDepartments: true,
  editDepartments: true,
  deleteDepartments: true,
  viewAllResults: true,
  viewExamResults: false,
  deleteResults: false,
  exportResults: true,
  gradeExams: true,
  viewFeedback: false,
  replyFeedback: false,
  deleteFeedback: false,
  viewAIAssistant: false,
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
  disableExams: true,
  disableStudents: true,
  viewFeedback: true,
  replyFeedback: true,
  deleteFeedback: true,
  viewAIAssistant: true,
  viewExaminers: true,
  addExaminers: true,
  editExaminerPermissions: true,
  deleteExaminers: true,
  enableDisableExaminers: true,
  managePayments: true,
  viewExamResults: true,
  deleteResults: true,
  gradeExams: true,
};

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  viewDashboard: 'View Dashboard',
  createExams: 'Create Exams',
  editExams: 'Edit Exams',
  deleteExams: 'Delete Exams',
  publishExams: 'Publish/Unpublish Exams',
  viewAllExams: 'View All Exams',
  disableExams: 'Disable/Enable Exams',
  viewStudents: 'View Students',
  addStudents: 'Add Students',
  editStudents: 'Edit Students',
  deleteStudents: 'Delete Students',
  disableStudents: 'Disable/Enable Students',
  viewDepartments: 'View Departments',
  createDepartments: 'Create Departments',
  editDepartments: 'Edit Departments',
  deleteDepartments: 'Delete Departments',
  viewAllResults: 'View All Results',
  viewExamResults: 'View Exam Results',
  deleteResults: 'Delete Results',
  exportResults: 'Export Results',
  gradeExams: 'Grade Exams',
  viewFeedback: 'View Feedback',
  replyFeedback: 'Reply to Feedback',
  deleteFeedback: 'Delete Feedback',
  viewAIAssistant: 'View AI Study Assistant',
  viewLeaderboard: 'View Leaderboard',
  manageLeaderboard: 'Manage Leaderboard',
  viewExaminers: 'View Examiners',
  addExaminers: 'Add Examiners',
  editExaminerPermissions: 'Edit Examiner Permissions',
  deleteExaminers: 'Delete Examiners',
  enableDisableExaminers: 'Enable/Disable Examiners',
  managePayments: 'Review Payments',
};

export const PERMISSION_GROUPS = {
  'Dashboard & Navigation': ['viewDashboard'] as PermissionKey[],
  'Exam Management': [
    'createExams',
    'editExams',
    'deleteExams',
    'publishExams',
    'viewAllExams',
    'disableExams',
  ] as PermissionKey[],
  'Student Management': [
    'viewStudents',
    'addStudents',
    'editStudents',
    'deleteStudents',
    'disableStudents',
  ] as PermissionKey[],
  'Departments': [
    'viewDepartments',
    'createDepartments',
    'editDepartments',
    'deleteDepartments',
  ] as PermissionKey[],
  'Results & Grading': [
    'viewAllResults',
    'viewExamResults',
    'deleteResults',
    'exportResults',
    'gradeExams',
  ] as PermissionKey[],
  'Feedback': [
    'viewFeedback',
    'replyFeedback',
    'deleteFeedback',
  ] as PermissionKey[],
  'AI Study Assistant': [
    'viewAIAssistant',
  ] as PermissionKey[],
  'Leaderboard': ['viewLeaderboard', 'manageLeaderboard'] as PermissionKey[],
  'Payment Management': ['managePayments'] as PermissionKey[],
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
