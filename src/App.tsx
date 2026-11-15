import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OfflineIndicator } from "@/components/ui/offline-indicator";
import { InstallPrompt } from "@/components/ui/install-prompt";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { ThemeProvider } from "@/hooks/use-theme";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { GradingErrorBoundary } from "@/components/admin/GradingErrorBoundary";
import { LibraryErrorBoundary } from "@/components/common/LibraryErrorBoundary";
import { GraduationCap } from "lucide-react";
import "./lib/i18n";

// Dynamic route code-splitting for high-speed mobile performance
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const About = lazy(() => import("./pages/About"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AdminExams = lazy(() => import("./pages/AdminExams"));
const CreateExam = lazy(() => import("./pages/CreateExam"));
const EditExam = lazy(() => import("./pages/EditExam"));
const ExamResults = lazy(() => import("./pages/ExamResults"));
const AdminStudents = lazy(() => import("./pages/AdminStudents"));
const AdminFeedback = lazy(() => import("./pages/AdminFeedback"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const AdminLeaderboardSimple = lazy(() => import("./pages/AdminLeaderboardSimple"));
const AdminAllResults = lazy(() => import("./pages/AdminAllResults"));
const AdminGradeExam = lazy(() => import("./pages/AdminGradeExam"));
const StudentExams = lazy(() => import("./pages/StudentExams"));
const StudentResults = lazy(() => import("./pages/StudentResults"));
const StudentMessages = lazy(() => import("./pages/StudentMessages"));
const ReviewExam = lazy(() => import("./pages/ReviewExam"));
const TakeExam = lazy(() => import("./pages/TakeExam"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const FirebaseTest = lazy(() => import("./pages/FirebaseTest"));
const FirebaseDiagnostic = lazy(() => import("./pages/FirebaseDiagnostic"));
const AdminSetup = lazy(() => import("./pages/AdminSetup"));
const ManageExaminers = lazy(() => import("./pages/ManageExaminers"));
const ManageDepartments = lazy(() => import("./pages/ManageDepartments"));
const MigrateExams = lazy(() => import("./pages/MigrateExams"));
const ExamDiagnostic = lazy(() => import("./pages/ExamDiagnostic"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));
const PermissionTest = lazy(() => import("./pages/PermissionTest"));
const AIStudyAssistant = lazy(() => import("./pages/AIStudyAssistant"));
const PracticeExamResultsPage = lazy(() => import("./pages/PracticeExamResultsPage"));
const StudentSubjects = lazy(() => import("./pages/StudentSubjects"));
const AdminSubjects = lazy(() => import("./pages/AdminSubjects"));
const AdminAIGenerator = lazy(() => import("./pages/AdminAIGenerator"));
const AdminBooks = lazy(() => import("./pages/AdminBooks"));
const AdminShortnotesStudio = lazy(() => import("./pages/AdminShortnotesStudio"));
const StudentBooks = lazy(() => import("./pages/StudentBooks"));
const BookDetails = lazy(() => import("./pages/BookDetails"));
const BookReader = lazy(() => import("./pages/BookReader"));
const AdminSystemSettings = lazy(() => import("./pages/AdminSystemSettings"));
const AdminPayments = lazy(() => import("./pages/AdminPayments"));
const StudentPayment = lazy(() => import("./pages/StudentPayment"));
const StudentVideoTutorials = lazy(() => import("./pages/StudentVideoTutorials"));
const CommunityChat = lazy(() => import("./pages/CommunityChat"));

const PageLoader = () => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
    <div className="relative w-12 h-12 mb-2">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/25 animate-pulse">
        <GraduationCap className="h-6 w-6" />
      </div>
    </div>
    <div className="flex items-center gap-1.5 pt-2">
      <div className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="h-2 w-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="h-2 w-2 rounded-full bg-rose-400 animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  </div>
);

const queryClient = new QueryClient();

function AppRoutes() {
  const { loading } = useAuth();

  // Show loading screen while auth initializes
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white p-4">
        <div className="text-center space-y-6 animate-fade-in max-w-xs mx-auto">
          <div className="relative mx-auto w-24 h-24">
            <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-2xl shadow-sky-500/30 ring-2 ring-white/20 animate-pulse">
              <img
                src="/EthioSmart-192.png"
                alt="EthioSmart"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute inset-0 w-24 h-24 rounded-3xl bg-sky-500 blur-2xl opacity-40 animate-pulse -z-10" />
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-display font-bold tracking-tight text-white">
              Ethio<span className="text-sky-400">Smart</span>
            </h2>
            <p className="text-xs font-medium tracking-widest uppercase text-sky-200/80">
              Learn • Practice • Grow
            </p>
            <p className="text-xs text-slate-400 pt-2">Loading your learning space...</p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="h-2 w-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="h-2 w-2 rounded-full bg-rose-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/about" element={<About />} />
        <Route path="/subjects" element={<StudentSubjects />} />
        <Route path="/firebase-test" element={<FirebaseTest />} />
        <Route path="/firebase-diagnostic" element={<FirebaseDiagnostic />} />
        <Route path="/admin-setup" element={<AdminSetup />} />
        <Route path="/exam-diagnostic" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <ExamDiagnostic />
          </ProtectedRoute>
        } />
        <Route path="/migrate-exams" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <MigrateExams />
          </ProtectedRoute>
        } />
        
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/dashboard/payment" element={<ProtectedRoute allowedRoles={["student"]}><StudentPayment /></ProtectedRoute>} />
          
        {/* Admin Routes - Restricted to Admins; fine-grained via permissions where needed */}
        <Route path="/dashboard/admin/payments" element={<ProtectedRoute allowedRoles={["admin"]} requireAnyPermissions={["managePayments"]}><AdminPayments /></ProtectedRoute>} />
        <Route path="/dashboard/admin/ai-generator" element={<ProtectedRoute allowedRoles={["admin"]}><AdminAIGenerator /></ProtectedRoute>} />
        <Route path="/dashboard/admin/ai-settings" element={<Navigate to="/dashboard/admin/ai-generator?tab=settings" replace />} />
        <Route path="/dashboard/admin/exams" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminExams />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/exams/new" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <CreateExam />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/exams/:id/edit" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <EditExam />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/exams/:examId/results" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <ExamResults />
          </ProtectedRoute>
        } />
        
        {/* Only true admins can manage students and system-wide analytics */}
        <Route path="/dashboard/students" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminStudents />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/feedback" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminFeedback />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/examiners" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <ManageExaminers />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/admin/subjects" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminSubjects />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/admin/books" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <LibraryErrorBoundary fallbackTitle="Admin Books Management Notice">
              <AdminBooks />
            </LibraryErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/dashboard/admin/shortnotes/create" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminShortnotesStudio />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/admin/shortnotes/edit/:id" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminShortnotesStudio />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/departments" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <ManageDepartments />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/all-results" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminAllResults />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/admin/grade/:attemptId" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <GradingErrorBoundary>
              <AdminGradeExam />
            </GradingErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/dashboard/analytics" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminAnalytics />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/leaderboard-admin" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLeaderboardSimple />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/super-admin" element={
          <ProtectedRoute allowedRoles={["admin"]} requireSuperAdmin>
            <SuperAdmin />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/permission-test" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <PermissionTest />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/admin/settings" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminSystemSettings />
          </ProtectedRoute>
        } />
        
        {/* Student Routes */}
        <Route path="/dashboard/subjects" element={
          <ProtectedRoute allowedRoles={["student", "admin"]}>
            <StudentSubjects />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/exams" element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentExams />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/books" element={
          <ProtectedRoute allowedRoles={["student", "admin"]}>
            <LibraryErrorBoundary fallbackTitle="Academic Library Notice">
              <StudentBooks />
            </LibraryErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/dashboard/books/:bookId" element={
          <ProtectedRoute allowedRoles={["student", "admin"]}>
            <LibraryErrorBoundary fallbackTitle="Book Details Notice">
              <BookDetails />
            </LibraryErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/dashboard/books/:bookId/read" element={
          <ProtectedRoute allowedRoles={["student", "admin"]}>
            <LibraryErrorBoundary fallbackTitle="Reader Notice">
              <BookReader />
            </LibraryErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/dashboard/results" element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentResults />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/messages" element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentMessages />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/community" element={
          <ProtectedRoute allowedRoles={["student", "admin"]}>
            <CommunityChat />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/ai-assistant" element={
          <ProtectedRoute allowedRoles={["student","admin"]}>
            <AIStudyAssistant />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/video-tutorials" element={
          <ProtectedRoute allowedRoles={["student", "admin"]}>
            <StudentVideoTutorials />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/results/:attemptId/review" element={
          <ProtectedRoute allowedRoles={["student"]}>
            <ReviewExam />
          </ProtectedRoute>
        } />
        <Route path="/exam/:id" element={
          <ProtectedRoute allowedRoles={["student"]}>
            <TakeExam />
          </ProtectedRoute>
        } />
        
        {/* Practice Exam Results Routes */}
        <Route path="/dashboard/practice-results/:attemptId" element={
          <ProtectedRoute allowedRoles={["student"]}>
            <PracticeExamResultsPage />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/exam-results/:attemptId" element={
          <ProtectedRoute allowedRoles={["student"]}>
            <PracticeExamResultsPage />
          </ProtectedRoute>
        } />

        {/* Friendly Book & Study Notes Navigation Aliases (Prevent 404s) */}
        <Route path="/books" element={<Navigate to="/dashboard/books" replace />} />
        <Route path="/books/:bookId" element={<Navigate to="/dashboard/books/:bookId" replace />} />
        <Route path="/books/:bookId/read" element={<Navigate to="/dashboard/books/:bookId/read" replace />} />
        <Route path="/shortnotes" element={<Navigate to="/dashboard/books" replace />} />
        <Route path="/dashboard/shortnotes" element={<Navigate to="/dashboard/books" replace />} />
        <Route path="/dashboard/admin/shortnotes" element={<Navigate to="/dashboard/admin/shortnotes/create" replace />} />
        <Route path="/admin/books" element={<Navigate to="/dashboard/admin/books" replace />} />
        <Route path="/admin/shortnotes" element={<Navigate to="/dashboard/admin/shortnotes/create" replace />} />
        <Route path="/admin/ai-generator" element={<Navigate to="/dashboard/admin/ai-generator" replace />} />
        <Route path="/exams" element={<Navigate to="/dashboard/exams" replace />} />
        <Route path="/admin/exams" element={<Navigate to="/dashboard/admin/exams" replace />} />
        <Route path="/admin/login" element={<Navigate to="/auth?role=admin" replace />} />
        <Route path="/admin" element={<Navigate to="/auth?role=admin" replace />} />
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <PermissionsProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <OfflineIndicator />
            <InstallPrompt />
            <AppRoutes />
          </TooltipProvider>
        </PermissionsProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
