import { useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Question,
  isMCQQuestion,
  isTrueFalseQuestion,
  isShortAnswerQuestion,
  isEssayQuestion,
} from "@/integrations/firebase/types";
import { getNewQuestionSchema, NewQuestionInput } from "@/lib/validations";
import { Plus, X, Trash2, Upload, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadQuestionImage, validateImageFile, formatFileSize, ImageDisplayMode } from "@/lib/image-handler";
import { useToast } from "@/hooks/use-toast";
import { MCQOptionsManager } from "./MCQOptionsManager";
import { ShortAnswerListManager } from "./ShortAnswerListManager";
import { ImagePreview } from "./ImagePreview";

interface QuestionTypeFormProps {
  examId: string;
  question?: Question;
  onSubmit: (data: NewQuestionInput) => Promise<void>;
  isLoading?: boolean;
  onCancel?: () => void;
}

export function QuestionTypeForm({
  examId,
  question,
  onSubmit,
  isLoading = false,
  onCancel,
}: QuestionTypeFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [questionType, setQuestionType] = useState<string>(
    question?.questionType || "mcq"
  );
  const [imageUrl, setImageUrl] = useState<string | null>(question?.imageUrl || null);
  const [imageDisplayMode, setImageDisplayMode] = useState<ImageDisplayMode>(
    (question?.imageDisplayMode as ImageDisplayMode) || "inline"
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const schema = getNewQuestionSchema(t);
  
  const buildDefaultValues = (): NewQuestionInput => {
    if (question) {
      if (isMCQQuestion(question)) {
        return {
          questionType: "mcq" as any,
          questionText: question.questionText,
          marks: question.marks,
          feedbackType: question.feedbackType,
          explanation: question.explanation,
          options: question.options,
          correctOptionIndex: question.correctOptionIndex,
        };
      } else if (isTrueFalseQuestion(question)) {
        return {
          questionType: "true-false" as any,
          questionText: question.questionText,
          marks: question.marks,
          feedbackType: question.feedbackType,
          explanation: question.explanation,
          correctAnswer: question.correctAnswer,
        };
      } else if (isShortAnswerQuestion(question)) {
        return {
          questionType: "short-answer" as any,
          questionText: question.questionText,
          marks: question.marks,
          feedbackType: question.feedbackType,
          explanation: question.explanation,
          correctAnswers: question.correctAnswers,
          caseSensitive: question.caseSensitive,
          requireExactMatch: question.requireExactMatch,
          requiresManualGrading: question.requiresManualGrading || false,
        };
      } else if (isEssayQuestion(question)) {
        return {
          questionType: "essay" as any,
          questionText: question.questionText,
          marks: question.marks,
          feedbackType: question.feedbackType,
          explanation: question.explanation,
          minWords: question.minWords,
          maxWords: question.maxWords,
          rubricPoints: question.rubricPoints || [],
        };
      }
    }
    
    return {
      questionType: "mcq" as any,
      questionText: "",
      marks: 1,
      feedbackType: "instant",
      explanation: undefined,
      options: ["", ""],
      correctOptionIndex: 0,
    };
  };

  const defaultValues = buildDefaultValues();
  
  const form = useForm<NewQuestionInput>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onBlur",
  });

  const handleQuestionTypeChange = (newType: string) => {
    form.clearErrors();
    
    const resetFields = {
      options: undefined,
      correctOptionIndex: undefined,
      correctAnswer: undefined,
      correctAnswers: undefined,
      caseSensitive: undefined,
      requireExactMatch: undefined,
      minWords: undefined,
      maxWords: undefined,
      rubricPoints: undefined,
    };
    
    Object.entries(resetFields).forEach(([key, value]) => {
      form.setValue(key as any, value);
    });

    switch (newType) {
      case "mcq":
        form.setValue("options", ["", ""]);
        form.setValue("correctOptionIndex", 0);
        break;
      case "true-false":
        form.setValue("correctAnswer", true);
        break;
      case "short-answer":
        form.setValue("correctAnswers", [""]);
        form.setValue("caseSensitive", false);
        form.setValue("requireExactMatch", false);
        form.setValue("requiresManualGrading", false);
        break;
      case "essay":
        form.setValue("minWords", undefined);
        form.setValue("maxWords", undefined);
        form.setValue("rubricPoints", undefined);
        break;
    }

    setQuestionType(newType);
    form.setValue("questionType", newType as any);
  };

  useEffect(() => {
    if (question) {
      setQuestionType(question.questionType);
      setImageUrl(question.imageUrl);
      setImageDisplayMode((question.imageDisplayMode as ImageDisplayMode) || "inline");
      
      let newDefaults: NewQuestionInput;

      if (isMCQQuestion(question)) {
        newDefaults = {
          questionType: "mcq",
          questionText: question.questionText,
          marks: question.marks,
          feedbackType: question.feedbackType,
          explanation: question.explanation,
          options: question.options,
          correctOptionIndex: question.correctOptionIndex,
        };
      } else if (isTrueFalseQuestion(question)) {
        newDefaults = {
          questionType: "true-false",
          questionText: question.questionText,
          marks: question.marks,
          feedbackType: question.feedbackType,
          explanation: question.explanation,
          correctAnswer: question.correctAnswer,
        };
      } else if (isShortAnswerQuestion(question)) {
        newDefaults = {
          questionType: "short-answer",
          questionText: question.questionText,
          marks: question.marks,
          feedbackType: question.feedbackType,
          explanation: question.explanation,
          correctAnswers: question.correctAnswers,
          caseSensitive: question.caseSensitive,
          requireExactMatch: question.requireExactMatch,
          requiresManualGrading: question.requiresManualGrading || false,
        };
      } else if (isEssayQuestion(question)) {
        newDefaults = {
          questionType: "essay",
          questionText: question.questionText,
          marks: question.marks,
          feedbackType: question.feedbackType,
          explanation: question.explanation,
          minWords: question.minWords,
          maxWords: question.maxWords,
          rubricPoints: question.rubricPoints || [],
        };
      } else {
        return;
      }

      form.reset(newDefaults);
    }
  }, [question, form]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (uploadingImage) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast({
        title: "Invalid Image",
        description: validation.error,
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }

    setUploadingImage(true);
    try {
      const tempQId = question?.questionId || `temp_${Date.now()}`;
      console.log("[IMAGE-UPLOAD] Starting Cloudinary upload:", { 
        fileName: file.name, 
        fileSize: file.size, 
        examId, 
        tempQId 
      });
      
      // Step 1: Upload to Cloudinary
      const uploadResult = await uploadQuestionImage(file, examId, tempQId);
      console.log("[IMAGE-UPLOAD] Cloudinary response:", {
        url: uploadResult.url,
      });
      
      // Step 2: Verify we got a valid URL
      const cloudinaryUrl = uploadResult.url;
      console.log("[IMAGE-UPLOAD] Extracted Cloudinary URL:", cloudinaryUrl);
      console.log("[IMAGE-UPLOAD] URL is valid?", !!cloudinaryUrl);
      
      if (!cloudinaryUrl) {
        console.error("[IMAGE-UPLOAD] ERROR: No URL from Cloudinary!", { uploadResult });
        throw new Error("Cloudinary upload returned no URL");
      }
      
      // Step 3: Set imageUrl in component state
      console.log("[IMAGE-UPLOAD] Setting imageUrl state to:", cloudinaryUrl);
      setImageUrl(cloudinaryUrl);
      
      // Step 4: Verify state will be used in form submission
      console.log("[IMAGE-UPLOAD] Will save imageUrl:", cloudinaryUrl);
      
      toast({
        title: "Image uploaded successfully",
        description: `File size: ${formatFileSize(file.size)}`,
      });
    } catch (error) {
      console.error("[IMAGE-UPLOAD] Upload failed:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const handleRemoveImage = () => {
    console.log("[CRITICAL] Removing image, imageUrl was:", imageUrl);
    setImageUrl(null);
  };

  const handleFormSubmit = async (data: NewQuestionInput) => {
    if (submitting || submitRef.current) return;
    if (isLoading) return;
    
    submitRef.current = true;
    setSubmitting(true);

    try {
      console.log("[FORM-SUBMIT] Form submission started");
      console.log("[FORM-SUBMIT] Current imageUrl state:", imageUrl);
      console.log("[FORM-SUBMIT] Current imageDisplayMode state:", imageDisplayMode);
      
      // Prepare submission data with imageUrl
      const submissionData = {
        ...data,
        imageUrl: imageUrl || null,
        imageDisplayMode,
      } as NewQuestionInput;

      console.log("[FORM-SUBMIT] Submission data prepared:", {
        questionType: submissionData.questionType,
        hasImageUrl: !!submissionData.imageUrl,
        imageUrl: submissionData.imageUrl ? submissionData.imageUrl.substring(0, 100) + "..." : null,
        imageDisplayMode: submissionData.imageDisplayMode,
      });
      
      const { validateQuestionBeforeSave, formatValidationErrors } = await import("@/lib/question-validator");
      const validation = validateQuestionBeforeSave(submissionData, t);
      
      if (!validation.valid) {
        const formattedErrors = formatValidationErrors(validation.errors);
        toast({
          title: "Validation Error",
          description: formattedErrors.join("\n"),
          variant: "destructive",
        });
        return;
      }
      
      console.log("[FORM-SUBMIT] Validation passed, calling onSubmit with imageUrl:", submissionData.imageUrl ? "YES (has value)" : "NO (null/empty)");
      await onSubmit(submissionData);
    } catch (error) {
      console.error("[FORM-SUBMIT] Error in form submit handler:", error);
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
      submitRef.current = false;
    }
  };

  const isFormDisabled = isLoading || submitting;

  return (
    <Form {...form}>
      <form 
        onSubmit={(e) => {
          if (isFormDisabled) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          form.handleSubmit(handleFormSubmit)(e);
        }} 
        className="space-y-6"
      >
        <fieldset disabled={isFormDisabled} className="disabled:opacity-70 disabled:pointer-events-none border-0 p-0 m-0 space-y-6">
          <FormField
            control={form.control}
            name="questionType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.questions.type")}</FormLabel>
                <Select value={questionType} onValueChange={handleQuestionTypeChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="mcq">Multiple Choice</SelectItem>
                    <SelectItem value="true-false">True/False</SelectItem>
                    <SelectItem value="short-answer">Short Answer</SelectItem>
                    <SelectItem value="essay">Essay</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="questionText"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.questions.questionText")}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter the question text"
                    className="resize-none"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="marks"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.questions.marks")}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="feedbackType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.questions.feedbackType")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="instant">Instant (Practice Mode)</SelectItem>
                    <SelectItem value="hidden">Hidden (Exam Mode)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {questionType === "mcq" && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
              <MCQOptionsManager
                control={form.control}
                optionsName="options"
                correctIndexName="correctOptionIndex"
                minOptions={2}
                maxOptions={6}
              />
            </div>
          )}

          {questionType === "true-false" && (
            <div className="space-y-4 p-4 bg-amber-50 rounded-lg border-2 border-amber-200">
              <FormField
                control={form.control}
                name="correctAnswer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold">Correct Answer</FormLabel>
                    <FormDescription className="mb-3">
                      Select whether the statement is True or False
                    </FormDescription>
                    <FormControl>
                      <div className="flex gap-4 items-center pt-2">
                        <button
                          type="button"
                          onClick={() => field.onChange(true)}
                          className={cn(
                            "flex-1 px-6 py-4 rounded-lg border-2 font-semibold text-lg transition-all",
                            field.value === true
                              ? "bg-green-500 border-green-600 text-white shadow-md"
                              : "border-gray-300 bg-white text-gray-700 hover:border-green-400 hover:bg-green-50"
                          )}
                        >
                          ✓ True
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => field.onChange(false)}
                          className={cn(
                            "flex-1 px-6 py-4 rounded-lg border-2 font-semibold text-lg transition-all",
                            field.value === false
                              ? "bg-red-500 border-red-600 text-white shadow-md"
                              : "border-gray-300 bg-white text-gray-700 hover:border-red-400 hover:bg-red-50"
                          )}
                        >
                          ✕ False
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {questionType === "short-answer" && (
            <div className="space-y-4 p-4 bg-green-50 rounded-lg border-2 border-green-200">
              <div className="p-3 bg-white rounded border border-green-300">
                <p className="text-sm font-semibold text-gray-700 mb-2">Matching Settings:</p>
                <div className="flex flex-wrap gap-3">
                  <div className={cn(
                    "px-3 py-1 rounded-full text-sm font-medium",
                    form.watch("caseSensitive") 
                      ? "bg-blue-100 text-blue-800 border border-blue-300"
                      : "bg-gray-100 text-gray-800 border border-gray-300"
                  )}>
                    {form.watch("caseSensitive") ? "🔤 Case Sensitive" : "🔡 Case Insensitive"}
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-sm font-medium",
                    form.watch("requireExactMatch")
                      ? "bg-orange-100 text-orange-800 border border-orange-300"
                      : "bg-blue-100 text-blue-800 border border-blue-300"
                  )}>
                    {form.watch("requireExactMatch") ? "📌 Exact Match" : "🔍 Partial Match Allowed"}
                  </div>
                </div>
              </div>

              <ShortAnswerListManager
                control={form.control}
                answersName="correctAnswers"
                minAnswers={1}
                description="Add multiple variations of correct answers"
              />

              <div className="space-y-3 pt-2 border-t border-green-200">
                <FormField
                  control={form.control}
                  name="caseSensitive"
                  render={({ field }) => (
                    <FormItem className="flex items-start gap-3">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value || false}
                          onChange={field.onChange}
                          className="mt-1"
                          id="caseSensitive"
                        />
                      </FormControl>
                      <div className="flex-1">
                        <FormLabel htmlFor="caseSensitive" className="font-semibold cursor-pointer">
                          Case Sensitive
                        </FormLabel>
                        <FormDescription className="mt-1">
                          If checked: "Paris" ≠ "paris". If unchecked: "Paris" = "paris"
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requireExactMatch"
                  render={({ field }) => (
                    <FormItem className="flex items-start gap-3">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value || false}
                          onChange={field.onChange}
                          className="mt-1"
                          id="requireExactMatch"
                        />
                      </FormControl>
                      <div className="flex-1">
                        <FormLabel htmlFor="requireExactMatch" className="font-semibold cursor-pointer">
                          Require Exact Match
                        </FormLabel>
                        <FormDescription className="mt-1">
                          If checked: answer must exactly match one of the acceptable answers.<br/>
                          If unchecked: partial matching allowed (substrings match)
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <div className="p-3 bg-white rounded border border-green-300 mt-4">
                  <FormField
                    control={form.control}
                    name="requiresManualGrading"
                    render={({ field }) => (
                      <FormItem className="flex items-start gap-3">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value || false}
                            onChange={field.onChange}
                            className="mt-1"
                            id="requiresManualGrading"
                          />
                        </FormControl>
                        <div className="flex-1">
                          <FormLabel htmlFor="requiresManualGrading" className="font-semibold cursor-pointer">
                            Require Manual Grading by Teacher
                          </FormLabel>
                          <FormDescription className="mt-1">
                            If checked: Answers require teacher review instead of automatic evaluation.<br/>
                            If unchecked: Answers are automatically graded using the correct answers above.
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
          )}

          {questionType === "essay" && (
            <div className="space-y-4 p-4 bg-purple-50 rounded-lg">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="minWords"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Words (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="No minimum"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? Number(e.target.value) : undefined
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxWords"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum Words (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="No maximum"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? Number(e.target.value) : undefined
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {(() => {
                  const minWords = form.getValues("minWords");
                  const maxWords = form.getValues("maxWords");
                  
                  if (minWords || maxWords) {
                    let guidanceText = "Students must write: ";
                    if (minWords && maxWords) {
                      guidanceText += `between ${minWords} and ${maxWords} words`;
                    } else if (minWords) {
                      guidanceText += `at least ${minWords} words`;
                    } else if (maxWords) {
                      guidanceText += `no more than ${maxWords} words`;
                    }
                    
                    return (
                      <div className="p-3 bg-white rounded border border-purple-200">
                        <p className="text-sm text-purple-700">{guidanceText}</p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="space-y-2">
                <Label className="text-base font-semibold">Grading Rubric (Optional)</Label>
                <p className="text-sm text-gray-600">
                  Define grading criteria and point values for manual essay grading
                </p>
                
                {(() => {
                  const rubricPoints = form.getValues("rubricPoints") || [];
                  const totalRubricPoints = rubricPoints.reduce((sum: number, r: any) => sum + (r.points || 0), 0);
                  
                  return (
                    <div className="space-y-3">
                      {rubricPoints.length > 0 && (
                        <div className="p-3 bg-white rounded border border-purple-200">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">Rubric Criteria</span>
                            <span className="text-sm font-semibold text-purple-700">
                              Total Points: {totalRubricPoints}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {rubricPoints.map((_: any, index: number) => (
                              <div key={index} className="flex gap-2 items-start">
                                <FormField
                                  control={form.control}
                                  name={`rubricPoints.${index}.criteria`}
                                  render={({ field }) => (
                                    <FormControl>
                                      <Input
                                        placeholder={`Criterion ${index + 1} (e.g., "Clarity and Organization")`}
                                        {...field}
                                        className="flex-1"
                                      />
                                    </FormControl>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name={`rubricPoints.${index}.points`}
                                  render={({ field }) => (
                                    <FormControl>
                                      <Input
                                        type="number"
                                        min="0"
                                        placeholder="Points"
                                        {...field}
                                        onChange={(e) =>
                                          field.onChange(
                                            e.target.value ? Number(e.target.value) : 0
                                          )
                                        }
                                        className="w-20"
                                      />
                                    </FormControl>
                                  )}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newRubric = rubricPoints.filter((_: any, i: number) => i !== index);
                                    form.setValue("rubricPoints", newRubric, { shouldValidate: false });
                                  }}
                                  className="p-2 hover:bg-red-100 rounded"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => {
                          const currentRubric = form.getValues("rubricPoints") || [];
                          form.setValue(
                            "rubricPoints",
                            [...currentRubric, { criteria: "", points: 0 }],
                            { shouldValidate: false }
                          );
                        }}
                        className="flex items-center gap-2 text-purple-600 hover:text-purple-700 mt-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add Rubric Criterion
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          <FormField
            control={form.control}
            name="explanation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.questions.explanation")}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Provide explanation for the correct answer (optional)"
                    className="resize-none"
                    rows={2}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-gray-600" />
              <Label className="text-base">Question Image (Optional)</Label>
            </div>
            
            {imageUrl ? (
              <div className="space-y-4">
                <ImagePreview
                  imageUrl={imageUrl}
                  displayMode={imageDisplayMode}
                  questionText={form.getValues("questionText")}
                  onRemove={handleRemoveImage}
                  onModeChange={setImageDisplayMode}
                  showModeSelector={true}
                />
                
                <label className={cn(
                  "flex items-center justify-center w-full p-3 border-2 border-dashed rounded-lg cursor-pointer transition",
                  uploadingImage 
                    ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60" 
                    : "border-blue-300 hover:bg-blue-50"
                )}>
                  <div className="flex items-center justify-center gap-2">
                    {uploadingImage ? (
                      <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 text-blue-500" />
                    )}
                    <span className={cn(
                      "text-sm font-medium",
                      uploadingImage ? "text-gray-500" : "text-blue-600"
                    )}>
                      {uploadingImage ? "Uploading..." : "Replace image"}
                    </span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="hidden"
                  />
                </label>
                
                {uploadingImage && (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-gray-600">Uploading image...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className={cn(
                  "flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg cursor-pointer transition",
                  uploadingImage
                    ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                    : "border-gray-300 hover:bg-gray-100"
                )}>
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {uploadingImage ? (
                      <Loader2 className="w-8 h-8 text-gray-400 mb-2 animate-spin" />
                    ) : (
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    )}
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">
                        {uploadingImage ? "Uploading..." : "Click to upload"}
                      </span>{" "}
                      {!uploadingImage && "or drag and drop"}
                    </p>
                    <p className="text-xs text-gray-500">PNG, JPG, WebP, GIF (Max 5MB)</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="hidden"
                  />
                </label>
                
                {uploadingImage && (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-gray-600">Uploading image...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </fieldset>

        <div className="flex gap-2 justify-end">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isFormDisabled}>
              {t("common.cancel")}
            </Button>
          )}
          <Button type="submit" disabled={isFormDisabled || uploadingImage}>
            {isLoading || submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Question"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
