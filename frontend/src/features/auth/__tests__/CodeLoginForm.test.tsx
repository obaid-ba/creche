import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CodeLoginForm } from "../components/CodeLoginForm";

/**
 * The parent's only way in. Two fields, no password, no registration —
 * so the things worth asserting are that it sends exactly those two, and
 * that a rejection leaves what was typed on screen to be corrected.
 */
const codeLogin = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/useAuth", () => ({ useAuth: () => ({ codeLogin }) }));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));

function renderForm() {
  return render(
    <MemoryRouter>
      <CodeLoginForm />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  codeLogin.mockResolvedValue({ id: "u1", role: "PARENT" });
});

describe("parent code login", () => {
  it("asks for a code and a child's name, and nothing else", () => {
    renderForm();

    expect(screen.getByLabelText(/Code d'accès/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Prénom de l'enfant/)).toBeInTheDocument();
    // No password: the parent never chose one.
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it("sends the pair and lands the parent in their space", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Code d'accès/), "MAM-7F42-K9QX");
    await user.type(screen.getByLabelText(/Prénom de l'enfant/), "Mohamed");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    await waitFor(() =>
      expect(codeLogin).toHaveBeenCalledWith({
        access_code: "MAM-7F42-K9QX",
        child_name: "Mohamed",
      }),
    );
    expect(navigate).toHaveBeenCalledWith("/parent", { replace: true });
  });

  it("trims what was typed, because these are read off paper", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Code d'accès/), "  mam-7f42-k9qx ");
    await user.type(screen.getByLabelText(/Prénom de l'enfant/), " Mohamed ");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    await waitFor(() =>
      expect(codeLogin).toHaveBeenCalledWith({
        access_code: "mam-7f42-k9qx",
        child_name: "Mohamed",
      }),
    );
  });

  it("will not submit an empty pair", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    await screen.findByText("Le code d'accès est requis.");
    expect(codeLogin).not.toHaveBeenCalled();
  });

  it("keeps the fields when the server rejects the pair", async () => {
    const user = userEvent.setup();
    const { ApiError } = await import("@/services/errors");
    codeLogin.mockRejectedValue(
      new ApiError({ code: "invalid", message: "Code d'accès ou prénom incorrect.", status: 400 }),
    );
    renderForm();

    await user.type(screen.getByLabelText(/Code d'accès/), "MAM-7F42-K9QX");
    await user.type(screen.getByLabelText(/Prénom de l'enfant/), "Faux");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    await screen.findByText("Code d'accès ou prénom incorrect.");
    // Nothing is lost: a parent re-reading a paper code should not have
    // to type it again.
    expect(screen.getByLabelText(/Code d'accès/)).toHaveValue("MAM-7F42-K9QX");
    expect(navigate).not.toHaveBeenCalled();
  });
});
