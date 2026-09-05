import { KeyRound, LinkIcon, LogOut } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
} from "@/components/ui";
import { ChildAvatar } from "@/features/children/components/ChildAvatar";
import { PasswordForm } from "@/features/auth/components/PasswordForm";
import { ProfileForm } from "@/features/auth/components/ProfileForm";
import { profileApi } from "@/features/auth/profileApi";
import { useAuth } from "@/features/auth/useAuth";
import { ApiError } from "@/services/errors";

const RELATIONSHIPS = [
  { value: "MOTHER", label: "Mère" },
  { value: "FATHER", label: "Père" },
  { value: "GUARDIAN", label: "Tuteur / Tutrice" },
  { value: "OTHER", label: "Autre" },
] as const;

/** Attach a second child using a code the nursery issued. */
function LinkChildForm({ onLinked }: { onLinked: () => Promise<void> | void }) {
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const form = useForm({
    defaultValues: { access_code: "", relationship: "MOTHER" },
  });

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    setIsDone(false);
    try {
      await profileApi.linkChild(values);
      await onLinked();
      form.reset();
      setIsDone(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Impossible de rattacher cet enfant.",
      );
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error !== null && <Alert tone="danger">{error}</Alert>}
      {isDone && <Alert tone="success">L'enfant a été rattaché à votre compte.</Alert>}

      <Input
        label="Code d'accès"
        placeholder="MAM-XXXXX"
        autoComplete="off"
        spellCheck={false}
        hint="Le code remis par la crèche pour votre autre enfant."
        error={form.formState.errors.access_code?.message}
        {...form.register("access_code", { required: "Le code est requis." })}
      />

      <Select
        label="Lien avec l'enfant"
        options={RELATIONSHIPS.map((r) => ({ value: r.value, label: r.label }))}
        {...form.register("relationship")}
      />

      <Button
        type="submit"
        variant="outline"
        isLoading={form.formState.isSubmitting}
        leftIcon={<LinkIcon className="size-4" />}
      >
        Rattacher l'enfant
      </Button>
    </form>
  );
}

export function ParentProfilePage() {
  const { user, refreshUser, logout } = useAuth();

  if (user === null) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">Mon profil</h1>
      <p className="mt-1 text-sm text-ink-500">
        Vos informations et celles de vos enfants.
      </p>

      <Card className="mt-6">
        <CardHeader title="Mes enfants" />
        <CardBody>
          {user.children.length === 0 ? (
            <p className="text-sm text-ink-500">
              Aucun enfant rattaché à votre compte.
            </p>
          ) : (
            <ul className="space-y-3">
              {user.children.map((child) => (
                <li key={child.id} className="flex items-center gap-3">
                  <ChildAvatar
                    firstName={child.first_name}
                    lastName={child.last_name}
                    photoUrl={child.photo_url}
                    size="sm"
                  />
                  <span className="font-semibold text-ink-800">
                    {child.first_name} {child.last_name}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card className="mt-5">
        <CardHeader title="Mes informations" />
        <CardBody>
          <ProfileForm user={user} onSaved={refreshUser} />
        </CardBody>
      </Card>

      <Card className="mt-5">
        <CardHeader
          title="Rattacher un autre enfant"
          description="Si vous avez plusieurs enfants à la crèche."
        />
        <CardBody>
          <LinkChildForm onLinked={refreshUser} />
        </CardBody>
      </Card>

      <Card className="mt-5">
        <CardHeader
          title="Sécurité"
          action={
            user.can_send_messages ? undefined : (
              <Badge tone="warning">Messagerie désactivée</Badge>
            )
          }
        />
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
    </div>
  );
}
