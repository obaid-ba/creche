import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  KeyRound,
  Pencil,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";

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
import { ChildAvatar } from "@/features/children/components/ChildAvatar";
import {
  useArchiveChild,
  useChild,
  useIssueAccessCode,
  useRestoreChild,
} from "@/features/children/hooks";
import type { IssuedAccessCode } from "@/features/children/types";
import { useAuth } from "@/features/auth/useAuth";

const RELATIONSHIP_LABELS: Record<string, string> = {
  MOTHER: "Mère",
  FATHER: "Père",
  GUARDIAN: "Tuteur",
  OTHER: "Autre",
};

export function StaffChildDetailPage() {
  const { childId } = useParams<{ childId: string }>();
  const { role } = useAuth();
  const query = useChild(childId);

  const archive = useArchiveChild();
  const restore = useRestoreChild();
  const issueCode = useIssueAccessCode();
  const [issued, setIssued] = useState<IssuedAccessCode | null>(null);

  if (query.isPending) return <LoadingState label="Chargement du profil…" />;
  if (query.isError) {
    return (
      <ErrorState
        title="Enfant introuvable"
        description="Ce dossier n'existe pas ou vous n'y avez pas accès."
      />
    );
  }

  const child = query.data;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
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
              <h1 className="text-2xl font-bold">{child.full_name}</h1>
              {child.status === "ARCHIVED" && <Badge tone="neutral">Archivé</Badge>}
            </div>

            <p className="mt-1 text-ink-600">
              {child.age_display} ·{" "}
              <Badge tone="secondary">{child.age_group.label}</Badge>
            </p>

            <p className="mt-1 text-sm text-ink-500">
              Né(e) le{" "}
              {new Date(child.date_of_birth).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <LinkButton to={`/staff/children/${child.id}/timeline`} size="sm">
              <CalendarClock aria-hidden="true" className="size-4" />
              Journée
            </LinkButton>

            <LinkButton
              to={`/staff/children/${child.id}/edit`}
              variant="outline"
              size="sm"
            >
              <Pencil aria-hidden="true" className="size-4" />
              Modifier
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
                  Restaurer
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
                Archiver
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {child.allergies.trim() !== "" && (
        <div className="mt-5">
          <Alert tone="danger">
            <strong>Allergies :</strong> {child.allergies}
          </Alert>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Parents rattachés"
            description={`${child.guardians.length} parent(s)`}
          />
          <CardBody>
            {child.guardians.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-ink-500">
                <Users aria-hidden="true" className="size-4" />
                Aucun parent rattaché pour le moment.
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
                          <Badge tone="primary">Contact principal</Badge>
                        )}
                      </p>
                      <p className="truncate text-sm text-ink-500">
                        {RELATIONSHIP_LABELS[guardian.relationship] ??
                          guardian.relationship}{" "}
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
            title="Code d'accès parent"
            description="Permet à un parent d'activer son compte."
          />
          <CardBody className="space-y-3">
            {child.has_active_access_code ? (
              <Alert tone="info">
                Un code est déjà actif pour cet enfant. En générer un nouveau
                invalidera le précédent.
              </Alert>
            ) : (
              <p className="text-sm text-ink-500">
                Aucun code actif pour le moment.
              </p>
            )}

            <Button
              variant="secondary"
              isLoading={issueCode.isPending}
              leftIcon={<KeyRound className="size-4" />}
              onClick={() =>
                issueCode.mutate(child.id, {
                  onSuccess: (data) => setIssued(data),
                })
              }
            >
              Générer un code
            </Button>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader
          title="Informations internes"
          description="Non visibles par les parents"
        />
        <CardBody className="space-y-4 text-sm">
          <div>
            <p className="flex items-center gap-1.5 font-semibold text-ink-700">
              <ShieldAlert aria-hidden="true" className="size-4" />
              Notes médicales
            </p>
            <p className="mt-1 whitespace-pre-wrap text-ink-600">
              {child.medical_notes.trim() === "" ? "—" : child.medical_notes}
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink-700">Notes internes</p>
            <p className="mt-1 whitespace-pre-wrap text-ink-600">
              {child.notes.trim() === "" ? "—" : child.notes}
            </p>
          </div>
        </CardBody>
      </Card>

      <AccessCodeModal issued={issued} onClose={() => setIssued(null)} />
    </div>
  );
}
