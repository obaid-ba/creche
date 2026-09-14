import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { CodeLoginForm } from "@/features/auth/components/CodeLoginForm";
import { AuthLayout } from "@/layouts/AuthLayout";

export function ParentLoginPage() {
  const { t } = useTranslation();

  return (
    <AuthLayout
      title={t("auth.parentTitle")}
      subtitle={t("auth.parentSubtitle")}
      footer={
        <>
          <p className="text-ink-600">{t("auth.noCode")}</p>
          <p className="mt-2 text-xs text-ink-500">
            {t("auth.areYouStaff")}{" "}
            <Link to="/staff/login" className="underline underline-offset-2">
              {t("auth.staffLogin")}
            </Link>
          </p>
        </>
      }
    >
      <CodeLoginForm />
    </AuthLayout>
  );
}
