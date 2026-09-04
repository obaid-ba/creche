import { Link } from "react-router-dom";

import { ClaimForm } from "@/features/auth/components/ClaimForm";
import { AuthLayout } from "@/layouts/AuthLayout";

export function ParentActivationPage() {
  return (
    <AuthLayout
      title="Activer mon compte"
      subtitle="Saisissez le code d'accès remis par la crèche pour créer votre espace parent."
      footer={
        <p>
          Vous avez déjà un compte ?{" "}
          <Link
            to="/parent/login"
            className="font-semibold text-primary-700 underline underline-offset-2"
          >
            Se connecter
          </Link>
        </p>
      }
    >
      <ClaimForm />
    </AuthLayout>
  );
}
