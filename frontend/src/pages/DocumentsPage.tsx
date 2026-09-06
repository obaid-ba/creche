import { Download, FileText } from "lucide-react";

import { Card, CardBody } from "@/components/ui";
import { NURSERY } from "@/config/nursery";

export function DocumentsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold">Inscription</h1>
        <p className="mx-auto mt-3 max-w-xl text-ink-600">
          Téléchargez le dossier d'inscription, complétez-le et rapportez-le
          à la crèche.
        </p>
      </header>

      <Card>
        <CardBody className="flex flex-wrap items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-card bg-primary-100 text-primary-700">
            <FileText aria-hidden="true" className="size-6" />
          </span>

          <div className="min-w-48 flex-1">
            <h2 className="font-bold">Dossier d'inscription 2026 – 2027</h2>
            <p className="mt-0.5 text-sm text-ink-500">Document PDF</p>
          </div>

          <a
            href={NURSERY.registrationDocument}
            // `download` on a same-origin file: the browser saves it
            // instead of navigating away from the site.
            download
            className="inline-flex h-11 items-center gap-2 rounded-pill bg-primary-600 px-5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-primary-700"
          >
            <Download aria-hidden="true" className="size-4" />
            Télécharger
          </a>
        </CardBody>
      </Card>

      <p className="mt-6 text-center text-sm text-ink-500">
        Une question ? Appelez-nous au{" "}
        <a
          href={NURSERY.phone.href}
          className="font-semibold text-primary-700 underline underline-offset-2"
        >
          {NURSERY.phone.display}
        </a>
        .
      </p>
    </div>
  );
}
