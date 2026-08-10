import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Control, FieldValues, Path } from "react-hook-form";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ListManagerProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  description?: string;
  addButtonText?: string;
  placeholder?: string;
  minItems?: number;
  maxItems?: number;
  emptyItemValue?: any;
  onAddItem?: (items: any[]) => void;
  onRemoveItem?: (items: any[], index: number) => void;
  renderItem?: (item: any, index: number, field: any) => React.ReactNode;
  allowReorder?: boolean;
  allowSelectCorrect?: boolean;
  selectedIndex?: number;
  onSelectCorrect?: (index: number) => void;
  className?: string;
}

export function ListManager<T extends FieldValues>({
  control,
  name,
  label,
  description,
  addButtonText = "Add Item",
  placeholder,
  minItems = 1,
  maxItems,
  emptyItemValue = "",
  onAddItem,
  onRemoveItem,
  renderItem,
  allowReorder = false,
  allowSelectCorrect = false,
  selectedIndex,
  onSelectCorrect,
  className,
}: ListManagerProps<T>) {
  const { toast } = useToast();

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const items = field.value || [];

        const handleAdd = () => {
          const newItems = [...items, emptyItemValue];
          field.onChange(newItems);
          onAddItem?.(newItems);
        };

        const handleRemove = (index: number) => {
          if (items.length <= minItems) {
            toast({
              description: `Must have at least ${minItems} item${minItems !== 1 ? "s" : ""}`,
              variant: "destructive",
            });
            return;
          }
          const newItems = items.filter((_: any, i: number) => i !== index);
          field.onChange(newItems);
          onRemoveItem?.(newItems, index);
        };

        const handleMoveUp = (index: number) => {
          if (index === 0) return;
          const newItems = [...items];
          [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
          field.onChange(newItems);
        };

        const handleMoveDown = (index: number) => {
          if (index === items.length - 1) return;
          const newItems = [...items];
          [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
          field.onChange(newItems);
        };

        return (
          <FormItem className={className}>
            <Label className="text-base font-semibold">{label}</Label>
            {description && (
              <p className="text-sm text-gray-600 mt-1">{description}</p>
            )}
            
            <div className="space-y-2 mt-3">
              {items.length > 0 && (
                <div className="space-y-2">
                  {items.map((_: any, index: number) => (
                    <div key={index} className="flex gap-2 items-start group">
                      {renderItem ? (
                        renderItem(items[index], index, field)
                      ) : (
                        <>
                          <FormField
                            control={control}
                            name={`${name}.${index}` as Path<T>}
                            render={({ field: itemField }) => (
                              <FormControl>
                                <Input
                                  placeholder={placeholder || `Item ${index + 1}`}
                                  {...itemField}
                                  className="flex-1"
                                />
                              </FormControl>
                            )}
                          />
                        </>
                      )}

                      {/* Correct Answer Indicator */}
                      {allowSelectCorrect && (
                        <button
                          type="button"
                          onClick={() => onSelectCorrect?.(index)}
                          className={cn(
                            "px-3 py-2 rounded border-2 transition-all flex-shrink-0",
                            selectedIndex === index
                              ? "bg-green-500 border-green-600 text-white shadow-md"
                              : "border-gray-300 text-gray-600 hover:border-green-400 hover:bg-green-50"
                          )}
                          title="Mark as correct"
                        >
                          ✓
                        </button>
                      )}

                      {/* Reorder Buttons */}
                      {allowReorder && (
                        <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            className="p-2 hover:bg-blue-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(index)}
                            disabled={index === items.length - 1}
                            className="p-2 hover:bg-blue-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemove(index)}
                        className="p-2 hover:bg-red-100 rounded flex-shrink-0"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Button */}
              {(!maxItems || items.length < maxItems) && (
                <Button
                  type="button"
                  onClick={handleAdd}
                  variant="ghost"
                  className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {addButtonText}
                </Button>
              )}
            </div>
            
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
