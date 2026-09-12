import { MessageSquareWarning, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageShell } from "@/components/app";
import { Alert, Button, Card, CardBody, EmptyState, ErrorState, Input, LoadingState, Modal, Pagination, Select } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";
import { ComplaintCard } from "@/features/complaints/components/ComplaintCard";
import { useComplaints, useCreateComplaint } from "@/features/complaints/hooks";
import {
  STATUS_LABEL_KEYS,
  type ComplaintStatus,
} from "@/features/complaints/types";
import { ApiError } from "@/services/errors";

const STATUSES: ComplaintStatus[] = ["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"];

/** Shared screen: parents file and follow, staff triage. */
export function ComplaintsPage() {
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const isParent = role === "PARENT";

  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [childId, setChildId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const query = useComplaints({ status, page });
  const createComplaint = useCreateComplaint();

  async function submit() {
    setFormError(null);
    try {
      await createComplaint.mutateAsync({
        subject: subject.trim(),
        message: message.trim(),
        child_id: childId === "" ? null : childId,
      });
      setSubject("");
      setMessage("");
      setChildId("");
      setIsFormOpen(false);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : t("complaints.sendError"),
      );
    }
  }

  return (
    <PageShell size="form">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-secondary-900 sm:text-[1.75rem]">
            {t("complaints.title")}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {isParent
              ? t("complaints.parentLead")
              : t("complaints.count", { count: query.data?.count ?? 0 })}
          </p>
        </div>

        {isParent && (
          <Button
            leftIcon={<Plus className="size-4" />}
            onClick={() => setIsFormOpen(true)}
          >
            {t("complaints.new")}
          </Button>
        )}
      </div>

      <div className="mb-6 w-56">
        <Select
          label={t("complaints.status")}
          value={status}
          placeholder={t("complaints.allStatuses")}
          options={STATUSES.map((value) => ({
            value,
            label: t(STATUS_LABEL_KEYS[value]),
          }))}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value);
          }}
        />
      </div>

      {query.isPending ? (
        <LoadingState label={t("complaints.loading")} />
      ) : query.isError ? (
        <ErrorState
          description={t("complaints.loadError")}
          onRetry={() => void query.refetch()}
        />
      ) : query.data.results.length === 0 ? (
        <EmptyState
          icon={<MessageSquareWarning className="size-6" />}
          title={t("complaints.empty")}
          description={t(
            isParent ? "complaints.parentEmptyHint" : "complaints.staffEmptyHint",
          )}
        />
      ) : (
        <ul className="space-y-4">
          {query.data.results.map((complaint) => (
            <li key={complaint.id}>
              <ComplaintCard complaint={complaint} />
            </li>
          ))}
        </ul>
      )}

      {query.data !== undefined && (
        <div className="mt-6">
          <Pagination
            page={query.data.page}
            totalPages={query.data.total_pages}
            count={query.data.count}
            countLabel={t("complaints.count", { count: query.data.count })}
            onChange={setPage}
          />
        </div>
      )}

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={t("complaints.new")}
        description={t("complaints.formHint")}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => void submit()}
              isLoading={createComplaint.isPending}
              disabled={subject.trim() === "" || message.trim() === ""}
            >
              {t("complaints.send")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError !== null && <Alert tone="danger">{formError}</Alert>}

          <Input
            label={t("complaints.subject")}
            autoFocus
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />

          {(user?.children.length ?? 0) > 0 && (
              <Select
                label={t("complaints.childConcerned")}
                placeholder={t("complaints.noParticularChild")}
                options={(user?.children ?? []).map((c) => ({
                  value: c.id,
                  label: c.first_name,
                }))}
                value={childId}
                onChange={(event) => setChildId(event.target.value)}
              />
          )}

          <div>
            <label
              htmlFor="complaint-message"
              className="mb-1.5 block text-sm font-semibold text-ink-700"
            >
              {t("complaints.message")}
            </label>
            <textarea
              id="complaint-message"
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="w-full rounded-card border border-ink-200 bg-shell px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
            />
          </div>
        </div>
      </Modal>

      {!isParent && (
        <Card className="mt-6">
          <CardBody className="text-sm text-ink-500">
            {t("complaints.internalNote")}
          </CardBody>
        </Card>
      )}
    </PageShell>
  );
}
