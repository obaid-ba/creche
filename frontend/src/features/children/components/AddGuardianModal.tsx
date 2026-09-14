import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, Button, Input, Modal, Select } from "@/components/ui";

import { useAddGuardian } from "../hooks";
import type { IssuedAccessCode } from "../types";

/** Values are the API's enum; the wording comes from the locale files. */
const RELATIONSHIPS = [
  { value: "MOTHER", key: "form.mother" },
  { value: "FATHER", key: "form.father" },
  { value: "GUARDIAN", key: "form.guardian" },
  { value: "OTHER", key: "form.other" },
] as const;

/**
 * Enrol a family, typed in by staff from the paper form.
 *
 * This is the whole of enrolment. The parent fills in nothing and chooses
 * no password: they walk away with the code this returns and their
 * child's first name.
 *
 * The e-mail field is optional on purpose — a family that did not give an
 * address should not have one invented for them, and it is contact detail
 * here, never a login.
 */
export function AddGuardianModal({
  childId,
  isOpen,
  onClose,
  onIssued,
}: {
  childId: string;
  isOpen: boolean;
  onClose: () => void;
  onIssued: (issued: IssuedAccessCode) => void;
}) {
  const { t } = useTranslation();
  const addGuardian = useAddGuardian(childId);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [relationship, setRelationship] = useState("MOTHER");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFirstName("");
    setLastName("");
    setRelationship("MOTHER");
    setPhone("");
    setEmail("");
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function submit() {
    setError(null);
    try {
      const issued = await addGuardian.mutateAsync({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        relationship,
        phone: phone.trim(),
        email: email.trim(),
      });
      reset();
      onIssued(issued);
      onClose();
    } catch (caught) {
      const apiError = caught as {
        fieldErrors?: Record<string, string[]>;
        message?: string;
      };
      const field = Object.values(apiError.fieldErrors ?? {})[0]?.[0];
      setError(field ?? apiError.message ?? t("validation.unexpected"));
    }
  }

  const canSubmit = firstName.trim() !== "" && lastName.trim() !== "";

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={t("child.addGuardian")}
      description={t("child.addGuardianHint")}
      footer={
        <>
          <Button variant="outline" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => void submit()}
            isLoading={addGuardian.isPending}
            disabled={!canSubmit}
          >
            {t("child.issueCode")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error !== null && <Alert tone="danger">{error}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("form.firstName")}
            autoFocus
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
          <Input
            label={t("form.lastName")}
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </div>

        <Select
          label={t("form.relationship")}
          value={relationship}
          options={RELATIONSHIPS.map((r) => ({
            value: r.value,
            label: t(r.key),
          }))}
          onChange={(event) => setRelationship(event.target.value)}
        />

        <Input
          label={t("form.phoneOptional")}
          type="tel"
          dir="ltr"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />

        <Input
          label={t("child.emailOptional")}
          type="email"
          dir="ltr"
          hint={t("child.emailOptionalHint")}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
    </Modal>
  );
}
