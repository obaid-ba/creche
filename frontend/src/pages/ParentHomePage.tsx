import { Card, CardBody } from "@/components/ui";
import { useAuth } from "@/features/auth/useAuth";

/** Placeholder parent dashboard; built out in Phase 3+. */
export function ParentHomePage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold">
        Bonjour {user?.first_name ?? ""}
      </h1>
      <p className="mt-2 text-ink-600">
        Bienvenue dans votre espace parent.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {(user?.children ?? []).map((child) => (
          <Card key={child.id}>
            <CardBody>
              <p className="text-sm font-semibold text-ink-400">Mon enfant</p>
              <p className="mt-1 text-lg font-bold">
                {child.first_name} {child.last_name}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
