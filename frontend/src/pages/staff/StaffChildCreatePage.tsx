import { useNavigate } from "react-router-dom";

import { Card, CardBody, CardHeader } from "@/components/ui";
import { ChildForm } from "@/features/children/components/ChildForm";
import { useCreateChild } from "@/features/children/hooks";

export function StaffChildCreatePage() {
  const navigate = useNavigate();
  const createChild = useCreateChild();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold">Ajouter un enfant</h1>

      <Card>
        <CardHeader
          title="Informations de l'enfant"
          description="L'âge et le groupe sont calculés à partir de la date de naissance."
        />
        <CardBody>
          <ChildForm
            submitLabel="Créer le dossier"
            onSubmit={async (values) => {
              const child = await createChild.mutateAsync(values);
              navigate(`/staff/children/${child.id}`, { replace: true });
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
