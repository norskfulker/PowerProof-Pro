import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaxCodes } from "@/components/settings/tax-codes";
import { TAX_CODES } from "@/lib/tax-codes";

const mine = { id: "t1", code: "852349", kind: "HSN" as const, description: "Your own code", rate: 12 };

describe("TaxCodes", () => {
  it("lists the reference codes and marks your own, which are the only ones that can be removed", () => {
    render(<TaxCodes codes={[...TAX_CODES, mine]} onAdd={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/HSN 852349/)).toBeInTheDocument();
    expect(screen.getAllByText("Yours")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(1);
  });

  it("adds a code with its rate, and says what's wrong with a bad one", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<TaxCodes codes={TAX_CODES} onAdd={onAdd} onDelete={vi.fn()} />);
    const form = screen.getByRole("form", { name: "Add your own code" });
    await userEvent.type(within(form).getByLabelText("Code"), "99");
    await userEvent.click(within(form).getByRole("button", { name: /Add code/ }));
    expect(await within(form).findByRole("alert")).toHaveTextContent(/4 to 8 digits/);
    expect(onAdd).not.toHaveBeenCalled();
    await userEvent.clear(within(form).getByLabelText("Code"));
    await userEvent.type(within(form).getByLabelText("Code"), "998a439");
    expect(within(form).getByLabelText("Code")).toHaveValue("998439");
    await userEvent.clear(within(form).getByLabelText("GST (%)"));
    await userEvent.type(within(form).getByLabelText("GST (%)"), "45");
    await userEvent.click(within(form).getByRole("button", { name: /Add code/ }));
    expect(await within(form).findByRole("alert")).toHaveTextContent(/0% and 40%/);
    await userEvent.clear(within(form).getByLabelText("GST (%)"));
    await userEvent.type(within(form).getByLabelText("GST (%)"), "12");
    await userEvent.click(within(form).getByRole("button", { name: /Add code/ }));
    expect(onAdd).toHaveBeenCalledWith({ code: "998439", kind: "SAC", description: "", rate: 12 });
  });

  it("asks before removing, and tells you the invoices don't change", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<TaxCodes codes={[...TAX_CODES, mine]} onAdd={vi.fn()} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove 852349" }));
    expect(await screen.findByText(/invoices don't change/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove code" }));
    expect(onDelete).toHaveBeenCalledWith("t1");
  });
});
