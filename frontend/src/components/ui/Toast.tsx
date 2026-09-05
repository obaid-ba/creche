import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";

type Tone = "success" | "danger" | "info";

interface Toast {
  id: number;
  tone: Tone;
  message: string;
}

interface ToastContextValue {
  notify: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONES: Record<Tone, { box: string; Icon: typeof Info }> = {
  success: { box: "bg-success-50 text-success-700 border-success-500/30", Icon: CheckCircle2 },
  danger: { box: "bg-danger-50 text-danger-700 border-danger-500/30", Icon: AlertCircle },
  info: { box: "bg-info-50 text-info-700 border-info-500/30", Icon: Info },
};

let nextId = 0;

/**
 * Transient confirmations.
 *
 * Alert is for messages that belong to a form and should persist; Toast
 * is for "saved", "sent", "archived" — feedback about an action that has
 * already finished and needs no follow-up.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: Tone = "success") => {
      const id = nextId++;
      setToasts((current) => [...current, { id, tone, message }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Polite: a confirmation should not interrupt what a screen reader
          is currently announcing. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => {
          const { box, Icon } = TONES[toast.tone];
          return (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-2.5",
                "rounded-card border px-4 py-3 text-sm font-medium shadow-lifted",
                box,
              )}
            >
              <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <p className="min-w-0 flex-1">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Fermer la notification"
                className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) {
    throw new Error("useToast doit être utilisé à l'intérieur d'un ToastProvider.");
  }
  return context;
}
