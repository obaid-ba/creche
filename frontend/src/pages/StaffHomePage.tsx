import { useAuth } from "@/features/auth/useAuth";

/** Placeholder staff dashboard; built out in Phase 3+. */
export function StaffHomePage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>
      <p className="mt-2 text-ink-600">
        Connecté en tant que {user?.first_name} {user?.last_name}.
      </p>
    </div>
  );
}
