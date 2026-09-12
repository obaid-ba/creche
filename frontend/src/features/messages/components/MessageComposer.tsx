import { Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";

import { Alert, Button } from "@/components/ui";
import { ApiError } from "@/services/errors";

export function MessageComposer({
  onSend,
  isPending,
  disabledReason,
}: {
  onSend: (body: string) => Promise<unknown>;
  isPending: boolean;
  disabledReason?: string;
}) {
  const { t } = useTranslation();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (disabledReason !== undefined) {
    return <Alert tone="info">{disabledReason}</Alert>;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if (trimmed === "") return;

    setError(null);
    try {
      await onSend(trimmed);
      setBody("");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : t("messages.sendError"),
      );
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      {error !== null && <Alert tone="danger">{error}</Alert>}

      <label className="sr-only" htmlFor="message-body">
        {t("messages.yourMessage")}
      </label>
      <textarea
        id="message-body"
        rows={3}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={t("messages.placeholder")}
        className="w-full rounded-card border border-ink-200 bg-shell px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
      />

      <div className="flex justify-end">
        <Button
          type="submit"
          isLoading={isPending}
          disabled={body.trim() === ""}
          leftIcon={<Send className="size-4" />}
        >
          {t("messages.send")}
        </Button>
      </div>
    </form>
  );
}
