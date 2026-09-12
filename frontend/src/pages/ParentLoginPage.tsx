import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { LoginForm } from "@/features/auth/components/LoginForm";
import { AuthLayout } from "@/layouts/AuthLayout";

export function ParentLoginPage() {
  const { t } = useTranslation();

  return (
    <AuthLayout
      title={t("auth.parentTitle")}
      subtitle={t("auth.parentSubtitle")}
      footer={
        <>
          <p>
            {t("auth.firstLogin")}{" "}
            <Link
              to="/parent/activation"
              className="font-semibold text-primary-700 underline underline-offset-2"
            >
              {t("auth.activateWithCode")}
            </Link>
          </p>
          <p className="mt-2 text-xs text-ink-500">
            {t("auth.areYouStaff")}{" "}
            <Link to="/staff/login" className="underline underline-offset-2">
              {t("auth.staffLogin")}
            </Link>
          </p>
        </>
      }
    >
      <LoginForm area="parent" />
    </AuthLayout>
  );
}
