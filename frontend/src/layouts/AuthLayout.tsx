import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Wordmark } from "@/components/brand/Wordmark";
import { Card, CardBody, LanguageSwitcher } from "@/components/ui";

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
      {/* The switcher belongs on the sign-in screen too: a parent who
          reads only Arabic meets this page before any other. */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-6 sm:px-6">
        <Link to="/">
          <Wordmark variant="compact" />
        </Link>
        <LanguageSwitcher />
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-16 sm:items-center">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <h1 className="font-display text-2xl font-extrabold text-secondary-900">
              {title}
            </h1>
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
