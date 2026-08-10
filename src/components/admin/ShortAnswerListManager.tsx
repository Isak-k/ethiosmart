import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormControl, FormField, FormItem, FormMessage, FormDescription } from "@/components/ui/form";
import { Control, FieldValues, Path } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";

interface ShortAnswerListManagerProps<T extends FieldValues> {
  control: Control<T>;
  answersName: Path<T>;
  minAnswers?: number;
  maxAnswers?: number;
  label?: string;
  description?: string;
  className?: string;
}

/**
 * Specialized component for managing Short Answer acceptable answers
 * Features:
 * - Add/remove answer variations
 * - Simple list management
 * - Enforces minimum answer requirement
 */
export function ShortAnswerListManager<T extends FieldValues>({
  control,
  answersName,
  minAnswers = 1,
  maxAnswers,
  label = "Acceptable Answers",
  description = "Add multiple variations of correct answers that students might provide",
  className,
}: ShortAnswerListManagerProps<T>) {
  const { toast } = useToast();

  return (
    <FormField
      control={control}
      name={answersName}
      render={({ field }) => {
        const answers = field.value || [];

        const handleAddAnswer = () => {
          if (maxAnswers && answers.length >= maxAnswers) {
            toast({
              description: `Maximum ${maxAnswers} answers allowed`,
              variant: "destructive",
            });
            return;
          }
          const newAnswers = [...answers, ""];
          field.onChange(newAnswers);
        };

        const handleRemoveAnswer = (index: number) => {
          if (answers.length <= minAnswers) {
            toast({
              description: `Short Answer must have at least ${minAnswers} answer${minAnswers !== 1 ? "s" : ""}`,
              variant: "destructive",
            });
            return;
          }

          const newAnswers = answers.filter((_: any, i: number) => i !== index);
          field.onChange(newAnswers);
        };

        return (
          <FormItem className={className}>
            <Label className="text-base font-semibold">{label}</Label>
            {description && (
              <FormDescription className="mt-1">{description}</FormDescription>
            )}

            <div className="space-y-2 mt-3">
              {answers.length > 0 && (
                <div className="space-y-2">
                  {answers.map((_: any, index: number) => (
                    <FormField
                      key={index}
                      control={control}
                      name={`${answersName}.${index}` as Path<T>}
                      render={({ field: answerField }) => (
                        <div className="flex gap-2 items-start">
                          <FormControl>
                            <Input
                              placeholder={`Answer variation ${index + 1}`}
                              {...answerField}
                              value={answerField.value || ""}
                              className="flex-1"
                            />
                          </FormControl>

                          {/* Remove Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveAnswer(index)}
                            className="p-2 hover:bg-red-100 rounded flex-shrink-0 transition"
                            title="Remove this answer"
                            aria-label="Remove answer"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      )}
                    />
                  ))}
                </div>
              )}

              {/* Add Button */}
              {!maxAnswers || answers.length < maxAnswers ? (
                <button
                  type="button"
                  onClick={handleAddAnswer}
                  className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium mt-3"
                >
                  <Plus className="w-4 h-4" />
                  Add Answer Variation
                </button>
              ) : null}
            </div>

            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
