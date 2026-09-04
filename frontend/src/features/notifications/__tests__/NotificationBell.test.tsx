import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/services/client";

import { NotificationBell } from "../components/NotificationBell";
import type { AppNotification } from "../types";

function makeNotification(
  overrides: Partial<AppNotification> = {},
): AppNotification {
  return {
    id: "n1",
    type: "NEW_MESSAGE",
    type_label: "Nouveau message",
    title: "Nouveau message · Mohamed",
    body: "Bonjour, tout s'est bien passé.",
    link: "/parent/messages",
    child: { id: "c1", first_name: "Mohamed" },
    is_read: false,
    read_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function mockApi(items: AppNotification[], unread: number) {
  vi.spyOn(apiClient, "get").mockImplementation(async (url: string) => {
    if (url.includes("unread-count")) return { data: { unread } } as never;
    return {
      data: {
        count: items.length,
        page: 1,
        page_size: 20,
        total_pages: 1,
        results: items,
      },
    } as never;
  });
  return vi.spyOn(apiClient, "post").mockResolvedValue({ data: {} } as never);
}

function renderBell() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("NotificationBell", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("shows the unread count on the badge", async () => {
    mockApi([makeNotification()], 3);
    renderBell();

    expect(
      await screen.findByRole("button", { name: /3 non lues/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("caps the badge at 9+ so it cannot break the layout", async () => {
    mockApi([], 42);
    renderBell();

    expect(await screen.findByText("9+")).toBeInTheDocument();
  });

  it("shows no badge when everything is read", async () => {
    mockApi([], 0);
    renderBell();

    expect(
      await screen.findByRole("button", { name: "Notifications" }),
    ).toBeInTheDocument();
  });

  it("lists notifications when opened", async () => {
    mockApi([makeNotification()], 1);
    renderBell();

    await userEvent.click(await screen.findByRole("button", { name: /non lues/i }));

    expect(screen.getByText("Nouveau message · Mohamed")).toBeInTheDocument();
    expect(screen.getByText(/tout s'est bien passé/)).toBeInTheDocument();
  });

  it("shows an empty state when there is nothing", async () => {
    mockApi([], 0);
    renderBell();

    await userEvent.click(await screen.findByRole("button", { name: "Notifications" }));

    expect(screen.getByText("Aucune notification.")).toBeInTheDocument();
  });

  it("marks one read when clicked", async () => {
    const post = mockApi([makeNotification()], 1);
    renderBell();

    await userEvent.click(await screen.findByRole("button", { name: /non lues/i }));
    await userEvent.click(screen.getByText("Nouveau message · Mohamed"));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/notifications/n1/read/"),
    );
  });

  it("does not re-mark an already-read notification", async () => {
    const post = mockApi([makeNotification({ is_read: true })], 0);
    renderBell();

    await userEvent.click(await screen.findByRole("button", { name: "Notifications" }));
    await userEvent.click(screen.getByText("Nouveau message · Mohamed"));

    expect(post).not.toHaveBeenCalledWith("/notifications/n1/read/");
  });

  it("offers mark-all only when something is unread", async () => {
    mockApi([makeNotification({ is_read: true })], 0);
    const { unmount } = renderBell();
    await userEvent.click(await screen.findByRole("button", { name: "Notifications" }));
    expect(screen.queryByText(/tout marquer comme lu/i)).not.toBeInTheDocument();
    unmount();

    mockApi([makeNotification()], 1);
    renderBell();
    await userEvent.click(await screen.findByRole("button", { name: /non lues/i }));
    expect(screen.getByText(/tout marquer comme lu/i)).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    mockApi([makeNotification()], 1);
    renderBell();

    await userEvent.click(await screen.findByRole("button", { name: /non lues/i }));
    expect(screen.getByText("Notifications")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByText("Aucune notification.")).not.toBeInTheDocument(),
    );
  });
});
