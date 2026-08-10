import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Control, FieldValues, Path } from "react-hook-form";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface MCQOptionsManagerProps<T extends FieldValues> {
  control: Control<T>;
  optionsName: Path<T>;
  correctIndexName: Path<T>;
  minOptions?: number;
  maxOptions?: number;
  label?: string;
  description?: string;
  className?: string;
}

/**
 * Specialized component for managing MCQ options with correct answer selection
 * Features:
 * - Add/remove options
 * - Mark correct answer with visual indicator
 * - Prevents removing correct option if it would violate constraints
 */
export function MCQOptionsManager<T extends FieldValues>({
  control,
  optionsName,
  correctIndexName,
  minOptions = 2,
  maxOptions = 6,
  label = "Options",
  description = "Add multiple choice options. Click ✓ to mark the correct answer.",
  className,
}: MCQOptionsManagerProps<T>) {
  const { toast } = useToast();

  return (
    <FormField
      control={control}
      name={optionsName}
      render={({ field }) => {
        const options = field.value || [];

        const handleAddOption = () => {
          if (maxOptions && options.length >= maxOptions) {
            toast({
              description: `Maximum ${maxOptions} options allowed`,
              variant: "destructive",
            });
            return;
          }
          const newOptions = [...options, ""];
          field.onChange(newOptions);
        };

        const handleRemoveOption = (index: number) => {
          if (options.length <= minOptions) {
            toast({
              description: `MCQ must have at least ${minOptions} options`,
              variant: "destructive",
            });
            return;
          }

          // If removing the correct option, adjust the correct index
          let newCorrectIndex = 0;
          const correctIndexControl = (control as any)._fields.get?.(correctIndexName) as any;
          const currentCorrectIndex = correctIndexControl?.value || 0;

          if (index === currentCorrectIndex) {
            newCorrectIndex = Math.max(0, options.length - 2);
          } else if (index < currentCorrectIndex) {
            newCorrectIndex = currentCorrectIndex - 1;
          } else {
            newCorrectIndex = currentCorrectIndex;
          }

          const newOptions = options.filter((_: any, i: number) => i !== index);
          field.onChange(newOptions);

          // Use setValue from control if available
          if ((control as any).setValue) {
            (control as any).setValue(correctIndexName, newCorrectIndex, { shouldValidate: false });
          }
        };

        return (
          <FormItem className={className}>
            <Label className="text-base font-semibold">{label}</Label>
            {description && (
              <p className="text-sm text-gray-600 mt-1">{description}</p>
            )}

            <div className="space-y-2 mt-3">
              {options.length > 0 && (
                <div className="space-y-2">
                  {options.map((_: any, index: number) => (
                    <FormField
                      key={index}
                      control={control}
                      name={`${optionsName}.${index}` as Path<T>}
                      render={({ field: optionField }) => (
                        <div className="flex gap-2 items-start">
                          <FormControl>
                            <Input
                              placeholder={`Option ${index + 1}`}
                              {...optionField}
                              value={optionField.value || ""}
                              className="flex-1"
                            />
                          </FormControl>

                          {/* Correct Answer Selector */}
                          <FormField
                            control={control}
                            name={correctIndexName}
                            render={({ field: correctField }) => (
                              <button
                                type="button"
                                onClick={() => correctField.onChange(index)}
                                className={cn(
                                  "px-3 py-2 rounded border-2 transition-all flex-shrink-0",
                                  correctField.value === index
                                    ? "bg-green-500 border-green-600 text-white shadow-md"
                                    : "border-gray-300 text-gray-600 hover:border-green-400 hover:bg-green-50"
                                )}
                                title="Mark as correct answer"
                              >
                                ✓
                              </button>
                            )}
                          />

                          {/* Remove Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(index)}
                            className="p-2 hover:bg-red-100 rounded flex-shrink-0"
                            title="Remove this option"
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
              {!maxOptions || options.length < maxOptions ? (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mt-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Option
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
