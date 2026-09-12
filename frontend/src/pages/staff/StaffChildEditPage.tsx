import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { PageShell } from "@/components/app";
import { Card, CardBody, CardHeader, ErrorState, LoadingState } from "@/components/ui";
import { ChildForm } from "@/features/children/components/ChildForm";
import { useChild, useUpdateChild } from "@/features/children/hooks";

export function StaffChildEditPage() {
  const { t } = useTranslation();
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const query = useChild(childId);
  const updateChild = useUpdateChild(childId ?? "");

  if (query.isPending) return <LoadingState label={t("child.loadingRecord")} />;
  if (query.isError) {
    return (
      <ErrorState
        title={t("day.childNotFound")}
        description={t("day.childNotFoundHint")}
      />
    );
  }

  return (
    <PageShell size="form">
      <h1 className="mb-6 font-display text-2xl font-extrabold text-secondary-900 sm:text-[1.75rem]">
        {t("child.editWithName", { name: query.data.full_name })}
      </h1>

      <Card>
        <CardHeader title={t("child.childInfo")} />
        <CardBody>
          <ChildForm
            child={query.data}
            submitLabel={t("common.save")}
            onSubmit={async (values) => {
              await updateChild.mutateAsync(values);
              navigate(`/staff/children/${query.data.id}`);
            }}
          />
        </CardBody>
      </Card>
    </PageShell>
  );
}
