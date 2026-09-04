import { Link } from "react-router-dom";

import { LoginForm } from "@/features/auth/components/LoginForm";
import { AuthLayout } from "@/layouts/AuthLayout";

export function StaffLoginPage() {
  return (
    <AuthLayout
      title="Espace personnel"
      subtitle="Connectez-vous pour accéder au tableau de bord."
      footer={
        <p className="text-xs text-ink-500">
          Vous êtes parent ?{" "}
          <Link to="/parent/login" className="underline underline-offset-2">
            Connexion parents
          </Link>
        </p>
      }
    >
      <LoginForm area="staff" />
    </AuthLayout>
  );
}
