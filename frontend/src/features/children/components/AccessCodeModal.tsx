import { Check, Copy, KeyRound } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, Button, Modal } from "@/components/ui";
import { useLocale } from "@/i18n/useLocale";

import type { IssuedAccessCode } from "../types";

/**
 * Shows a freshly issued access code.
 *
 * The plaintext exists only in this response — the server stores a keyed
 * HMAC and cannot show it again (docs/authentication.md 4.3). The copy is
 * explicit about that so staff write it down before closing.
 */
export function AccessCodeModal({
  issued,
  onClose,
}: {
  issued: IssuedAccessCode | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [hasCopied, setHasCopied] = useState(false);

  async function copyCode() {
    if (issued === null) return;
    try {
      await navigator.clipboard.writeText(issued.code);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the code is on screen regardless.
      setHasCopied(false);
    }
  }

  return (
    <Modal
      isOpen={issued !== null}
      onClose={onClose}
      title={t("child.codeIssued")}
      description={t("child.codeIssuedHint")}
      footer={<Button onClick={onClose}>{t("child.codeNoted")}</Button>}
    >
      {issued !== null && (
        <div className="space-y-4">
          <Alert tone="danger">{t("child.codeOnceWarning")}</Alert>

          <div className="flex items-center gap-3 rounded-card border-2 border-dashed border-primary-300 bg-primary-50 p-4">
            <KeyRound aria-hidden="true" className="size-5 text-primary-600" />
            {/* The code is Latin letters and digits whatever the
                interface language. */}
            <code
              dir="ltr"
              className="flex-1 font-mono text-2xl font-bold tracking-widest text-primary-800"
            >
              {issued.code}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void copyCode()}
              leftIcon={
                hasCopied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )
              }
            >
              {t(hasCopied ? "child.copied" : "child.copy")}
            </Button>
          </div>

          <p className="text-sm text-ink-500">
            {t("child.codeValidUntil", {
              date: new Date(issued.expires_at).toLocaleDateString(locale, {
                day: "numeric",
                month: "long",
                year: "numeric",
              }),
            })}
          </p>
        </div>
      )}
    </Modal>
  );
}
