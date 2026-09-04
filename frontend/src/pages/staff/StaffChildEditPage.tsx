import { useNavigate, useParams } from "react-router-dom";

import { Card, CardBody, CardHeader, ErrorState, LoadingState } from "@/components/ui";
import { ChildForm } from "@/features/children/components/ChildForm";
import { useChild, useUpdateChild } from "@/features/children/hooks";

export function StaffChildEditPage() {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const query = useChild(childId);
  const updateChild = useUpdateChild(childId ?? "");

  if (query.isPending) return <LoadingState label="Chargement du dossier…" />;
  if (query.isError) {
    return (
      <ErrorState
        title="Enfant introuvable"
        description="Ce dossier n'existe pas ou vous n'y avez pas accès."
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold">
        Modifier {query.data.full_name}
      </h1>

      <Card>
        <CardHeader title="Informations de l'enfant" />
        <CardBody>
          <ChildForm
            child={query.data}
            submitLabel="Enregistrer"
            onSubmit={async (values) => {
              await updateChild.mutateAsync(values);
              navigate(`/staff/children/${query.data.id}`);
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
