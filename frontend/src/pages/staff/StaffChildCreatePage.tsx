import { useNavigate } from "react-router-dom";

import { PageShell } from "@/components/app";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { ChildForm } from "@/features/children/components/ChildForm";
import { useCreateChild } from "@/features/children/hooks";

export function StaffChildCreatePage() {
  const navigate = useNavigate();
  const createChild = useCreateChild();

  return (
    <PageShell size="form">
      <h1 className="mb-6 font-display text-2xl font-extrabold text-secondary-900 sm:text-[1.75rem]">Ajouter un enfant</h1>

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
    </PageShell>
  );
}
