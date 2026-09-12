import { KeyRound, LogOut, Plus, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { PageShell } from "@/components/app";
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
  const { t } = useTranslation();
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
          : new ApiError({ code: "unknown", message: t("settings.genericError"), status: 0 });
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
      title={t("settings.newMember")}
      description={t("settings.newMemberHint")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => void submit()}
            isLoading={form.formState.isSubmitting}
          >
            {t("settings.create")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error !== null && <Alert tone="danger">{error}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("form.firstName")}
            autoFocus
            error={form.formState.errors.first_name?.message}
            {...form.register("first_name", { required: "settings.required" })}
          />
          <Input
            label={t("form.lastName")}
            error={form.formState.errors.last_name?.message}
            {...form.register("last_name", { required: "settings.required" })}
          />
        </div>

        <Input
          label={t("form.email")}
          type="email"
          dir="ltr"
          error={form.formState.errors.email?.message}
          {...form.register("email", { required: "settings.required" })}
        />

        <Input
          label={t("settings.jobTitle")}
          placeholder={t("settings.jobTitlePlaceholder")}
          {...form.register("job_title")}
        />

        <Input
          label={t("settings.tempPassword")}
          type="password"
          hint={t("settings.tempPasswordHint")}
          error={form.formState.errors.password?.message}
          {...form.register("password", { required: "settings.required" })}
        />

        <Select
          label={t("settings.role")}
          options={[
            { value: "STAFF", label: t("settings.roleStaff") },
            { value: "ADMIN", label: t("settings.roleAdmin") },
          ]}
          hint={t("settings.roleHint")}
          {...form.register("role")}
        />
      </div>
    </Modal>
  );
}

export function StaffSettingsPage() {
  const { t } = useTranslation();
  const { user, refreshUser, logout } = useAuth();
  const staffQuery = useStaffMembers();
  const toggleActive = useToggleStaffActive();
  const [isCreating, setIsCreating] = useState(false);

  if (user === null) return null;
  const isAdmin = user.role === "ADMIN";

  return (
    <PageShell size="form">
      <h1 className="font-display text-2xl font-extrabold text-secondary-900 sm:text-[1.75rem]">
        {t("settings.title")}
      </h1>
      {/* Two whole sentences rather than a French fragment glued on: the
          clause goes in a different place in Arabic. */}
      <p className="mt-1 text-sm text-ink-500">
        {t(isAdmin ? "settings.leadAdmin" : "settings.leadSelf")}
      </p>

      <Card className="mt-6">
        <CardHeader
          title={t("settings.myAccount")}
          action={
            <Badge tone={isAdmin ? "primary" : "secondary"}>
              {t(isAdmin ? "settings.roleAdmin" : "settings.roleStaff")}
            </Badge>
          }
        />
        <CardBody>
          <ProfileForm user={user} onSaved={refreshUser} />
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

      <Card className="mt-5">
        <CardHeader
          title={t("settings.team")}
          description={t(
            isAdmin ? "settings.teamAdminHint" : "settings.teamStaffHint",
          )}
          action={
            isAdmin ? (
              <Button
                size="sm"
                leftIcon={<Plus className="size-4" />}
                onClick={() => setIsCreating(true)}
              >
                {t("settings.add")}
              </Button>
            ) : undefined
          }
        />
        <CardBody>
          {staffQuery.isPending ? (
            <LoadingState label={t("settings.teamLoading")} />
          ) : staffQuery.isError ? (
            <ErrorState description={t("settings.teamLoadError")} />
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
                            {t("settings.you")}
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
                        <Badge tone="primary">{t("settings.adminBadge")}</Badge>
                      )}
                      {!member.is_active && (
                        <Badge tone="neutral">{t("settings.disabled")}</Badge>
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
                          {t(
                            member.is_active
                              ? "settings.deactivate"
                              : "settings.reactivate",
                          )}
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
    </PageShell>
  );
}
