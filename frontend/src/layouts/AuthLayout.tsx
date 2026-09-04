import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Card, CardBody } from "@/components/ui";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary-50 to-cream">
      <header className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <Link to="/" className="inline-flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-full bg-primary-500 text-lg">
            🧸
          </span>
          <span className="font-display text-lg font-bold text-ink-900">
            Crèche Mamati
          </span>
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-16 sm:items-center">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle !== undefined && (
              <p className="mt-2 text-sm text-ink-600">{subtitle}</p>
            )}
          </div>

          <Card>
            <CardBody className="p-6 sm:p-7">{children}</CardBody>
          </Card>

          {footer !== undefined && (
            <div className="mt-5 text-center text-sm text-ink-600">{footer}</div>
          )}
        </div>
      </main>
    </div>
  );
}
