import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { getAllExams } from "@/lib/firebase-exams";
import { getBooks } from "@/lib/books";
import { getSubjects, getChapters } from "@/lib/subjects";
import type { Book } from "@/types/book";
import type { Subject, Chapter } from "@/types/subject";
import type { FreeAccessConfig } from "./types";

interface FreeAccessSettingsProps {
  value: FreeAccessConfig;
  onChange: (freeAccess: FreeAccessConfig) => void;
  disabled?: boolean;
}

interface PickerItem {
  id: string;
  label: string;
  sublabel?: string;
}

function CheckboxPicker({
  items,
  selected,
  onToggle,
  disabled,
  emptyText,
  searchPlaceholder,
}: {
  items: PickerItem[];
  selected: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
  emptyText: string;
  searchPlaceholder: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div className="space-y-2">
      <Input
        value={query}
        disabled={disabled}
        placeholder={searchPlaceholder}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="max-h-56 overflow-auto rounded-lg border border-border/60">
        {filtered.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">{emptyText}</p>
        ) : (
          filtered.map((item) => {
            const checked = selected.includes(item.id);
            return (
              <label
                key={item.id}
                className="flex cursor-pointer items-center gap-3 border-b border-border/40 px-3 py-2 last:border-b-0 hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onToggle(item.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{item.label}</span>
                  {item.sublabel && <span className="block truncate text-xs text-muted-foreground">{item.sublabel}</span>}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

function SelectedChips({
  ids,
  labelFor,
  onRemove,
  disabled,
}: {
  ids: string[];
  labelFor: (id: string) => string;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  if (ids.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {ids.map((id) => (
        <Badge key={id} variant="secondary" className="gap-1 pr-1">
          <span className="max-w-[16rem] truncate">{labelFor(id)}</span>
          <button
            type="button"
            disabled={disabled}
            className="rounded-full p-0.5 hover:bg-muted disabled:opacity-50"
            aria-label={`Remove ${id}`}
            onClick={() => onRemove(id)}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}

export function FreeAccessSettings({ value, onChange, disabled }: FreeAccessSettingsProps) {
  const [exams, setExams] = useState<PickerItem[]>([]);
  const [notes, setNotes] = useState<PickerItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [chaptersLoading, setChaptersLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [examResult, noteResult, subjectResult] = await Promise.allSettled([
        getAllExams(),
        getBooks({ resourceType: "short_note" }, "admin"),
        getSubjects(),
      ]);
      if (!active) return;
      if (examResult.status === "fulfilled") {
        setExams(
          examResult.value.map((exam) => ({
            id: exam.examId,
            label: exam.title || exam.examId,
            sublabel: exam.subjectId || undefined,
          })),
        );
      }
      if (noteResult.status === "fulfilled") {
        setNotes(
          (noteResult.value as Book[]).map((book) => ({
            id: book.id,
            label: book.title || book.id,
            sublabel: book.subjectName || book.chapterTitle || undefined,
          })),
        );
      }
      if (subjectResult.status === "fulfilled") {
        setSubjects(subjectResult.value);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedSubject) {
      setChapters([]);
      return;
    }
    let active = true;
    (async () => {
      setChaptersLoading(true);
      try {
        const list = await getChapters(selectedSubject);
        if (active) setChapters(list);
      } catch {
        if (active) setChapters([]);
      } finally {
        if (active) setChaptersLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedSubject]);

  const toggle = (key: "freeChapterIds" | "freeExamIds" | "freeNoteIds", id: string) => {
    const current = value[key];
    onChange({
      ...value,
      [key]: current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    });
  };

  const updateCount = (key: "freeChaptersPerSubject" | "freeExamAttempts" | "freeNotesCount", raw: string) => {
    const parsed = Math.max(0, Math.min(100, Math.floor(Number(raw) || 0)));
    onChange({ ...value, [key]: parsed });
  };

  const chapterLabel = (id: string) => {
    const chapter = chapters.find((item) => item.id === id);
    return chapter ? `Ch ${chapter.chapterNumber ?? "?"}: ${chapter.title}` : id;
  };
  const examLabel = (id: string) => exams.find((item) => item.id === id)?.label ?? id;
  const noteLabel = (id: string) => notes.find((item) => item.id === id)?.label ?? id;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Free access
            </CardTitle>
            <CardDescription>What students can open before they pay.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="free-access-enabled"
              checked={value.enabled}
              disabled={disabled}
              onCheckedChange={(checked) => onChange({ ...value, enabled: checked })}
            />
            <Label htmlFor="free-access-enabled" className="text-sm">
              {value.enabled ? "Enabled" : "Disabled"}
            </Label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <Alert className="border-border/60">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <AlertTitle>Enforced on the server</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            These allowances and selections are enforced by the content-access Cloud Functions when a student opens
            books, notes or exams. When free access is disabled, an approved payment is required for all content.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="free-chapters">Free chapters per subject</Label>
            <Input
              id="free-chapters"
              type="number"
              min="0"
              max="100"
              value={String(value.freeChaptersPerSubject)}
              disabled={disabled || !value.enabled}
              onChange={(event) => updateCount("freeChaptersPerSubject", event.target.value)}
            />
            <p className="text-xs text-muted-foreground">First N chapters of each subject.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="free-exam-attempts">Free exam attempts</Label>
            <Input
              id="free-exam-attempts"
              type="number"
              min="0"
              max="100"
              value={String(value.freeExamAttempts)}
              disabled={disabled || !value.enabled}
              onChange={(event) => updateCount("freeExamAttempts", event.target.value)}
            />
            <p className="text-xs text-muted-foreground">Across the free exams selected below.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="free-notes">Free notes</Label>
            <Input
              id="free-notes"
              type="number"
              min="0"
              max="100"
              value={String(value.freeNotesCount)}
              disabled={disabled || !value.enabled}
              onChange={(event) => updateCount("freeNotesCount", event.target.value)}
            />
            <p className="text-xs text-muted-foreground">First N short-notes.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Free chapters */}
            <section className="space-y-3 rounded-xl border border-border/60 p-4">
              <div>
                <h4 className="text-sm font-semibold">Explicitly free chapters</h4>
                <p className="text-xs text-muted-foreground">Pick a subject, then mark individual chapters as free.</p>
              </div>
              <Select value={selectedSubject} disabled={disabled || !value.enabled} onValueChange={setSelectedSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a subject to choose chapters" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSubject &&
                (chaptersLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <CheckboxPicker
                    items={chapters.map((chapter) => ({
                      id: chapter.id,
                      label: `Ch ${chapter.chapterNumber ?? "?"}: ${chapter.title}`,
                    }))}
                    selected={value.freeChapterIds}
                    onToggle={(id) => toggle("freeChapterIds", id)}
                    disabled={disabled || !value.enabled}
                    emptyText="This subject has no chapters."
                    searchPlaceholder="Search chapters"
                  />
                ))}
              <SelectedChips ids={value.freeChapterIds} labelFor={chapterLabel} onRemove={(id) => toggle("freeChapterIds", id)} disabled={disabled} />
            </section>

            {/* Free exams */}
            <section className="space-y-3 rounded-xl border border-border/60 p-4">
              <div>
                <h4 className="text-sm font-semibold">Free exams</h4>
                <p className="text-xs text-muted-foreground">
                  Students may attempt these exams up to the free-attempt limit above.
                </p>
              </div>
              <CheckboxPicker
                items={exams}
                selected={value.freeExamIds}
                onToggle={(id) => toggle("freeExamIds", id)}
                disabled={disabled || !value.enabled}
                emptyText="No exams found."
                searchPlaceholder="Search exams"
              />
              <SelectedChips ids={value.freeExamIds} labelFor={examLabel} onRemove={(id) => toggle("freeExamIds", id)} disabled={disabled} />
            </section>

            {/* Free notes */}
            <section className="space-y-3 rounded-xl border border-border/60 p-4">
              <div>
                <h4 className="text-sm font-semibold">Free notes</h4>
                <p className="text-xs text-muted-foreground">Short-notes students can open without paying.</p>
              </div>
              <CheckboxPicker
                items={notes}
                selected={value.freeNoteIds}
                onToggle={(id) => toggle("freeNoteIds", id)}
                disabled={disabled || !value.enabled}
                emptyText="No short-notes found."
                searchPlaceholder="Search notes"
              />
              <SelectedChips ids={value.freeNoteIds} labelFor={noteLabel} onRemove={(id) => toggle("freeNoteIds", id)} disabled={disabled} />
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
