import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { ClaimForm } from "@/features/auth/components/ClaimForm";
import { AuthLayout } from "@/layouts/AuthLayout";

export function ParentActivationPage() {
  const { t } = useTranslation();

  return (
    <AuthLayout
      title={t("auth.activationTitle")}
      subtitle={t("auth.activationSubtitle")}
      footer={
        <p>
          {t("auth.alreadyHaveAccount")}{" "}
          <Link
            to="/parent/login"
            className="font-semibold text-primary-700 underline underline-offset-2"
          >
            {t("auth.signIn")}
          </Link>
        </p>
      }
    >
      <ClaimForm />
    </AuthLayout>
  );
}
