// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs } from "./Tabs";

type TabId = "alpha" | "beta" | "gamma";

const tabs: readonly { id: TabId; label: string }[] = [
  { id: "alpha", label: "Alfa" },
  { id: "beta", label: "Beta" },
  { id: "gamma", label: "Gamma" },
];

describe("Tabs", () => {
  it("renders the tablist with a tab per union member", () => {
    render(<Tabs tabs={tabs} active="alpha" onChange={() => {}} ariaLabel="Test tabs" />);

    expect(screen.getByRole("tablist", { name: "Test tabs" })).toBeInTheDocument();
    for (const t of tabs) {
      expect(screen.getByRole("tab", { name: t.label })).toBeInTheDocument();
    }
  });

  it("marks only the active tab as aria-selected", () => {
    render(<Tabs tabs={tabs} active="beta" onChange={() => {}} />);

    expect(screen.getByRole("tab", { name: "Alfa" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Gamma" })).toHaveAttribute("aria-selected", "false");
  });

  it("calls onChange with the clicked tab's id", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} active="alpha" onChange={onChange} />);

    await user.click(screen.getByRole("tab", { name: "Gamma" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("gamma");
  });
});
