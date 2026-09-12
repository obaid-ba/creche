import { KeyRound, LogOut, Plus, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  Select,
} from "@/components/ui";
import { PasswordForm } from "@/features/auth/components/PasswordForm";
import { ProfileForm } from "@/features/auth/components/ProfileForm";
import { useAuth } from "@/features/auth/useAuth";
import { useCreateStaff, useStaffMembers, useToggleStaffActive } from "@/features/parents/hooks";
import { ApiError } from "@/services/errors";

interface NewStaffValues {
  email: string;
  first_name: string;
  last_name: string;
  job_title: string;
  password: string;
  role: string;
}

function NewStaffModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const createStaff = useCreateStaff();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<NewStaffValues>({
    defaultValues: {
      email: "", first_name: "", last_name: "",
      job_title: "", password: "", role: "STAFF",
    },
  });

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await createStaff.mutateAsync(values);
      form.reset();
      onClose();
    } catch (caught) {
      const apiError =
        caught instanceof ApiError
          ? caught
          : new ApiError({ code: "unknown", message: "Erreur.", status: 0 });
      for (const [field, messages] of Object.entries(apiError.fieldErrors)) {
        form.setError(field as keyof NewStaffValues, {
          message: messages[0] ?? "",
        });
      }
      setError(apiError.message);
    }
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nouveau membre de l'équipe"
      description="Le compte est actif immédiatement."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} isLoading={form.formState.isSubmitting}>
            Créer le compte
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error !== null && <Alert tone="danger">{error}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Prénom"
            autoFocus
            error={form.formState.errors.first_name?.message}
            {...form.register("first_name", { required: "Requis." })}
          />
          <Input
            label="Nom"
            error={form.formState.errors.last_name?.message}
            {...form.register("last_name", { required: "Requis." })}
          />
        </div>

        <Input
          label="Adresse e-mail"
          type="email"
          error={form.formState.errors.email?.message}
          {...form.register("email", { required: "Requis." })}
        />

        <Input
          label="Fonction"
          placeholder="Éducatrice, auxiliaire…"
          {...form.register("job_title")}
        />

        <Input
          label="Mot de passe provisoire"
          type="password"
          hint="Au moins 10 caractères. À communiquer à la personne concernée."
          error={form.formState.errors.password?.message}
          {...form.register("password", { required: "Requis." })}
        />

        <Select
          label="Rôle"
          options={[
            { value: "STAFF", label: "Personnel" },
            { value: "ADMIN", label: "Administrateur" },
          ]}
          hint="Un administrateur peut restaurer un enfant archivé et gérer les comptes de l'équipe."
          {...form.register("role")}
        />
      </div>
    </Modal>
  );
}

export function StaffSettingsPage() {
  const { user, refreshUser, logout } = useAuth();
  const staffQuery = useStaffMembers();
  const toggleActive = useToggleStaffActive();
  const [isCreating, setIsCreating] = useState(false);

  if (user === null) return null;
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">Paramètres</h1>
      <p className="mt-1 text-sm text-ink-500">
        Votre compte{isAdmin && " et ceux de l'équipe"}.
      </p>

      <Card className="mt-6">
        <CardHeader
          title="Mon compte"
          action={
            <Badge tone={isAdmin ? "primary" : "secondary"}>
              {isAdmin ? "Administrateur" : "Personnel"}
            </Badge>
          }
        />
        <CardBody>
          <ProfileForm user={user} onSaved={refreshUser} />
        </CardBody>
      </Card>

      <Card className="mt-5">
        <CardHeader title="Sécurité" />
        <CardBody className="space-y-6">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-card bg-ink-100 text-ink-600">
              <KeyRound aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <PasswordForm />
            </div>
          </div>

          <div className="border-t border-ink-100 pt-5">
            <Button
              variant="outline"
              leftIcon={<LogOut className="size-4" />}
              onClick={() => void logout()}
            >
              Se déconnecter
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-5">
        <CardHeader
          title="Équipe"
          description={
            isAdmin
              ? "Créer, désactiver et réactiver les comptes."
              : "Seul un administrateur peut modifier ces comptes."
          }
          action={
            isAdmin ? (
              <Button
                size="sm"
                leftIcon={<Plus className="size-4" />}
                onClick={() => setIsCreating(true)}
              >
                Ajouter
              </Button>
            ) : undefined
          }
        />
        <CardBody>
          {staffQuery.isPending ? (
            <LoadingState label="Chargement de l'équipe…" />
          ) : staffQuery.isError ? (
            <ErrorState description="Impossible de charger l'équipe." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {staffQuery.data.results.map((member) => {
                const isSelf = member.id === user.id;
                return (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-40 flex-1">
                      <p className="font-semibold text-ink-900">
                        {member.first_name} {member.last_name}
                        {isSelf && (
                          <span className="ms-2 text-xs font-normal text-ink-400">
                            (vous)
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-ink-500">
                        {member.email}
                        {member.job_title !== "" && ` · ${member.job_title}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {member.role === "ADMIN" && (
                        <Badge tone="primary">Admin</Badge>
                      )}
                      {!member.is_active && (
                        <Badge tone="neutral">Désactivé</Badge>
                      )}

                      {isAdmin && !isSelf && (
                        <Button
                          variant="outline"
                          size="sm"
                          isLoading={
                            toggleActive.isPending &&
                            toggleActive.variables?.id === member.id
                          }
                          onClick={() =>
                            toggleActive.mutate({
                              id: member.id,
                              activate: !member.is_active,
                            })
                          }
                          leftIcon={
                            member.is_active ? (
                              <UserX className="size-4" />
                            ) : (
                              <UserCheck className="size-4" />
                            )
                          }
                        >
                          {member.is_active ? "Désactiver" : "Réactiver"}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <NewStaffModal isOpen={isCreating} onClose={() => setIsCreating(false)} />
    </div>
  );
}
