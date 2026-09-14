import { KeyRound, LinkIcon, LogOut } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { PageShell } from "@/components/app";
import {
  Alert,
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
  { value: "MOTHER", key: "form.mother" },
  { value: "FATHER", key: "form.father" },
  { value: "GUARDIAN", key: "form.guardian" },
  { value: "OTHER", key: "form.other" },
] as const;

/** Attach a second child using a code the nursery issued. */
function LinkChildForm({ onLinked }: { onLinked: () => Promise<void> | void }) {
  const { t } = useTranslation();
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
          : t("profile.linkChildError"),
      );
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error !== null && <Alert tone="danger">{error}</Alert>}
      {isDone && <Alert tone="success">{t("profile.linkChildDone")}</Alert>}

      <Input
        label={t("form.accessCode")}
        placeholder="MAM-XXXXX"
        autoComplete="off"
        spellCheck={false}
        dir="ltr"
        hint={t("profile.linkChildCodeHint")}
        error={form.formState.errors.access_code?.message}
        {...form.register("access_code", {
          required: "validation.codeRequiredShort",
        })}
      />

      <Select
        label={t("form.relationship")}
        options={RELATIONSHIPS.map((r) => ({
          value: r.value,
          label: t(r.key),
        }))}
        {...form.register("relationship")}
      />

      <Button
        type="submit"
        variant="outline"
        isLoading={form.formState.isSubmitting}
        leftIcon={<LinkIcon className="size-4" />}
      >
        {t("profile.linkChildAction")}
      </Button>
    </form>
  );
}

export function ParentProfilePage() {
  const { t } = useTranslation();
  const { user, refreshUser, logout } = useAuth();

  if (user === null) return null;

  return (
    <PageShell size="form">
      <h1 className="font-display text-2xl font-extrabold text-secondary-900 sm:text-[1.75rem]">
        {t("profile.title")}
      </h1>
      <p className="mt-1 text-sm text-ink-500">{t("profile.lead")}</p>

      <Card className="mt-6">
        <CardHeader title={t("profile.myChildren")} />
        <CardBody>
          {user.children.length === 0 ? (
            <p className="text-sm text-ink-500">{t("profile.noChildren")}</p>
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
        <CardHeader title={t("profile.myInfo")} />
        <CardBody>
          <ProfileForm user={user} onSaved={refreshUser} />
        </CardBody>
      </Card>

      <Card className="mt-5">
        <CardHeader
          title={t("profile.linkChild")}
          description={t("profile.linkChildHint")}
        />
        <CardBody>
          <LinkChildForm onLinked={refreshUser} />
        </CardBody>
      </Card>

      <Card className="mt-5">
        <CardHeader title={t("settings.security")} />
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
              {t("settings.signOut")}
            </Button>
          </div>
        </CardBody>
      </Card>
    </PageShell>
  );
}
