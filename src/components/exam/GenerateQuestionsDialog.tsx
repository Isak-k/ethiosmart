import { useRef, useState } from "react";
import { AlertCircle, Loader2, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { useSectionPermissions } from "@/hooks/useSectionPermissions";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getExam, saveQuestionsBatch } from "@/lib/firebase-exams";
import {
  GeneratedQuestionValidationError,
  parseGeneratedQuestionResponse,
} from "@/lib/gemini-question-validation";
import type {
  GeneratedQuestion,
  GenerationQuestionType,
  QuestionDifficulty,
  QuestionLanguage,
} from "@/lib/gemini-question-validation";
import {
  generateExamQuestions,
  GeminiQuestionError,
  MAX_GENERATED_QUESTIONS,
} from "@/lib/gemini-questions";

interface GenerateQuestionsDialogProps {
  examId: string;
  examTitle: string;
  isPublished: boolean;
  currentQuestionCount: number;
  onImportSuccess: () => Promise<void> | void;
}

const questionTypeOptions: { value: GenerationQuestionType; label: string }[] = [
  { value: "mixed", label: "Mixed (all question types)" },
  { value: "mcq", label: "Multiple choice" },
  { value: "truefalse", label: "True / False" },
  { value: "shortanswer", label: "Short answer" },
  { value: "essay", label: "Essay" },
];
const MAX_REQUESTS_PER_MINUTE = 5;

function getErrorMessage(error: unknown): string {
  if (error instanceof GeminiQuestionError || error instanceof Error) return error.message;
  return "An unexpected error occurred. Please try again.";
}

