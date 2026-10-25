import { useLocation, Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { GraduationCap, ArrowLeft, Home, BookOpen, LayoutDashboard } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.warn("404 Notice: User navigated to route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-cyan-50/20 to-teal-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4 font-sans">
      <div className="text-center max-w-md w-full p-8 rounded-3xl border bg-card/90 shadow-xl backdrop-blur-sm space-y-6 animate-fade-in">
        <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-teal-500 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/25">
          <GraduationCap className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <span className="text-4xl font-extrabold font-display bg-gradient-to-r from-primary to-teal-600 bg-clip-text text-transparent block">
            404
          </span>
          <h1 className="text-xl font-bold text-foreground">
            Page Not Found
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            The page you requested <code className="px-1.5 py-0.5 rounded-md bg-muted text-foreground text-xs">{location.pathname}</code> does not exist or may have moved.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
          <Button
            asChild
            variant="default"
            className="rounded-xl text-xs h-10 font-semibold shadow-xs"
          >
            <Link to="/dashboard">
              <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" />
              My Dashboard
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="rounded-xl text-xs h-10 font-semibold"
          >
            <Link to="/dashboard/books">
              <BookOpen className="h-3.5 w-3.5 mr-1.5" />
              Books & Notes
            </Link>
          </Button>
        </div>

        <div className="pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="rounded-xl text-xs text-muted-foreground hover:text-foreground h-8"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Go back to previous page
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
