import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { StudentDashboard } from "@/components/dashboard/StudentDashboard";
import { Loader2 } from "lucide-react";

const Dashboard = () => {
  const { role, loading, isGuest } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Students and guest users open on exam page by default
    if (!loading && (isGuest || role === "student")) {
      navigate("/dashboard/exams", { replace: true });
    }
  }, [loading, isGuest, role, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      {role === "admin" ? <AdminDashboard /> : <StudentDashboard />}
    </DashboardLayout>
  );
};

export default Dashboard;
