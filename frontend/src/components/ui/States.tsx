import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/cn";

import { Button } from "./Button";

/**
 * The three states every async view needs.
 *
 * Kept together so no screen quietly ships without one of them, and so
 * the wording stays consistent across features in both languages.
 *
 * The defaults are resolved inside each component rather than as default
 * parameter values: a default argument is evaluated once at module load,
 * which would freeze the copy in whatever language happened to be active
 * at start-up and never follow a switch.
 */

export function LoadingState({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 text-ink-500",
        className,
      )}
    >
      <Loader2 aria-hidden="true" className="size-6 animate-spin text-primary-500" />
      <p className="text-sm">{label ?? t("common.loading")}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-full bg-ink-100 text-ink-400">
        {icon ?? <Inbox aria-hidden="true" className="size-6" />}
      </div>
      <div>
        <h3 className="text-base font-bold text-ink-800">{title}</h3>
        {description !== undefined && (
          <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-full bg-danger-50 text-danger-500">
        <AlertCircle aria-hidden="true" className="size-6" />
      </div>
      <div>
        <h3 className="text-base font-bold text-ink-800">
          {title ?? t("common.error")}
        </h3>
        {description !== undefined && (
          <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>
        )}
      </div>
      {onRetry !== undefined && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}
