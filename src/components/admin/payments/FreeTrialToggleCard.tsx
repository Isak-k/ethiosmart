import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Gift, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { getAllExams } from "@/lib/firebase-exams";
import { getBooks } from "@/lib/books";
import { getSubjects, getChapters } from "@/lib/subjects";
import {
  collectChapterOneContent,
  disableChapterOneTrial,
  provisionChapterOneTrial,
  validateChapterOneTrial,
  type TrialCatalog,
} from "@/lib/free-trial";
import { isChapterOneTrialEnabled } from "@/lib/payment-access";
import type { FreeAccessConfig } from "./types";

interface FreeTrialToggleCardProps {
  value: FreeAccessConfig;
  onChange: (freeAccess: FreeAccessConfig) => void;
  /** Optional: persist immediately so the toggle survives without a manual save. */
  onCommit?: (freeAccess: FreeAccessConfig) => void | Promise<void>;
  disabled?: boolean;
}

const EMPTY_CONTENT = { noteIds: [], examIds: [] };

export function FreeTrialToggleCard({ value, onChange, onCommit, disabled }: FreeTrialToggleCardProps) {
  const [catalog, setCatalog] = useState<TrialCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const [exams, notes, subjects] = await Promise.all([
        getAllExams(),
        getBooks({ resourceType: "short_note" }, "admin"),
        getSubjects(),
      ]);
      const chapterLists = await Promise.all(
        subjects.map((subject) => getChapters(subject.id).catch(() => [])),
      );
      setCatalog({
        notes: notes.map((note) => ({
          id: note.id,
          chapterId: note.chapterId,
          chapterNumber: note.chapterNumber,
          chapterTitle: note.chapterTitle,
          title: note.title,
        })),
        exams: exams.map((exam) => ({
          examId: exam.examId,
          chapterId: exam.chapterId,
          chapterTitle: exam.chapterTitle,
          title: exam.title,
          subjectId: exam.subjectId,
        })),
        chapters: chapterLists
          .flat()
          .map((chapter) => ({
            id: chapter.id,
            subjectId: chapter.subjectId,
            chapterNumber: chapter.chapterNumber,
          })),
      });
    } catch {
      setCatalog({ notes: [], exams: [], chapters: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const content = useMemo(
    () => (catalog ? collectChapterOneContent(catalog) : EMPTY_CONTENT),
    [catalog],
  );
  const validation = useMemo(() => validateChapterOneTrial(value, content), [value, content]);
  const enabled = isChapterOneTrialEnabled(value);

  const apply = async (next: FreeAccessConfig) => {
    onChange(next);
    if (onCommit) {
      setBusy(true);
      try {
        await onCommit(next);
      } finally {
        setBusy(false);
      }
    }
  };

  const handleToggle = async (checked: boolean) => {
    if (!catalog) return;
    await apply(
      checked ? provisionChapterOneTrial(value, content) : disableChapterOneTrial(value, content),
    );
  };

  const reapply = async () => {
    if (!catalog) return;
    await apply(provisionChapterOneTrial(value, content));
  };

  const controlsDisabled = disabled || loading || busy;
  const missingCount = validation.missingNoteIds.length + validation.missingExamIds.length;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5" /> Default free trial
            </CardTitle>
            <CardDescription>
              Free Chapter 1 notes and exams for every student, with no payment required.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Switch
              id="free-trial-enabled"
              checked={enabled}
              disabled={controlsDisabled}
              onCheckedChange={handleToggle}
            />
            <Label htmlFor="free-trial-enabled" className="text-sm">
              {enabled ? "On" : "Off"}
            </Label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <Alert className="border-border/60">
          <Gift className="h-4 w-4 text-primary" />
          <AlertTitle>Chapter 1 is always free while this is on</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Switching this on automatically provisions free access for every Chapter 1 note and exam and
            keeps it in sync with the Free access rules below. Switching it off removes only the Chapter 1
            entries this toggle added.
          </AlertDescription>
        </Alert>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading Chapter 1 notes and exams…
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-border/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {enabled && validation.ok ? (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Free trial applied
                  </Badge>
                ) : enabled ? (
                  <Badge variant="secondary" className="gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> {missingCount} item(s) missing
                  </Badge>
                ) : (
                  <Badge variant="outline">Trial off</Badge>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={controlsDisabled}
                onClick={reapply}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Re-apply &amp; validate
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">Chapter 1 notes</p>
                <p className="text-lg font-semibold">
                  {validation.provisionedNotes}
                  <span className="text-sm font-normal text-muted-foreground"> / {validation.totalNotes}</span>
                </p>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">Chapter 1 exams</p>
                <p className="text-lg font-semibold">
                  {validation.provisionedExams}
                  <span className="text-sm font-normal text-muted-foreground"> / {validation.totalExams}</span>
                </p>
              </div>
            </div>

            {enabled && !validation.ok && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Some Chapter 1 items are not covered yet. Use “Re-apply &amp; validate” to provision them,
                then save the settings.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
