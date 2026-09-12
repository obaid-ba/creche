import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { PageShell } from "@/components/app";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { ChildForm } from "@/features/children/components/ChildForm";
import { useCreateChild } from "@/features/children/hooks";

export function StaffChildCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createChild = useCreateChild();

  return (
    <PageShell size="form">
      <h1 className="mb-6 font-display text-2xl font-extrabold text-secondary-900 sm:text-[1.75rem]">
        {t("child.createTitle")}
      </h1>

      <Card>
        <CardHeader
          title={t("child.childInfo")}
          description={t("child.createHint")}
        />
        <CardBody>
          <ChildForm
            submitLabel={t("child.createSubmit")}
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
