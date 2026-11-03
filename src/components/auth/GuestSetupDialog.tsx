import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getDepartments } from '@/lib/departments';
import { Department } from '@/integrations/firebase/types';
import { saveGuestProfile, getStoredGuestProfile, isGuestProfileComplete, GuestProfile } from '@/lib/guest-session';
import { GraduationCap, ArrowRight, Building, User, Sparkles, Shield, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GuestSetupDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onCompleted?: (profile: GuestProfile) => void;
  allowCloseWithoutSave?: boolean;
}

export function GuestSetupDialog({
  open,
  onOpenChange,
  onCompleted,
  allowCloseWithoutSave = false,
}: GuestSetupDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);

  const existingProfile = getStoredGuestProfile();
  const [fullName, setFullName] = useState(existingProfile?.full_name || '');
  const [selectedDeptId, setSelectedDeptId] = useState(existingProfile?.departmentId || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getDepartments()
      .then((depts) => {
        if (active) {
          setDepartments(depts);
        }
      })
      .catch((err) => {
        console.warn('Could not load departments for guest setup:', err);
      })
      .finally(() => {
        if (active) setLoadingDepts(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim() || 'Guest Student';

    if (!selectedDeptId) {
      toast({
        title: 'Department required',
        description: 'Please select your department to see relevant exams and study notes.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const chosenDept = departments.find((d) => d.id === selectedDeptId);

    const saved = saveGuestProfile({
      full_name: cleanName,
      departmentId: selectedDeptId,
      departmentName: chosenDept?.name || '',
    });

    toast({
      title: `Welcome!`,
      description: `You are now browsing ${chosenDept?.name || 'your department'} materials.`,
    });

    setSaving(false);
    onOpenChange?.(false);
    onCompleted?.(saved);
  };

  const handleAdminSignIn = () => {
    onOpenChange?.(false);
    navigate('/auth?role=admin');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (allowCloseWithoutSave) {
        onOpenChange?.(v);
      }
    }}>
      <DialogContent
        className="w-[92vw] sm:max-w-md rounded-3xl p-6 sm:p-7 border bg-card/95 backdrop-blur-md shadow-2xl"
        onPointerDownOutside={(e) => {
          if (!allowCloseWithoutSave) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (!allowCloseWithoutSave) e.preventDefault();
        }}
      >
        <DialogHeader className="space-y-2 text-center items-center pb-2">
          {/* Logo Badge */}
          <div className="h-13 w-13 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/25 mb-1">
            <GraduationCap className="h-7 w-7" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Sparkles className="h-3 w-3" />
            Quick Student Setup
          </div>

          <DialogTitle className="text-xl sm:text-2xl font-display font-bold text-foreground">
            Welcome to EthioSmart
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Select your department to explore textbooks, chapter notes, and practice exams.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Department Selector (Primary) */}
          <div className="space-y-1.5 text-left">
            <Label htmlFor="guest-dept" className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5 text-purple-600" />
              <span>Academic Department</span>
            </Label>
            <Select
              value={selectedDeptId}
              onValueChange={setSelectedDeptId}
              disabled={loadingDepts}
            >
              <SelectTrigger id="guest-dept" className="rounded-xl h-10 text-xs sm:text-sm bg-background/80">
                <SelectValue placeholder={loadingDepts ? "Loading departments..." : "Select your department"} />
              </SelectTrigger>
              <SelectContent className="max-h-60 rounded-xl">
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id} className="text-xs sm:text-sm py-2">
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Full Name Field (Optional) */}
          <div className="space-y-1.5 text-left">
            <div className="flex items-center justify-between">
              <Label htmlFor="guest-name" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-purple-600" />
                <span>Your Name</span>
              </Label>
              <span className="text-[10px] text-muted-foreground font-medium">Optional</span>
            </div>
            <Input
              id="guest-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Guest Student (or enter your name)"
              className="rounded-xl h-10 text-xs sm:text-sm bg-background/80"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="w-full h-11 rounded-xl font-bold text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group"
            >
              <span>Start Taking Exams & Reading</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Admin portal backdoor link */}
          <div className="pt-2 text-center border-t border-border/50">
            <button
              type="button"
              onClick={handleAdminSignIn}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-purple-600 dark:hover:text-purple-400 font-semibold transition-colors py-1"
            >
              <Shield className="h-3 w-3" />
              <span>Are you an Administrator? Sign in here</span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
