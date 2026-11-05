import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDepartments } from "@/lib/departments";
import { getCachedDefaultDepartmentId } from "@/lib/system-settings";
import { Department } from "@/integrations/firebase/types";
import { useTranslation } from "react-i18next";
import { Building, Loader2, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface GoogleProfileSetupProps {
  email: string;
  displayName: string;
  onComplete: (fullName: string, departmentId: string) => void;
  loading: boolean;
}

export function GoogleProfileSetup({ email, displayName, onComplete, loading }: GoogleProfileSetupProps) {
  const { t } = useTranslation();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [fullName, setFullName] = useState<string>(displayName || "");
  const [errors, setErrors] = useState<{ name?: string; department?: string }>({});

  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const data = await getDepartments();
        setDepartments(data);
        const defaultDeptId = getCachedDefaultDepartmentId();
        if (defaultDeptId && data.some((d) => d.id === defaultDeptId)) {
          setSelectedDept(defaultDeptId);
        } else if (data.length > 0 && !selectedDept) {
          setSelectedDept(data[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch departments", error);
      } finally {
        setLoadingDepts(false);
      }
    };
    fetchDepts();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate full name
    if (!fullName.trim()) {
      setErrors(prev => ({ ...prev, name: t("common.fullName") + " is required" }));
      return;
    }

    if (fullName.trim().length < 2) {
      setErrors(prev => ({ ...prev, name: "Name must be at least 2 characters" }));
      return;
    }

    // Validate department
    if (!selectedDept) {
      setErrors(prev => ({ ...prev, department: t("common.selectDepartment") }));
      return;
    }

    onComplete(fullName.trim(), selectedDept);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1.5">
        <h3 className="text-2xl font-display font-bold">Complete Your Profile</h3>
        <p className="text-muted-foreground text-xs sm:text-sm">
          Welcome! Please complete your profile to continue.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs sm:text-sm font-semibold pl-1">Email</Label>
          <div className="px-5 py-3 rounded-full liquid-glass-input">
            <p className="text-sm font-medium">{email}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="full-name" className="text-xs sm:text-sm font-semibold pl-1">
            {t("common.fullName")} *
          </Label>
          <div className="relative group">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-sky-500 transition-colors z-10" />
            <Input
              id="full-name"
              type="text"
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setErrors(prev => ({ ...prev, name: undefined }));
              }}
              className={cn(
                "pl-12 h-12 rounded-full liquid-glass-input text-sm",
                errors.name && "border-red-500"
              )}
              required
            />
          </div>
          {errors.name && (
            <p className="text-xs text-red-500 pl-3 flex items-center gap-1">
              <span>⚠</span> {errors.name}
            </p>
          )}
          <p className="text-xs text-muted-foreground pl-3">
            You can edit this if needed
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dept-select" className="text-xs sm:text-sm font-semibold pl-1">
            {t("common.department")} *
          </Label>
          <div className="relative group">
            <Building className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-sky-500 transition-colors z-10" />
            <Select value={selectedDept} onValueChange={(v) => {
              setSelectedDept(v);
              setErrors(prev => ({ ...prev, department: undefined }));
            }}>
              <SelectTrigger className={cn(
                "pl-12 h-12 rounded-full liquid-glass-input text-sm",
                errors.department && "border-red-500"
              )}>
                <SelectValue placeholder={t("common.selectDepartment")} />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border border-white/20 backdrop-blur-xl bg-card/95">
                {loadingDepts ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">{t("common.loading")}</div>
                ) : departments.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">{t("common.noDepartments")}</div>
                ) : (
                  departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id} className="rounded-xl">
                      {dept.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          {errors.department && (
            <p className="text-xs text-red-500 pl-3 flex items-center gap-1">
              <span>⚠</span> {errors.department}
            </p>
          )}
        </div>

        <button
          type="submit"
          className="w-full h-12 rounded-full liquid-glass-button text-sm sm:text-base font-semibold flex items-center justify-center shadow-lg mt-2"
          disabled={loading || loadingDepts}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Setting up...
            </>
          ) : (
            "Complete Setup"
          )}
        </button>
      </form>
    </div>
  );
}
