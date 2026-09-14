import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  KeyRound,
  UserPlus,
  Pencil,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

import { PageShell } from "@/components/app";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  LinkButton,
  LoadingState,
} from "@/components/ui";
import { AccessCodeModal } from "@/features/children/components/AccessCodeModal";
import { AddGuardianModal } from "@/features/children/components/AddGuardianModal";
import { ChildAvatar } from "@/features/children/components/ChildAvatar";
import {
  useArchiveChild,
  useChild,
  useIssueAccessCode,
  useRestoreChild,
} from "@/features/children/hooks";
import type { IssuedAccessCode } from "@/features/children/types";
import { useAuth } from "@/features/auth/useAuth";
import { useLocale } from "@/i18n/useLocale";

const RELATIONSHIP_KEYS: Record<string, string> = {
  MOTHER: "form.mother",
  FATHER: "form.father",
  GUARDIAN: "form.guardian",
  OTHER: "form.other",
};

export function StaffChildDetailPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { childId } = useParams<{ childId: string }>();
  const { role } = useAuth();
  const query = useChild(childId);

  const archive = useArchiveChild();
  const restore = useRestoreChild();
  const issueCode = useIssueAccessCode(childId ?? "");
  const [isAddingGuardian, setIsAddingGuardian] = useState(false);
  const [issued, setIssued] = useState<IssuedAccessCode | null>(null);

  if (query.isPending) return <LoadingState label={t("child.loading")} />;
  if (query.isError) {
    return (
      <ErrorState
        title={t("day.childNotFound")}
        description={t("day.childNotFoundHint")}
      />
    );
  }

  const child = query.data;

  return (
    <PageShell size="form">
      <Card>
        <CardBody className="flex flex-wrap items-start gap-5">
          <ChildAvatar
            firstName={child.first_name}
            lastName={child.last_name}
            photoUrl={child.photo_url}
            size="lg"
          />

          <div className="min-w-48 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-extrabold text-secondary-900 sm:text-[1.75rem]">{child.full_name}</h1>
              {child.status === "ARCHIVED" && (
                <Badge tone="neutral">{t("children.archivedOne")}</Badge>
              )}
            </div>

            <p className="mt-1 text-ink-600">
              {child.age_display} ·{" "}
              <Badge tone="secondary">{child.age_group.label}</Badge>
            </p>

            <p className="mt-1 text-sm text-ink-500">
              {t("child.bornOn", {
                date: new Date(child.date_of_birth).toLocaleDateString(locale, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }),
              })}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <LinkButton to={`/staff/children/${child.id}/timeline`} size="sm">
              <CalendarClock aria-hidden="true" className="size-4" />
              {t("child.day")}
            </LinkButton>

            <LinkButton
              to={`/staff/children/${child.id}/edit`}
              variant="outline"
              size="sm"
            >
              <Pencil aria-hidden="true" className="size-4" />
              {t("child.edit")}
            </LinkButton>

            {child.status === "ARCHIVED" ? (
              // Restore is admin-only; the backend enforces it too.
              role === "ADMIN" && (
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={restore.isPending}
                  onClick={() => restore.mutate(child.id)}
                  leftIcon={<ArchiveRestore className="size-4" />}
                >
                  {t("child.restore")}
                </Button>
              )
            ) : (
              <Button
                variant="outline"
                size="sm"
                isLoading={archive.isPending}
                onClick={() => archive.mutate(child.id)}
                leftIcon={<Archive className="size-4" />}
              >
                {t("child.archive")}
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {child.allergies.trim() !== "" && (
        <div className="mt-5">
          <Alert tone="danger">
            <strong>{t("child.allergiesLabel")}</strong> {child.allergies}
          </Alert>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t("child.guardians")}
            description={t("child.guardianCount", {
              count: child.guardians.length,
            })}
          />
          <CardBody>
            {child.guardians.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-ink-500">
                <Users aria-hidden="true" className="size-4" />
                {t("child.noGuardians")}
              </p>
            ) : (
              <ul className="space-y-3">
                {child.guardians.map((guardian) => (
                  <li key={guardian.id} className="flex items-start gap-3">
                    <ChildAvatar
                      firstName={guardian.first_name}
                      lastName={guardian.last_name}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-800">
                        {guardian.first_name} {guardian.last_name}{" "}
                        {guardian.is_primary && (
                          <Badge tone="primary">
                            {t("child.primaryContact")}
                          </Badge>
                        )}
                      </p>
                      <p className="truncate text-sm text-ink-500">
                        {t(
                          RELATIONSHIP_KEYS[guardian.relationship] ??
                            guardian.relationship,
                        )}{" "}
                        · {guardian.email}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t("child.accessCode")}
            description={t("child.accessCodeHint")}
          />
          <CardBody className="space-y-3">
            {child.guardians.length === 0 ? (
              <p className="text-sm text-ink-500">{t("child.noGuardianYet")}</p>
            ) : (
              <ul className="space-y-2">
                {child.guardians.map((guardian) => (
                  <li
                    key={guardian.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-card bg-ink-50 px-3 py-2"
                  >
                    <span className="text-sm font-semibold text-ink-800">
                      {guardian.first_name} {guardian.last_name}
                    </span>
                    {/* Reissue is per guardian: a mother and a father hold
                        separate codes, so a lost paper revokes one only. */}
                    <Button
                      variant="outline"
                      size="sm"
                      isLoading={
                        issueCode.isPending &&
                        issueCode.variables === guardian.id
                      }
                      leftIcon={<KeyRound className="size-4" />}
                      onClick={() =>
                        issueCode.mutate(guardian.id, {
                          onSuccess: (data) => setIssued(data),
                        })
                      }
                    >
                      {t("child.reissueCode")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <Button
              variant="secondary"
              leftIcon={<UserPlus className="size-4" />}
              onClick={() => setIsAddingGuardian(true)}
            >
              {t("child.addGuardian")}
            </Button>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader
          title={t("child.internal")}
          description={t("child.internalHint")}
        />
        <CardBody className="space-y-4 text-sm">
          <div>
            <p className="flex items-center gap-1.5 font-semibold text-ink-700">
              <ShieldAlert aria-hidden="true" className="size-4" />
              {t("child.medicalNotes")}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-ink-600">
              {child.medical_notes.trim() === "" ? "—" : child.medical_notes}
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink-700">
              {t("child.internalNotes")}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-ink-600">
              {child.notes.trim() === "" ? "—" : child.notes}
            </p>
          </div>
        </CardBody>
      </Card>

      <AddGuardianModal
        childId={child.id}
        isOpen={isAddingGuardian}
        onClose={() => setIsAddingGuardian(false)}
        onIssued={setIssued}
      />

      <AccessCodeModal issued={issued} onClose={() => setIssued(null)} />
    </PageShell>
  );
}
