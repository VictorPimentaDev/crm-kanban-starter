import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Workspace } from "@/components/workspace";
vi.mock("@/lib/supabase", () => ({ supabase: null }));
it("offers the public demo and local setup when no backend is configured", () => {
  render(<Workspace view="pipeline" />);
  expect(
    screen.getByRole("link", { name: /Experimentar demonstração/ }),
  ).toHaveAttribute("href", "/demo");
  expect(
    screen.getByRole("heading", { name: "Quer usar com seus dados?" }),
  ).toBeVisible();
  expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument();
});
