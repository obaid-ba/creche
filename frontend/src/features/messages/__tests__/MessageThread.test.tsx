import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MessageThread } from "../components/MessageThread";
import type { Message } from "../types";

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "m1",
    conversation: "c1",
    body: "Bonjour",
    sender: { id: "u1", first_name: "Amina", last_name: "Sassi", role: "STAFF" },
    attachments: [],
    is_mine: false,
    is_read: true,
    created_at: "2026-09-04T09:00:00Z",
    ...overrides,
  };
}

describe("MessageThread", () => {
  it("renders messages oldest first, reversing the newest-first API order", () => {
    render(
      <MessageThread
        messages={[
          makeMessage({ id: "b", body: "Deuxième", created_at: "2026-09-04T10:00:00Z" }),
          makeMessage({ id: "a", body: "Premier", created_at: "2026-09-04T09:00:00Z" }),
        ]}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(within(items[0] as HTMLElement).getByText("Premier")).toBeInTheDocument();
    expect(within(items[1] as HTMLElement).getByText("Deuxième")).toBeInTheDocument();
  });

  it("labels the sender on incoming messages only", () => {
    render(
      <MessageThread
        messages={[
          makeMessage({ id: "a", is_mine: false }),
          makeMessage({ id: "b", is_mine: true, body: "Merci" }),
        ]}
      />,
    );

    // "Amina · Équipe" appears once, on the incoming message.
    expect(screen.getAllByText(/Amina/)).toHaveLength(1);
  });

  it("marks a staff sender as part of the team", () => {
    render(<MessageThread messages={[makeMessage()]} />);

    expect(screen.getByText(/Équipe/)).toBeInTheDocument();
  });

  it("does not tag a parent sender as team", () => {
    render(
      <MessageThread
        messages={[
          makeMessage({
            sender: { id: "u2", first_name: "Sarah", last_name: "B", role: "PARENT" },
          }),
        ]}
      />,
    );

    expect(screen.queryByText(/Équipe/)).not.toBeInTheDocument();
  });

  it("renders attachment thumbnails", () => {
    const { container } = render(
      <MessageThread
        messages={[
          makeMessage({
            attachments: [
              {
                id: "a1",
                file_url: "https://x.test/a.jpg",
                thumbnail_url: "https://x.test/a_t.jpg",
                content_type: "image/jpeg",
                size_bytes: 1234,
              },
            ],
          }),
        ]}
      />,
    );

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://x.test/a_t.jpg",
    );
  });

  it("exposes a machine-readable timestamp", () => {
    const { container } = render(<MessageThread messages={[makeMessage()]} />);

    expect(container.querySelector("time")).toHaveAttribute(
      "dateTime",
      "2026-09-04T09:00:00Z",
    );
  });

  it("renders nothing but the anchor for an empty thread", () => {
    render(<MessageThread messages={[]} />);

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
