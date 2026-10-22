import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Plus,
  Trash2,
  BookOpen,
  Pencil,
  LayoutGrid,
  Table as TableIcon,
  Sparkles,
  Building,
  Filter,
  Search,
  X,
  Layers,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  getSubjects,
  createSubject,
  deleteSubject,
  updateSubject,
  seedDefaultSubjects,
  SubjectInput,
} from "@/lib/subjects";
import { getDepartments } from "@/lib/departments";
import { Subject } from "@/types/subject";
import { Department } from "@/integrations/firebase/types";
import { useSectionPermissions } from "@/hooks/useSectionPermissions";
import { SubjectGrid } from "@/components/subject/SubjectGrid";
import { SubjectFormDialog } from "@/components/subject/SubjectFormDialog";
import { SubjectChaptersDialog } from "@/components/subject/SubjectChaptersDialog";
import { getSubjectCover } from "@/lib/subject-covers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminSubjects() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canEdit, canDelete } = useSectionPermissions();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "hidden">("all");
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"grid" | "table">("grid");

  // Subject dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  // Chapter management dialog states
  const [chaptersDialogOpen, setChaptersDialogOpen] = useState(false);
  const [selectedSubjectForChapters, setSelectedSubjectForChapters] = useState<Subject | null>(null);

  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Seed state
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (role !== "admin") {
      navigate("/dashboard");
      return;
    }
    fetchData();

    const handlePermNotice = (e: any) => {
      toast({
        title: "Subject Saved (Local Resilience)",
        description: `"${e.detail?.subjectName || "Subject"}" was saved locally. Remember to publish rules in Firebase Console for cloud sync.`,
      });
    };
    window.addEventListener("exampro:subject-permission-notice", handlePermNotice);
    return () => window.removeEventListener("exampro:subject-permission-notice", handlePermNotice);
  }, [role, navigate, toast]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [subjectsList, departmentsList] = await Promise.all([
        getSubjects(),
        getDepartments().catch(() => []),
      ]);
      setSubjects(subjectsList);
      setDepartments(departmentsList);
    } catch (error) {
      toast({
        title: "Error loading subjects",
        description: "Failed to fetch subjects from database.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingSubject(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setDialogOpen(true);
  };

  const handleOpenChapters = (subject: Subject) => {
    setSelectedSubjectForChapters(subject);
    setChaptersDialogOpen(true);
  };

  const handleOpenDelete = (subject: Subject) => {
    setSubjectToDelete(subject);
    setDeleteDialogOpen(true);
  };

  const handleToggleStatus = async (subject: Subject) => {
    const newActiveState = subject.isActive === false ? true : false;
    try {
      // Optimistic update
      setSubjects((prev) =>
        prev.map((s) => (s.id === subject.id ? { ...s, isActive: newActiveState } : s))
      );

      await updateSubject(subject.id, { isActive: newActiveState });

      toast({
        title: newActiveState ? "Subject Activated" : "Subject Hidden",
        description: `"${subject.name}" is now ${newActiveState ? "visible to students" : "hidden from students"}.`,
      });
    } catch (err: any) {
      // Revert on error
      fetchData();
      toast({
        title: "Status update failed",
        description: err.message || "Could not toggle subject status.",
        variant: "destructive",
      });
    }
  };

  const handleSaveSubject = async (data: SubjectInput) => {
    try {
      if (editingSubject) {
        await updateSubject(editingSubject.id, data);
        toast({
          title: "Subject updated",
          description: `"${data.name}" has been updated.`,
        });
      } else {
        await createSubject(data);
        toast({
          title: "Subject created",
          description: `"${data.name}" was added successfully.`,
        });
      }
      fetchData();
    } catch (error: any) {
      toast({
        title: "Save error",
        description: error.message || "Failed to save subject.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleConfirmDelete = async () => {
    if (!subjectToDelete) return;
    setDeleting(true);

    try {
      await deleteSubject(subjectToDelete.id);
      toast({
        title: "Subject deleted",
        description: `"${subjectToDelete.name}" was removed.`,
      });
      setDeleteDialogOpen(false);
      setSubjectToDelete(null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Delete error",
        description: error.message || "Failed to delete subject.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleSeedSubjects = async () => {
    setSeeding(true);
    try {
      const added = await seedDefaultSubjects();
      if (added > 0) {
        toast({
          title: "Standard subjects seeded!",
          description: `Added ${added} curriculum subjects with illustrated covers.`,
        });
        fetchData();
      } else {
        toast({
          title: "Already up to date",
          description: "All standard curriculum subjects already exist.",
        });
      }
    } catch (err: any) {
      toast({
        title: "Seeding error",
        description: err.message || "Could not seed subjects.",
        variant: "destructive",
      });
    } finally {
      setSeeding(false);
    }
  };

  // Filter subjects by search, department, and status
  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      // 1. Department filter
      if (selectedDeptFilter !== "all") {
        if (s.departmentIds && s.departmentIds.length > 0) {
          if (!s.departmentIds.includes(selectedDeptFilter)) return false;
        }
      }

      // 2. Status filter
      if (statusFilter === "active" && s.isActive === false) return false;
      if (statusFilter === "hidden" && s.isActive !== false) return false;

      // 3. Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = s.name.toLowerCase().includes(query);
        const matchesDesc = s.description?.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc) return false;
      }

      return true;
    });
  }, [subjects, selectedDeptFilter, statusFilter, searchQuery]);

  // Aggregate stats
  const activeCount = subjects.filter((s) => s.isActive !== false).length;
  const hiddenCount = subjects.length - activeCount;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pb-12 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
                Manage Academic Subjects
              </h1>
              <Badge variant="secondary" className="font-semibold text-xs rounded-lg px-2.5 py-0.5">
                Full Admin Control
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Create, read, update, and delete academic subjects, illustrated covers, and curriculum chapters.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {subjects.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSeedSubjects}
                disabled={seeding}
                className="rounded-xl border-dashed"
              >
                {seeding ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2 text-amber-500" />
                )}
                Seed Standard Subjects
              </Button>
            )}

            <Button
              onClick={handleOpenCreate}
              className="rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 shadow-md font-semibold"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Subject
            </Button>
          </div>
        </div>

        {/* Quick Stats Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-card border shadow-xs">
            <div className="text-xs text-muted-foreground font-medium">Total Subjects</div>
            <div className="text-2xl font-bold font-display text-foreground mt-1">
              {subjects.length}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-card border shadow-xs">
            <div className="text-xs text-muted-foreground font-medium">Active (Published)</div>
            <div className="text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400 mt-1">
              {activeCount}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-card border shadow-xs">
            <div className="text-xs text-muted-foreground font-medium">Hidden (Drafts)</div>
            <div className="text-2xl font-bold font-display text-muted-foreground mt-1">
              {hiddenCount}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-card border shadow-xs">
            <div className="text-xs text-muted-foreground font-medium">Departments</div>
            <div className="text-2xl font-bold font-display text-primary mt-1">
              {departments.length}
            </div>
          </div>
        </div>

        {/* Search, Filter, and View Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b pb-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-2xl">
            {/* Global Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search subjects by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 rounded-xl h-9 text-xs bg-card"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Department Filter */}
            {departments.length > 0 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <Building className="h-4 w-4 text-muted-foreground hidden sm:block" />
                <Select
                  value={selectedDeptFilter}
                  onValueChange={setSelectedDeptFilter}
                >
                  <SelectTrigger className="h-9 w-full sm:w-[180px] rounded-xl text-xs bg-card">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Status Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 shrink-0">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
                className="h-8 rounded-lg text-xs px-2.5"
              >
                All
              </Button>
              <Button
                variant={statusFilter === "active" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("active")}
                className="h-8 rounded-lg text-xs px-2.5"
              >
                Active
              </Button>
              <Button
                variant={statusFilter === "hidden" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("hidden")}
                className="h-8 rounded-lg text-xs px-2.5"
              >
                Hidden
              </Button>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl self-end lg:self-auto shrink-0">
            <Button
              variant={activeView === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveView("grid")}
              className="h-8 px-3 rounded-lg text-xs font-medium"
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
              Grid View
            </Button>
            <Button
              variant={activeView === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveView("table")}
              className="h-8 px-3 rounded-lg text-xs font-medium"
            >
              <TableIcon className="h-3.5 w-3.5 mr-1.5" />
              Table View
            </Button>
          </div>
        </div>

        {/* Grid View */}
        {activeView === "grid" && (
          <SubjectGrid
            subjects={filteredSubjects}
            isAdmin={true}
            onEditSubject={handleOpenEdit}
            onDeleteSubject={handleOpenDelete}
            onManageChapters={handleOpenChapters}
            onSelectSubject={handleOpenEdit}
            showSearch={false}
            emptyAction={
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={handleOpenCreate} className="rounded-xl">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Subject
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSeedSubjects}
                  disabled={seeding}
                  className="rounded-xl"
                >
                  <Sparkles className="h-4 w-4 mr-2 text-amber-500" />
                  Seed 9 Curriculum Subjects
                </Button>
              </div>
            }
          />
        )}

        {/* Table View */}
        {activeView === "table" && (
          <div className="rounded-2xl border bg-card shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-16">Cover</TableHead>
                  <TableHead className="w-16 text-center">Order</TableHead>
                  <TableHead>Subject Name & Description</TableHead>
                  <TableHead>Department Availability</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      No subjects matched the filters. Click &quot;Add Subject&quot; to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubjects.map((sub) => {
                    const cover = getSubjectCover(sub.name, sub.coverImageUrl);
                    const assignedDeptNames = (sub.departmentIds || [])
                      .map((id) => departments.find((d) => d.id === id)?.name)
                      .filter(Boolean);

                    const isActive = sub.isActive !== false;

                    return (
                      <TableRow key={sub.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell>
                          <div className="h-11 w-15 rounded-xl overflow-hidden bg-muted border shadow-xs">
                            <img
                              src={cover.url}
                              alt={sub.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-mono text-xs font-semibold px-2 py-0.5 border-primary/30 text-primary bg-primary/5">
                            #{sub.displayOrder ?? '—'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-foreground text-sm">{sub.name}</div>
                          {sub.description ? (
                            <div className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                              {sub.description}
                            </div>
                          ) : (
                            <div className="text-[11px] text-muted-foreground/60 italic">
                              No description provided
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {assignedDeptNames.length === 0 ? (
                            <Badge variant="outline" className="text-xs bg-muted/30 font-medium">
                              All Departments
                            </Badge>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {assignedDeptNames.slice(0, 2).map((dName, idx) => (
                                <Badge key={idx} variant="secondary" className="text-[11px] font-medium">
                                  {dName}
                                </Badge>
                              ))}
                              {assignedDeptNames.length > 2 && (
                                <Badge variant="outline" className="text-[11px]">
                                  +{assignedDeptNames.length - 2} more
                                </Badge>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono text-xs">
                            {sub.totalUnits ?? 0} units
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(sub)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                              isActive
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/20"
                                : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                            }`}
                            title="Click to toggle Active / Hidden"
                          >
                            {isActive ? (
                              <>
                                <Eye className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                Active
                              </>
                            ) : (
                              <>
                                <EyeOff className="h-3 w-3 text-muted-foreground" />
                                Hidden
                              </>
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Chapters Sub-CRUD Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenChapters(sub)}
                              className="h-8 px-2.5 rounded-lg text-primary hover:bg-primary/10 text-xs font-semibold"
                              title="Manage Chapters"
                            >
                              <BookOpen className="h-3.5 w-3.5 mr-1" />
                              Chapters
                            </Button>

                            {/* Edit Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(sub)}
                              className="h-8 w-8 p-0 rounded-lg text-primary hover:bg-primary/10"
                              title="Edit Subject"
                              aria-label="Edit subject"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>

                            {/* Delete Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDelete(sub)}
                              className="h-8 w-8 p-0 rounded-lg text-destructive hover:bg-destructive/10"
                              title="Delete Subject"
                              aria-label="Delete subject"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Create / Edit Subject Dialog */}
        <SubjectFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          subject={editingSubject}
          onSave={handleSaveSubject}
          defaultDepartmentId={selectedDeptFilter !== "all" ? selectedDeptFilter : undefined}
        />

        {/* Chapters Sub-CRUD Dialog */}
        <SubjectChaptersDialog
          open={chaptersDialogOpen}
          onOpenChange={setChaptersDialogOpen}
          subject={selectedSubjectForChapters}
          onChaptersChange={fetchData}
        />

        {/* Delete Confirmation Alert Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Subject?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{subjectToDelete?.name}&quot;?
                This will remove the subject and its curriculum data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting} className="rounded-xl">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="rounded-xl bg-destructive hover:bg-destructive/90"
              >
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {deleting ? "Deleting..." : "Delete Subject"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
