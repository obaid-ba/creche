import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "danger";

const TONES: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: "bg-info-50 text-info-700 border-info-500/25", Icon: Info },
  success: {
    box: "bg-success-50 text-success-700 border-success-500/25",
    Icon: CheckCircle2,
  },
  danger: {
    box: "bg-danger-50 text-danger-700 border-danger-500/25",
    Icon: AlertCircle,
  },
};

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  const { box, Icon } = TONES[tone];

  return (
    <div
      // Errors are announced immediately; softer tones wait for a pause.
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-card border px-4 py-3 text-sm font-medium",
        box,
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
