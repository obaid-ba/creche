import { Link } from "react-router-dom";

import { LoginForm } from "@/features/auth/components/LoginForm";
import { AuthLayout } from "@/layouts/AuthLayout";

export function ParentLoginPage() {
  return (
    <AuthLayout
      title="Espace parents"
      subtitle="Connectez-vous pour suivre la journée de votre enfant."
      footer={
        <>
          <p>
            Première connexion ?{" "}
            <Link
              to="/parent/activation"
              className="font-semibold text-primary-700 underline underline-offset-2"
            >
              Activer mon compte avec un code
            </Link>
          </p>
          <p className="mt-2 text-xs text-ink-500">
            Vous êtes membre de l'équipe ?{" "}
            <Link to="/staff/login" className="underline underline-offset-2">
              Connexion personnel
            </Link>
          </p>
        </>
      }
    >
      <LoginForm area="parent" />
    </AuthLayout>
  );
}
