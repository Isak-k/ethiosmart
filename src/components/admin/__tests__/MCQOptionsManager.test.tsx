import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form } from "@/components/ui/form";
import { MCQOptionsManager } from "../MCQOptionsManager";
import { expect, describe, it, beforeEach, vi } from "vitest";

// Define test schema
const testSchema = z.object({
  options: z.array(z.string().min(1)).min(2),
  correctOptionIndex: z.number().min(0),
});

type TestForm = z.infer<typeof testSchema>;

// Test component
function TestMCQComponent() {
  const form = useForm<TestForm>({
    resolver: zodResolver(testSchema),
    defaultValues: {
      options: ["Option A", "Option B", "Option C"],
      correctOptionIndex: 1,
    },
  });

  return (
    <Form {...form}>
      <form>
        <MCQOptionsManager
          control={form.control}
          optionsName="options"
          correctIndexName="correctOptionIndex"
          minOptions={2}
          maxOptions={6}
        />
      </form>
    </Form>
  );
}

describe("MCQOptionsManager Component", () => {
  it("should render with initial options", () => {
    render(<TestMCQComponent />);

    expect(screen.getByText("Options")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Option A")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Option B")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Option C")).toBeInTheDocument();
  });

  it("should display correct answer indicator on the marked option", () => {
    render(<TestMCQComponent />);

    // Find the checkmark button - should be highlighted for Option B (index 1)
    const checkmarkButtons = screen.getAllByRole("button", { name: /mark as correct answer/i });
    
    // The second checkmark button should have the green styling
    expect(checkmarkButtons[1]).toHaveClass("bg-green-500");
    expect(checkmarkButtons[1]).toHaveClass("text-white");
  });

  it("should update correct answer when checkmark is clicked", async () => {
    const user = userEvent.setup();
    render(<TestMCQComponent />);

    const checkmarkButtons = screen.getAllByRole("button", { name: /mark as correct answer/i });

    // Click on first option's checkmark
    await user.click(checkmarkButtons[0]);

    // First checkmark should now be green
    expect(checkmarkButtons[0]).toHaveClass("bg-green-500");
  });

  it("should add a new option", async () => {
    const user = userEvent.setup();
    render(<TestMCQComponent />);

    const addButton = screen.getByRole("button", { name: /add option/i });
    await user.click(addButton);

    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(4);
  });

  it("should remove an option", async () => {
    const user = userEvent.setup();
    render(<TestMCQComponent />);

    const trashButtons = screen.getAllByRole("button", { name: /remove option/i });
    expect(trashButtons.length).toBeGreaterThan(0);

    await user.click(trashButtons[0]);

    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(2);
  });

  it("should prevent removing options below minimum", async () => {
    const user = userEvent.setup();
    render(<TestMCQComponent />);

    const trashButtons = screen.getAllByRole("button", { name: /remove option/i });

    // Remove first option
    await user.click(trashButtons[0]);
    // Remove second option
    await user.click(trashButtons[0]);
    // Try to remove last option - should show error
    await user.click(trashButtons[0]);

    // Should see error message
    expect(screen.getByText(/MCQ must have at least 2 options/i)).toBeInTheDocument();
  });

  it("should prevent adding options beyond maximum", async () => {
    const user = userEvent.setup();
    render(<TestMCQComponent />);

    const addButton = screen.getByRole("button", { name: /add option/i });

    // Add options until we reach max (6), we have 3 now, so add 3 more
    for (let i = 0; i < 3; i++) {
      await user.click(addButton);
    }

    // Should have 6 options
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(6);

    // Add button should not be available
    expect(screen.queryByRole("button", { name: /add option/i })).not.toBeInTheDocument();
  });

  it("should update option value when input changes", async () => {
    const user = userEvent.setup();
    render(<TestMCQComponent />);

    const inputs = screen.getAllByRole("textbox");
    const firstInput = inputs[0] as HTMLInputElement;

    await user.clear(firstInput);
    await user.type(firstInput, "Updated Option");

    expect((inputs[0] as HTMLInputElement).value).toBe("Updated Option");
  });

  it("should show correct answer has checkmark on correct option", () => {
    render(<TestMCQComponent />);

    const checkmarkButtons = screen.getAllByRole("button", { name: /mark as correct answer/i });

    // Verify the correct index (1) has the green styling
    expect(checkmarkButtons[1]).toHaveClass("bg-green-500");
    expect(checkmarkButtons[1]).toHaveClass("text-white");

    // Verify others don't
    expect(checkmarkButtons[0]).not.toHaveClass("bg-green-500");
    expect(checkmarkButtons[2]).not.toHaveClass("bg-green-500");
  });
});
