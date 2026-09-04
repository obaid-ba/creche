import { Lock, MessageSquare } from "lucide-react";
import { useState } from "react";

import { Badge, Button, Card, CardBody } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";

import { useChangeStatus, useReplyToComplaint } from "../hooks";
import { STATUS_LABELS, STATUS_TONES, type Complaint } from "../types";

export function ComplaintCard({ complaint }: { complaint: Complaint }) {
  const { role } = useAuth();
  const isStaff = role === "STAFF" || role === "ADMIN";

  const [isReplying, setIsReplying] = useState(false);
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const changeStatus = useChangeStatus();
  const reply = useReplyToComplaint();

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-48">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-ink-900">{complaint.subject}</h3>
              <Badge tone={STATUS_TONES[complaint.status]}>
                {complaint.status_label}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-ink-400">
              {new Date(complaint.created_at).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              {isStaff &&
                ` · ${complaint.parent.first_name} ${complaint.parent.last_name}`}
              {complaint.child !== null && ` · ${complaint.child.first_name}`}
            </p>
          </div>

          {/* Only the moves the server will accept are offered. */}
          {complaint.allowed_transitions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {complaint.allowed_transitions.map((target) => (
                <Button
                  key={target}
                  variant="outline"
                  size="sm"
                  isLoading={
                    changeStatus.isPending &&
                    changeStatus.variables?.id === complaint.id &&
                    changeStatus.variables?.status === target
                  }
                  onClick={() =>
                    changeStatus.mutate({ id: complaint.id, status: target })
                  }
                >
                  {STATUS_LABELS[target]}
                </Button>
              ))}
            </div>
          )}
        </div>

        <p className="whitespace-pre-wrap text-sm text-ink-700">
          {complaint.message}
        </p>

        {complaint.replies.length > 0 && (
          <ul className="space-y-2 border-t border-ink-100 pt-3">
            {complaint.replies.map((item) => (
              <li
                key={item.id}
                className={
                  item.is_internal
                    ? "rounded-card bg-warning-50 px-3 py-2"
                    : "rounded-card bg-ink-50 px-3 py-2"
                }
              >
                <p className="flex items-center gap-1.5 text-xs font-bold text-ink-500">
                  {item.is_internal && (
                    <>
                      <Lock aria-hidden="true" className="size-3" />
                      Note interne ·{" "}
                    </>
                  )}
                  {item.author?.first_name ?? "—"}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-700">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        )}

        {isReplying ? (
          <div className="space-y-2">
            <label className="sr-only" htmlFor={`reply-${complaint.id}`}>
              Votre réponse
            </label>
            <textarea
              id={`reply-${complaint.id}`}
              rows={3}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="w-full rounded-card border border-ink-200 bg-white px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25"
            />

            {isStaff && (
              <label className="flex items-center gap-2 text-sm text-ink-600">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(event) => setIsInternal(event.target.checked)}
                  className="size-4 rounded border-ink-300"
                />
                Note interne (non visible par le parent)
              </label>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                isLoading={reply.isPending}
                disabled={body.trim() === ""}
                onClick={() =>
                  reply.mutate(
                    { id: complaint.id, body: body.trim(), isInternal },
                    {
                      onSuccess: () => {
                        setBody("");
                        setIsInternal(false);
                        setIsReplying(false);
                      },
                    },
                  )
                }
              >
                Envoyer
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsReplying(false)}
              >
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<MessageSquare className="size-4" />}
            onClick={() => setIsReplying(true)}
          >
            Répondre
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
