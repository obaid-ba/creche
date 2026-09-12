import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { LoginForm } from "@/features/auth/components/LoginForm";
import { AuthLayout } from "@/layouts/AuthLayout";

export function StaffLoginPage() {
  const { t } = useTranslation();

  return (
    <AuthLayout
      title={t("auth.staffTitle")}
      subtitle={t("auth.staffSubtitle")}
      footer={
        <p className="text-xs text-ink-500">
          {t("auth.areYouParent")}{" "}
          <Link to="/parent/login" className="underline underline-offset-2">
            {t("auth.parentLogin")}
          </Link>
        </p>
      }
    >
      <LoginForm area="staff" />
    </AuthLayout>
  );
}
