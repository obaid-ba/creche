import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, Button, Input, Modal, Select } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import { useChildren } from "@/features/children/hooks";
import { ApiError } from "@/services/errors";

import { useStartConversation } from "../hooks";

/**
 * Opens a new conversation about one child.
 *
 * The API has accepted this since the messaging endpoints were built, and
 * `useStartConversation` was already here — but nothing called either, so
 * a parent whose nursery had never written to them first landed on an
 * empty state with no way out of it. Replying worked; starting did not.
 *
 * Both roles use it. A parent picks from their own children, which are
 * already on the session; staff need the full list, so the picker is only
 * fetched for them.
 */
export function NewConversationModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}) {
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const isStaff = role === "STAFF" || role === "ADMIN";

  const [childId, setChildId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const start = useStartConversation();

  // Staff only: a parent's children arrive with the session.
  const staffChildren = useChildren(isStaff && isOpen ? { page_size: 100 } : {});

  const options = isStaff
    ? (staffChildren.data?.results ?? []).map((child) => ({
        value: child.id,
        label: child.full_name,
      }))
    : (user?.children ?? []).map((child) => ({
        value: child.id,
        label: `${child.first_name} ${child.last_name}`,
      }));

  // One child and no choice to make: preselect rather than asking a
  // parent to pick their only child out of a list of one.
  const onlyChild = options.length === 1 ? options[0]?.value : undefined;
  const selected = childId !== "" ? childId : (onlyChild ?? "");

  function reset() {
    setChildId("");
    setSubject("");
    setBody("");
    setError(null);
  }

  async function submit() {
    setError(null);
    try {
      const conversation = await start.mutateAsync({
        child_id: selected,
        subject: subject.trim(),
        body: body.trim(),
      });
      reset();
      onCreated(conversation.id);
      onClose();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : t("validation.unexpected"),
      );
    }
  }

  const canSubmit = selected !== "" && body.trim() !== "";

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        reset();
        onClose();
      }}
      title={t("messages.newTitle")}
      description={t("messages.newHint")}
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => void submit()}
            isLoading={start.isPending}
            disabled={!canSubmit}
          >
            {t("messages.send")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error !== null && <Alert tone="danger">{error}</Alert>}

        {/* Hidden when there is nothing to choose between. */}
        {options.length > 1 && (
          <Select
            label={t("messages.aboutChild")}
            value={selected}
            placeholder={t("messages.chooseChild")}
            options={options}
            onChange={(event) => setChildId(event.target.value)}
          />
        )}

        <Input
          label={t("messages.subjectOptional")}
          autoFocus
          value={subject}
          placeholder={t("messages.subjectPlaceholder")}
          onChange={(event) => setSubject(event.target.value)}
        />

        <div>
          <label
            htmlFor="new-conversation-body"
            className="mb-1.5 block text-sm font-semibold text-ink-700"
          >
            {t("messages.yourMessage")}
          </label>
          <textarea
            id="new-conversation-body"
            rows={4}
            value={body}
            placeholder={t("messages.placeholder")}
            onChange={(event) => setBody(event.target.value)}
            className="w-full rounded-card border border-ink-200 bg-shell px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
          />
        </div>
      </div>
    </Modal>
  );
}
