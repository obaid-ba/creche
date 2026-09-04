import { useEffect, useRef } from "react";

import { cn } from "@/lib/cn";

import type { Message } from "../types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * A conversation, oldest first.
 *
 * The API returns newest-first (cursor pagination over a growing list),
 * so the order is reversed here for reading.
 */
export function MessageThread({ messages }: { messages: Message[] }) {
  const endRef = useRef<HTMLLIElement>(null);
  const ordered = [...messages].reverse();

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  return (
    <ol className="space-y-3">
      {ordered.map((message) => (
        <li
          key={message.id}
          className={cn("flex", message.is_mine ? "justify-end" : "justify-start")}
        >
          <div
            className={cn(
              "max-w-[85%] rounded-card px-4 py-2.5 shadow-soft sm:max-w-[70%]",
              message.is_mine
                ? "bg-primary-500 text-white"
                : "bg-white text-ink-800 ring-1 ring-ink-100",
            )}
          >
            {!message.is_mine && message.sender !== null && (
              <p className="text-xs font-bold text-ink-400">
                {message.sender.first_name}
                {message.sender.role !== "PARENT" && " · Équipe"}
              </p>
            )}

            <p className="whitespace-pre-wrap text-sm">{message.body}</p>

            {message.attachments.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {message.attachments.map((attachment) => (
                  <li key={attachment.id}>
                    {attachment.thumbnail_url !== null && (
                      <img
                        src={attachment.thumbnail_url}
                        alt=""
                        loading="lazy"
                        className="size-20 rounded-card object-cover"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}

            <time
              dateTime={message.created_at}
              className={cn(
                "mt-1 block text-[0.7rem]",
                // Full white, not a tint: at this size anything less
                // than 4.5:1 on the primary bubble fails AA.
                message.is_mine ? "text-white" : "text-ink-400",
              )}
            >
              {formatTime(message.created_at)}
            </time>
          </div>
        </li>
      ))}
      {/* Scroll anchor. An <ol> may only contain <li>, so it is one. */}
      <li ref={endRef} aria-hidden="true" />
    </ol>
  );
}
