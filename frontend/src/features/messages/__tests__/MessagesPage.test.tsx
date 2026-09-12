import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MessagesPage } from "@/pages/MessagesPage";

/**
 * A parent has to be able to *start* a conversation, not only reply.
 *
 * The API accepted this from the beginning and `useStartConversation`
 * existed, but nothing called either — so a parent whose nursery had
 * never written to them first landed on an empty state with no way out
 * of it. Nothing failed and no test noticed, because replying, which is
 * what the fixtures exercised, worked fine.
 */

const conversations = vi.hoisted(() => vi.fn());
const startConversation = vi.hoisted(() => vi.fn());

vi.mock("@/features/messages/api", () => ({
  messagesApi: {
    conversations,
    thread: vi.fn(async () => ({
      count: 0, page: 1, page_size: 20, total_pages: 1, results: [],
    })),
    send: vi.fn(),
    start: startConversation,
    markRead: vi.fn(async () => undefined),
  },
}));

const user = vi.hoisted(() => ({
  id: "u1", email: "parent@test", first_name: "Sarah", last_name: "Benali",
  role: "PARENT" as const, can_send_messages: true,
  children: [{ id: "c1", first_name: "Mohamed", last_name: "Benali", photo_url: null }],
}));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ user, role: "PARENT" }),
}));

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

const emptyPage = {
  count: 0, page: 1, page_size: 20, total_pages: 1, results: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  conversations.mockResolvedValue(emptyPage);
  startConversation.mockResolvedValue({
    id: "conv1",
    child: { id: "c1", first_name: "Mohamed", last_name: "Benali" },
    subject: "Horaires",
    is_closed: false,
    last_message: null,
    last_message_at: null,
    unread_count: 0,
    created_at: new Date().toISOString(),
  });
});

describe("parent messages", () => {
  it("offers a way out of the empty state", async () => {
    render(<MessagesPage />, { wrapper: Wrapper });

    expect(await screen.findByText("Aucun message")).toBeInTheDocument();
    // The whole point: the empty state is not a dead end.
    expect(
      screen.getByRole("button", { name: "Écrire à la crèche" }),
    ).toBeInTheDocument();
  });

  it("starts a conversation about the parent's own child", async () => {
    const person = userEvent.setup();
    render(<MessagesPage />, { wrapper: Wrapper });

    await person.click(await screen.findByRole("button", { name: "Écrire à la crèche" }));

    const dialog = await screen.findByRole("dialog");
    // One child and nothing to choose between: no picker to get wrong.
    expect(within(dialog).queryByRole("combobox")).not.toBeInTheDocument();

    await person.type(within(dialog).getByLabelText(/Sujet/), "Horaires");
    await person.type(
      within(dialog).getByLabelText("Votre message"),
      "Bonjour, une question.",
    );
    await person.click(within(dialog).getByRole("button", { name: "Envoyer" }));

    await waitFor(() =>
      expect(startConversation).toHaveBeenCalledWith({
        child_id: "c1",
        subject: "Horaires",
        body: "Bonjour, une question.",
      }),
    );
  });

  it("will not send an empty message", async () => {
    const person = userEvent.setup();
    render(<MessagesPage />, { wrapper: Wrapper });

    await person.click(await screen.findByRole("button", { name: "Écrire à la crèche" }));
    const dialog = await screen.findByRole("dialog");

    // A subject alone is not a message.
    await person.type(within(dialog).getByLabelText(/Sujet/), "Bonjour");
    expect(within(dialog).getByRole("button", { name: "Envoyer" })).toBeDisabled();
    expect(startConversation).not.toHaveBeenCalled();
  });

  it("hides the control from a parent whose messaging is switched off", async () => {
    user.can_send_messages = false;
    render(<MessagesPage />, { wrapper: Wrapper });

    expect(await screen.findByText("Aucun message")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Écrire à la crèche" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Nouveau message" }),
    ).not.toBeInTheDocument();
    user.can_send_messages = true;
  });
});
