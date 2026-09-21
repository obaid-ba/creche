import { KeyRound, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PageShell } from "@/components/app";
import { Button, Card, CardBody, CardHeader } from "@/components/ui";
import { ChildAvatar } from "@/features/children/components/ChildAvatar";
import { ProfileForm } from "@/features/auth/components/ProfileForm";
import { useAuth } from "@/features/auth/useAuth";

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

      {/* No password form and no self-service child linking: a parent has
          neither a password nor a way to enrol a child. Both were left
          behind by the move to code sign-in and staff-side enrolment, and
          both failed on every click — one with a 404, the other with
          "mot de passe actuel incorrect" for a password that does not
          exist. What a parent can actually do is ask the nursery. */}
      <Card className="mt-5">
        <CardHeader title={t("profile.access")} />
        <CardBody className="space-y-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-card bg-ink-100 text-ink-600">
              <KeyRound aria-hidden="true" className="size-4" />
            </span>
            <p className="min-w-0 flex-1 text-sm text-ink-600">
              {t("profile.accessHint")}
            </p>
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
