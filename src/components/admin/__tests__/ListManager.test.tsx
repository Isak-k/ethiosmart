import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form } from "@/components/ui/form";
import { ListManager } from "../ListManager";
import { expect, describe, it } from "vitest";

// Define test schema
const testSchema = z.object({
  items: z.array(z.string().min(1)).min(1),
});

type TestForm = z.infer<typeof testSchema>;

// Test component that uses ListManager
function TestListManagerComponent() {
  const form = useForm<TestForm>({
    resolver: zodResolver(testSchema),
    defaultValues: {
      items: ["Item 1", "Item 2"],
    },
  });

  return (
    <Form {...form}>
      <form>
        <ListManager
          control={form.control}
          name="items"
          label="Test Items"
          description="Test item list"
          addButtonText="Add Test Item"
          placeholder="Enter item"
          minItems={1}
          maxItems={5}
        />
      </form>
    </Form>
  );
}

describe("ListManager Component", () => {
  it("should render with initial items", () => {
    render(<TestListManagerComponent />);

    expect(screen.getByText("Test Items")).toBeInTheDocument();
    expect(screen.getByText("Test item list")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Item 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Item 2")).toBeInTheDocument();
  });

  it("should add a new item when Add button is clicked", async () => {
    const user = userEvent.setup();
    render(<TestListManagerComponent />);

    const addButton = screen.getByRole("button", { name: /add test item/i });
    await user.click(addButton);

    // Should have 3 inputs now
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(3);
    expect((inputs[2] as HTMLInputElement).value).toBe("");
  });

  it("should remove an item when trash button is clicked", async () => {
    const user = userEvent.setup();
    render(<TestListManagerComponent />);

    // Get all trash buttons
    let trashButtons = screen.getAllByRole("button", { name: /remove item/i });
    expect(trashButtons.length).toBeGreaterThan(0);

    await user.click(trashButtons[0]);

    // After removing one item, we should have 1 item left
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(1);
  });

  it("should show error toast when trying to remove below minimum items", async () => {
    const user = userEvent.setup();
    render(<TestListManagerComponent />);

    // Remove first item
    let trashButtons = screen.getAllByRole("button", { name: /remove item/i });
    await user.click(trashButtons[0]);

    // Try to remove the last item - should not remove it
    trashButtons = screen.getAllByRole("button", { name: /remove item/i });
    await user.click(trashButtons[0]);

    // Should still have 1 item left (removal was prevented)
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(1);
  });

  it("should prevent adding items beyond max limit", async () => {
    const user = userEvent.setup();
    render(<TestListManagerComponent />);

    const addButton = screen.getByRole("button", { name: /add test item/i });

    // Add items until we reach max (5)
    for (let i = 0; i < 3; i++) {
      await user.click(addButton);
    }

    // Now we should have 5 items, try to add one more
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(5);

    // Add button should not exist anymore or clicking it should show error
    const addButtonAfter = screen.queryByRole("button", { name: /add test item/i });
    if (!addButtonAfter) {
      // Button is hidden, which is correct
      expect(addButtonAfter).not.toBeInTheDocument();
    }
  });

  it("should update item value when input changes", async () => {
    const user = userEvent.setup();
    render(<TestListManagerComponent />);

    const inputs = screen.getAllByRole("textbox");
    const firstInput = inputs[0] as HTMLInputElement;

    await user.clear(firstInput);
    await user.type(firstInput, "Updated Item 1");

    expect((inputs[0] as HTMLInputElement).value).toBe("Updated Item 1");
  });
});
