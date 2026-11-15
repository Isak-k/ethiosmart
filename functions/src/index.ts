import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Export functions
export {
  calculateDepartmentLeaderboard,
  calculateGlobalDepartmentLeaderboard,
  onExamAttemptUpdate,
  onUserProfileUpdate,
  refreshStaleCaches
} from './leaderboard';

export {
  generateAIExamBatch,
  getAIProviderStatus
} from './ai-generator';

export {
  validateGoogleDriveResource
} from './books';

export {
  askEthioSmartAssistant
} from './chatbot';

export {
  getPaymentSettings,
  createReceiptUploadSignature,
  submitPayment,
  getMyPayment,
  getPaymentAdminData,
  reviewPayment,
  savePaymentSettings,
  grantLifetimePaymentAccess
} from './payments';

export {
  getStudentBookCatalog,
  getStudentBook,
  getStudentExamQuestions
} from './content-access';