export function GenerateQuestionsDialog({
  examId,
  examTitle,
  isPublished,
  currentQuestionCount,
  onImportSuccess,
}: GenerateQuestionsDialogProps) {
  const { canEdit } = useSectionPermissions();
  const canEditExams = canEdit("manageExams");
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(examTitle);
  const [topic, setTopic] = useState("");
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>("Medium");
  const [questionType, setQuestionType] = useState<GenerationQuestionType>("mcq");
  const [language, setLanguage] = useState<QuestionLanguage>("English");
  const [learningObjectives, setLearningObjectives] = useState("");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const generationId = useRef(0);
  const requestTimestamps = useRef<number[]>([]);

  const reserveGenerationRequest = (): boolean => {
    const now = Date.now();
    requestTimestamps.current = requestTimestamps.current.filter(
      (timestamp) => now - timestamp < 60_000,
    );
    if (requestTimestamps.current.length >= MAX_REQUESTS_PER_MINUTE) {
      const waitSeconds = Math.ceil(
        (requestTimestamps.current[0] + 60_000 - now) / 1000,
      );
      setErrorMessage(
        `The local limit is ${MAX_REQUESTS_PER_MINUTE} generation requests per minute. Try again in about ${waitSeconds} seconds.`,
      );
      return false;
    }
    requestTimestamps.current.push(now);
    return true;
  };

  const resetPreview = () => {
    setQuestions([]);
    setStatus("");
    setErrorMessage("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isSaving) return;
    if (!nextOpen) generationId.current += 1;
    setOpen(nextOpen);
    if (!nextOpen) resetPreview();
  };

  const handleGenerate = async () => {
    if (isGenerating || isSaving || !canEditExams) return;
    if (!subject.trim() || !topic.trim()) {
      setErrorMessage("Enter a subject and topic before generating questions.");
      return;
    }
    if (!reserveGenerationRequest()) return;

    setIsGenerating(true);
    setErrorMessage("");
    setStatus(`Requesting ${questionCount} questions from Gemini...`);
    const currentGenerationId = ++generationId.current;
    try {
      const generated = await generateExamQuestions({
        subject: subject.trim(),
        topic: topic.trim(),
        count: questionCount,
        difficulty,
        questionType,
        language,
        learningObjectives,
        additionalInstructions,
      });
      if (currentGenerationId !== generationId.current) return;
      setStatus("Checking the generated questions...");
      setQuestions(generated);
      setStatus(
        `${generated.length} questions generated. Review and edit them before saving.`,
      );
    } catch (error) {
      if (currentGenerationId !== generationId.current) return;
      const message = getErrorMessage(error);
      setErrorMessage(message);
      setStatus("");
      toast({
        title: "Question generation failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const updateQuestion = (index: number, updates: Partial<GeneratedQuestion>) => {
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...updates } : question,
      ),
    );
  };

  const handleRegenerate = async (index: number) => {
    if (isGenerating || isSaving || !canEditExams) return;
    const question = questions[index];
    if (!question) return;
    if (!reserveGenerationRequest()) return;

    setIsGenerating(true);
    setRegeneratingIndex(index);
    setErrorMessage("");
    setStatus(`Regenerating question ${index + 1}...`);
    const currentGenerationId = ++generationId.current;
    try {
      const [replacement] = await generateExamQuestions({
        subject: subject.trim(),
        topic: topic.trim(),
        count: 1,
        difficulty,
        questionType: question.questionType,
        language,
        learningObjectives,
        additionalInstructions,
        avoidQuestionTexts: questions
          .filter((_, questionIndex) => questionIndex !== index)
          .map((item) => item.questionText),
      });
      if (currentGenerationId !== generationId.current) return;
      setQuestions((current) =>
        current.map((item, questionIndex) =>
          questionIndex === index ? replacement : item,
        ),
      );
      setStatus(`Question ${index + 1} regenerated. Review it before saving.`);
    } catch (error) {
      if (currentGenerationId !== generationId.current) return;
      const message = getErrorMessage(error);
      setErrorMessage(message);
      setStatus("");
      toast({
        title: "Question regeneration failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setRegeneratingIndex(null);
    }
  };

  const handleSave = async () => {
    if (isSaving || isGenerating || !canEditExams || questions.length === 0) return;
    setIsSaving(true);
    setErrorMessage("");

    try {
      const latestExam = await getExam(examId);
      if (!latestExam) throw new Error("This exam could not be found. Reload the page and try again.");
      if (latestExam.isPublished) {
        throw new Error(
          "This exam has been published. Unpublish it before saving AI-generated questions so they are not shown to students immediately.",
        );
      }

      const approvedQuestions = parseGeneratedQuestionResponse(
        JSON.stringify(questions),
        questions.length,
        "mixed",
      );
      const result = await saveQuestionsBatch(
        examId,
        approvedQuestions.map((question) => ({
          examId,
          questionText: question.questionText.trim(),
          questionType: question.questionType,
          options: question.options.map((option) => option.trim()),
          correctOptionIndex: question.correctOptionIndex,
          correctAnswer: question.correctAnswer.trim() || undefined,
          feedbackType: "hidden",
          explanation: question.explanation.trim(),
          marks: 1,
          orderIndex: currentQuestionCount,
          subject: subject.trim(),
          topic: topic.trim(),
          difficulty,
          generatedByAI: true,
        })),
      );

      if (result.addedCount > 0) await onImportSuccess();
      toast({
        title: result.addedCount > 0 ? "Questions saved as a draft" : "No new questions saved",
        description:
          `${result.addedCount} saved to the unpublished exam` +
          (result.skippedCount
            ? `; ${result.skippedCount} duplicate${result.skippedCount === 1 ? "" : "s"} skipped`
            : ""),
      });
      setOpen(false);
      resetPreview();
    } catch (error) {
      const errorCode =
        typeof error === "object" && error !== null && "code" in error
          ? error.code
          : undefined;
      const message =
        error instanceof GeneratedQuestionValidationError
          ? error.message
          : errorCode === "permission-denied"
            ? "Firestore denied this save. Confirm you have exam edit permission and that the exam is unpublished."
            : error instanceof Error && error.message
              ? error.message
              : "Firestore could not save the approved questions. Check your permissions and connection.";
      setErrorMessage(message);
      toast({
        title: "Could not save questions",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!canEditExams) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="gap-2"
            disabled={isPublished}
            title={
              isPublished
                ? "Unpublish this exam before generating questions."
                : undefined
            }
          >
            <Sparkles className="h-4 w-4" />
            Generate with Gemini
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[90vw] lg:max-w-[1100px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Generate exam questions
            </DialogTitle>
            <DialogDescription>
              Generate MCQ, True/False, short-answer, essay, or mixed questions for{" "}
              {examTitle}. Nothing is saved until you review and approve it.
            </DialogDescription>
          </DialogHeader>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Review required</AlertTitle>
            <AlertDescription>
              AI can make factual or answer-key mistakes. Verify every question before
              saving. Questions are saved only to this unpublished exam and will not
              become student-visible until you publish it.
            </AlertDescription>
          </Alert>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Action needed</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gemini-subject">Subject</Label>
              <Input
                id="gemini-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={120}
                disabled={isGenerating || isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gemini-topic">Topic or chapter</Label>
              <Input
                id="gemini-topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                maxLength={160}
                disabled={isGenerating || isSaving}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gemini-count">Number of questions (1–{MAX_GENERATED_QUESTIONS})</Label>
              <Input
                id="gemini-count"
                type="number"
                min={1}
                max={MAX_GENERATED_QUESTIONS}
                value={questionCount}
                onChange={(event) => setQuestionCount(Number(event.target.value))}
                disabled={isGenerating || isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select
                value={difficulty}
                onValueChange={(value: QuestionDifficulty) => setDifficulty(value)}
                disabled={isGenerating || isSaving}
              >
                <SelectTrigger aria-label="Difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Question type</Label>
              <Select
                value={questionType}
                onValueChange={(value: GenerationQuestionType) => setQuestionType(value)}
                disabled={isGenerating || isSaving || questions.length > 0}
              >
                <SelectTrigger aria-label="Question type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {questionTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Output language</Label>
              <Select
                value={language}
                onValueChange={(value: QuestionLanguage) => setLanguage(value)}
                disabled={isGenerating || isSaving}
              >
                <SelectTrigger aria-label="Output language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="English">English</SelectItem>
                  <SelectItem value="Afaan Oromoo">Afaan Oromoo</SelectItem>
                  <SelectItem value="Amharic">Amharic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gemini-objectives">Optional learning objectives</Label>
              <Textarea
                id="gemini-objectives"
                value={learningObjectives}
                onChange={(event) => setLearningObjectives(event.target.value)}
                maxLength={1200}
                rows={2}
                disabled={isGenerating || isSaving}
                placeholder="What should students know or be able to do?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gemini-instructions">Optional additional instructions</Label>
              <Textarea
                id="gemini-instructions"
                value={additionalInstructions}
                onChange={(event) => setAdditionalInstructions(event.target.value)}
                maxLength={2000}
                rows={2}
                disabled={isGenerating || isSaving}
                placeholder="Add constraints or context for the questions."
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || isSaving || !subject.trim() || !topic.trim()}
            >
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {questions.length > 0 ? "Generate a new set" : "Generate questions"}
            </Button>
            <span aria-live="polite" className="text-sm text-muted-foreground">
              {status}
            </span>
          </div>

          {questions.length > 0 && (
            <section aria-label="Generated question preview" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                <h3 className="font-semibold">
                  Review questions ({questions.length})
                </h3>
                <p className="text-sm text-muted-foreground">
                  Currently {currentQuestionCount} questions in this exam.
                </p>
              </div>

              {questions.map((question, index) => (
                <article
                  key={`${index}-${question.questionText}`}
                  className="space-y-4 rounded-lg border p-4"
                  aria-label={`Generated question ${index + 1}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium">
                      Question {index + 1} · {question.questionType}
                    </h4>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleRegenerate(index)}
                        disabled={isGenerating || isSaving}
                        aria-label={`Regenerate question ${index + 1}`}
                      >
                        {regeneratingIndex === index ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-1 h-4 w-4" />
                        )}
                        Regenerate
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setQuestions((current) =>
                            current.filter((_, questionIndex) => questionIndex !== index),
                          )
                        }
                        disabled={isGenerating || isSaving}
                        aria-label={`Remove question ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`generated-question-${index}`}>Question text</Label>
                    <Textarea
                      id={`generated-question-${index}`}
                      value={question.questionText}
                      onChange={(event) =>
                        updateQuestion(index, { questionText: event.target.value })
                      }
                      rows={2}
                      disabled={isGenerating || isSaving}
                    />
                  </div>

                  {(question.questionType === "mcq" ||
                    question.questionType === "truefalse") && (
                    <div className="space-y-2">
                      <Label>Answer options (select the correct answer)</Label>
                      <RadioGroup
                        value={String(question.correctOptionIndex)}
                        onValueChange={(value) =>
                          updateQuestion(index, { correctOptionIndex: Number(value) })
                        }
                      >
                        {question.options.map((option, optionIndex) => (
                          <div key={optionIndex} className="flex items-center gap-2">
                            <RadioGroupItem
                              value={String(optionIndex)}
                              id={`generated-${index}-option-${optionIndex}`}
                              aria-label={`Mark option ${optionIndex + 1} correct`}
                            />
                            <Input
                              value={option}
                              aria-label={`Question ${index + 1} option ${optionIndex + 1}`}
                              onChange={(event) =>
                                updateQuestion(index, {
                                  options: question.options.map((item, itemIndex) =>
                                    itemIndex === optionIndex ? event.target.value : item,
                                  ),
                                })
                              }
                              disabled={question.questionType === "truefalse" || isGenerating || isSaving}
                            />
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  )}

                  {question.questionType === "shortanswer" && (
                    <div className="space-y-2">
                      <Label htmlFor={`generated-answer-${index}`}>Reference answer</Label>
                      <Input
                        id={`generated-answer-${index}`}
                        value={question.correctAnswer}
                        onChange={(event) =>
                          updateQuestion(index, { correctAnswer: event.target.value })
                        }
                        disabled={isGenerating || isSaving}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor={`generated-explanation-${index}`}>
                      {question.questionType === "essay"
                        ? "Suggested grading guidance"
                        : "Explanation"}
                    </Label>
                    <Textarea
                      id={`generated-explanation-${index}`}
                      value={question.explanation}
                      onChange={(event) =>
                        updateQuestion(index, { explanation: event.target.value })
                      }
                      rows={2}
                      disabled={isGenerating || isSaving}
                    />
                  </div>
                </article>
              ))}
            </section>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSaving}
            >
              Cancel without saving
            </Button>
            {questions.length > 0 && (
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving || isGenerating || questions.length === 0}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Approve and save {questions.length} remaining
              </Button>
            )}
          </DialogFooter>
          <p className="text-xs text-muted-foreground">
            Saving is available only while this exam is unpublished. Closing the preview
            discards these generated questions without writing them.
          </p>
        </DialogContent>
      </Dialog>
      {isPublished && (
        <p className="basis-full text-sm text-amber-700 dark:text-amber-300">
          Unpublish this exam before generating questions; questions added to a published
          exam would otherwise be immediately visible to students.
        </p>
      )}
    </>
  );
}
