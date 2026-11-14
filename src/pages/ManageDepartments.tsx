import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Building, Pencil, Star, Sparkles, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { getDepartments, createDepartment, deleteDepartment, updateDepartment, updateDepartmentVisibility } from "@/lib/departments";
import { Department } from "@/integrations/firebase/types";
import { useSectionPermissions } from "@/hooks/useSectionPermissions";
import { 
  setDefaultDepartment, 
  getCachedDefaultDepartmentId, 
  subscribeToSystemSettings,
  updateSystemSettings,
  getCachedHideDepartmentOnSignup
} from "@/lib/system-settings";

export default function ManageDepartments() {
  const { role, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canEdit, canDelete } = useSectionPermissions();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");

  // Default Department state
  const [defaultDeptId, setDefaultDeptId] = useState<string | null>(getCachedDefaultDepartmentId());
  const [savingDefault, setSavingDefault] = useState(false);

  // Hide department selector on signup state
  const [hideDepartmentOnSignup, setHideDepartmentOnSignup] = useState<boolean>(getCachedHideDepartmentOnSignup());
  const [savingHideDept, setSavingHideDept] = useState(false);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editName, setEditName] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (role !== "admin") {
      navigate("/dashboard");
      return;
    }
    fetchDepartments();

    // Subscribe to system settings to keep default department state live
    const unsub = subscribeToSystemSettings((settings) => {
      setDefaultDeptId(settings.defaultDepartmentId ?? null);
      setHideDepartmentOnSignup(!!settings.hideDepartmentOnSignup);
    });
    return () => unsub();
  }, [role, navigate]);

  const fetchDepartments = async () => {
    try {
      const data = await getDepartments();
      setDepartments(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch departments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefaultDepartment = async (deptId: string | null, deptName?: string | null) => {
    setSavingDefault(true);
    try {
      await setDefaultDepartment(deptId, deptName || null, profile?.user_id || 'admin');
      setDefaultDeptId(deptId);
      toast({
        title: deptId ? "Default Department Set" : "Default Department Cleared",
        description: deptId 
          ? `"${deptName || 'Selected'}" curriculum will now open directly by default for all visitors and students without prompting.`
          : "Standard per-user department selection restored.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update default department",
        variant: "destructive",
      });
    } finally {
      setSavingDefault(false);
    }
  };

  const handleToggleHideDepartmentOnSignup = async () => {
    const next = !hideDepartmentOnSignup;
    setSavingHideDept(true);
    try {
      await updateSystemSettings({ hideDepartmentOnSignup: next }, profile?.user_id || 'admin');
      setHideDepartmentOnSignup(next);
      toast({
        title: next ? "Department Selector Hidden" : "Department Selector Visible",
        description: next
          ? "Students will sign up using the default department set above."
          : "Students can now choose their department during sign up.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update setting",
        variant: "destructive",
      });
    } finally {
      setSavingHideDept(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    
    setCreating(true);
    try {
      await createDepartment(newDeptName.trim());
      toast({
        title: "Success",
        description: "Department created successfully",
      });
      setCreateOpen(false);
      setNewDeptName("");
      fetchDepartments();
    } catch (error: any) {
      console.error("Create department error:", error);
      let message = error.message || "Failed to create department";
      
      if (error.code === 'permission-denied') {
        message = "Permission denied. Please ask the administrator to update Firestore Security Rules to allow department management.";
      }
      
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept || !editName.trim()) return;
    
    setUpdating(true);
    try {
      await updateDepartment(editingDept.id, editName.trim());
      toast({
        title: "Success",
        description: "Department updated successfully",
      });
      setEditOpen(false);
      setEditName("");
      setEditingDept(null);
      fetchDepartments();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update department",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This might affect users assigned to this department.")) return;
    
    try {
      await deleteDepartment(id);
      if (defaultDeptId === id) {
        await handleSetDefaultDepartment(null, null);
      }
      toast({
        title: "Success",
        description: "Department deleted successfully",
      });
      fetchDepartments();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete department",
        variant: "destructive",
      });
    }
  };

  const handleToggleVisibility = async (dept: Department) => {
    const nextHidden = !dept.hidden;
    try {
      await updateDepartmentVisibility(dept.id, nextHidden);
      fetchDepartments();
      toast({
        title: nextHidden ? "Department Hidden" : "Department Visible",
        description: nextHidden
          ? `"${dept.name}" will no longer appear in the student signup list.`
          : `"${dept.name}" is now available in the student signup list.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update department visibility",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const activeDefaultDept = departments.find((d) => d.id === defaultDeptId);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold">
              Manage Departments
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Create, organize, and set the default department curriculum for students and guests.
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              {canEdit('departments') && (
                <Button className="rounded-xl shadow-sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Department
                </Button>
              )}
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>Create New Department</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Department Name</Label>
                  <Input
                    id="name"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    placeholder="e.g. Freshman or Computer Science"
                    required
                    className="rounded-xl"
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creating} className="rounded-xl">
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Department
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>Edit Department</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Department Name</Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="e.g. Computer Science"
                    required
                    className="rounded-xl"
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={updating} className="rounded-xl">
                    {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Default Department Configuration Card */}
        <Card className="border-purple-200/60 dark:border-purple-900/40 bg-gradient-to-br from-purple-50/50 via-background to-blue-50/30 dark:from-purple-950/15 dark:to-background shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-purple-600/10 text-purple-600 dark:text-purple-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold">
                    Default Department (Direct Open)
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    When active, this department's exams and notes are directly open for all guests and students without prompting.
                  </CardDescription>
                </div>
              </div>
              {defaultDeptId && activeDefaultDept ? (
                <Badge className="w-fit bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1.5 py-1 px-3 rounded-full text-xs font-bold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Direct Open: {activeDefaultDept.name}
                </Badge>
              ) : (
                <Badge variant="outline" className="w-fit text-muted-foreground gap-1.5 py-1 px-3 rounded-full text-xs">
                  None (Per-user selection)
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              <div className="flex-1 max-w-sm">
                <Select
                  value={defaultDeptId || "none"}
                  onValueChange={(val) => {
                    if (val === "none") {
                      handleSetDefaultDepartment(null, null);
                    } else {
                      const dept = departments.find((d) => d.id === val);
                      handleSetDefaultDepartment(val, dept?.name || null);
                    }
                  }}
                  disabled={savingDefault}
                >
                  <SelectTrigger className="h-10 rounded-xl bg-background">
                    <SelectValue placeholder="Choose a default department..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-60">
                    <SelectItem value="none" className="text-muted-foreground font-medium">
                      None (Standard per-user selection)
                    </SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {defaultDeptId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSetDefaultDepartment(null, null)}
                  disabled={savingDefault}
                  className="rounded-xl text-xs h-10 px-4"
                >
                  Clear Default (Restore Per-User Selection)
                </Button>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-dashed border-purple-200/60 dark:border-purple-900/40">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 shrink-0">
                    {hideDepartmentOnSignup ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Department Selector on Sign Up
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {hideDepartmentOnSignup
                        ? "Hidden — students sign up using the default department above."
                        : "Visible — students choose their department during sign up."}
                    </p>
                  </div>
                </div>
                <Button
                  variant={hideDepartmentOnSignup ? "secondary" : "outline"}
                  size="sm"
                  onClick={handleToggleHideDepartmentOnSignup}
                  disabled={savingHideDept}
                  className="rounded-xl text-xs h-10 px-4 shrink-0"
                >
                  {savingHideDept && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  {hideDepartmentOnSignup ? "Show on Sign Up" : "Hide on Sign Up"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Departments List Table */}
        <div className="rounded-2xl border bg-card/60 backdrop-blur-sm overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Department Name</TableHead>
                <TableHead className="w-[200px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-10 text-muted-foreground">
                    No departments found. Click "Add Department" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                departments.map((dept) => {
                  const isCurrentDefault = dept.id === defaultDeptId;
                  return (
                    <TableRow key={dept.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2.5">
                          <Building className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          <span className="font-semibold text-foreground">{dept.name}</span>
                          {isCurrentDefault && (
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-bold py-0.5 px-2.5 rounded-full flex items-center gap-1">
                              <Star className="h-3 w-3 fill-emerald-600 dark:fill-emerald-400" />
                              Default (Active)
                            </Badge>
                          )}
                          {dept.hidden && (
                            <Badge variant="outline" className="text-muted-foreground text-[11px] font-semibold py-0.5 px-2.5 rounded-full flex items-center gap-1">
                              <EyeOff className="h-3 w-3" />
                              Hidden from signup
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEdit('departments') && (
                            <Button
                              variant={isCurrentDefault ? "secondary" : "ghost"}
                              size="sm"
                              className={`h-8 px-2.5 text-xs rounded-xl gap-1.5 transition-all ${
                                isCurrentDefault 
                                  ? "border border-amber-300 dark:border-amber-700 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                              onClick={() => {
                                if (isCurrentDefault) {
                                  handleSetDefaultDepartment(null, null);
                                } else {
                                  handleSetDefaultDepartment(dept.id, dept.name);
                                }
                              }}
                              disabled={savingDefault}
                              title={isCurrentDefault ? "Remove default" : "Set as default"}
                            >
                              <Star className={`h-3.5 w-3.5 ${isCurrentDefault ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}`} />
                              <span>{isCurrentDefault ? "Default" : "Make Default"}</span>
                            </Button>
                          )}
                          {canEdit('departments') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-xl"
                              onClick={() => handleToggleVisibility(dept)}
                              title={dept.hidden ? "Unhide from student signup" : "Hide from student signup"}
                            >
                              {dept.hidden ? (
                                <EyeOff className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                              ) : (
                                <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                              )}
                            </Button>
                          )}
                          {canEdit('departments') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-xl"
                              onClick={() => {
                                setEditingDept(dept);
                                setEditName(dept.name);
                                setEditOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" />
                            </Button>
                          )}
                          {canDelete('departments') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-xl"
                              onClick={() => handleDelete(dept.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
