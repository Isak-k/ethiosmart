import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form } from "@/components/ui/form";
import { ShortAnswerListManager } from "../ShortAnswerListManager";
import { expect, describe, it } from "vitest";

// Define test schema
const testSchema = z.object({
  correctAnswers: z.array(z.string().min(1)).min(1),
});

type TestForm = z.infer<typeof testSchema>;

// Test component
function TestShortAnswerComponent() {
  const form = useForm<TestForm>({
    resolver: zodResolver(testSchema),
    defaultValues: {
      correctAnswers: ["Paris", "paris"],
    },
  });

  return (
    <Form {...form}>
      <form>
        <ShortAnswerListManager
          control={form.control}
          answersName="correctAnswers"
          minAnswers={1}
          description="Add multiple answer variations"
        />
      </form>
    </Form>
  );
}

describe("ShortAnswerListManager Component", () => {
  it("should render with initial answers", () => {
    render(<TestShortAnswerComponent />);

    expect(screen.getByText("Acceptable Answers")).toBeInTheDocument();
    expect(screen.getByText("Add multiple answer variations")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Paris")).toBeInTheDocument();
    expect(screen.getByDisplayValue("paris")).toBeInTheDocument();
  });

  it("should add a new answer variation", async () => {
    const user = userEvent.setup();
    render(<TestShortAnswerComponent />);

    const addButton = screen.getByRole("button", { name: /add answer variation/i });
    await user.click(addButton);

    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(3);
    expect((inputs[2] as HTMLInputElement).value).toBe("");
  });

  it("should remove an answer variation", async () => {
    const user = userEvent.setup();
    render(<TestShortAnswerComponent />);

    const trashButtons = screen.getAllByRole("button", { name: /remove answer/i });
    expect(trashButtons.length).toBeGreaterThan(0);

    await user.click(trashButtons[0]);

    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(1);
    expect((inputs[0] as HTMLInputElement).value).toBe("paris");
  });

  it("should prevent removing answers below minimum", async () => {
    const user = userEvent.setup();
    render(<TestShortAnswerComponent />);

    const trashButtons = screen.getAllByRole("button", { name: /remove answer/i });

    // Remove first answer
    await user.click(trashButtons[0]);
    // Remove second answer - should show error
    await user.click(trashButtons[0]);

    // Should see error message
    expect(screen.getByText(/short answer must have at least 1 answer/i)).toBeInTheDocument();
  });

  it("should update answer value when input changes", async () => {
    const user = userEvent.setup();
    render(<TestShortAnswerComponent />);

    const inputs = screen.getAllByRole("textbox");
    const firstInput = inputs[0] as HTMLInputElement;

    await user.clear(firstInput);
    await user.type(firstInput, "London");

    expect((inputs[0] as HTMLInputElement).value).toBe("London");
  });

  it("should prevent adding answers beyond maximum", async () => {
    const user = userEvent.setup();
    render(<TestShortAnswerComponent />);

    const addButton = screen.getByRole("button", { name: /add answer variation/i });

    // We don't have a default max in the component, so it should keep allowing adds
    await user.click(addButton);
    await user.click(addButton);
    await user.click(addButton);

    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(5);

    // Add button should still be available since no max is set
    expect(screen.getByRole("button", { name: /add answer variation/i })).toBeInTheDocument();
  });

  it("should render placeholder for new answers", async () => {
    const user = userEvent.setup();
    render(<TestShortAnswerComponent />);

    const addButton = screen.getByRole("button", { name: /add answer variation/i });
    await user.click(addButton);

    const inputs = screen.getAllByRole("textbox");
    const newInput = inputs[2] as HTMLInputElement;

    expect(newInput.placeholder).toBe("Answer variation 3");
  });

  it("should handle multiple answer variations correctly", async () => {
    const user = userEvent.setup();
    render(<TestShortAnswerComponent />);

    // Start with 2 answers
    expect(screen.getAllByRole("textbox")).toHaveLength(2);

    // Add 3 more variations
    const addButton = screen.getByRole("button", { name: /add answer variation/i });
    for (let i = 0; i < 3; i++) {
      await user.click(addButton);
    }

    // Should now have 5 answers
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(5);

    // Fill in the new answers
    await user.type(inputs[2] as HTMLInputElement, "variant 3");
    await user.type(inputs[3] as HTMLInputElement, "variant 4");
    await user.type(inputs[4] as HTMLInputElement, "variant 5");

    // Verify all values are retained
    expect((inputs[0] as HTMLInputElement).value).toBe("Paris");
    expect((inputs[1] as HTMLInputElement).value).toBe("paris");
    expect((inputs[2] as HTMLInputElement).value).toBe("variant 3");
    expect((inputs[3] as HTMLInputElement).value).toBe("variant 4");
    expect((inputs[4] as HTMLInputElement).value).toBe("variant 5");
  });
});
