import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <span className="text-5xl" aria-hidden="true">
        🧭
      </span>
      <h1 className="text-2xl font-bold">Page introuvable</h1>
      <p className="text-ink-500">
        La page que vous cherchez n'existe pas ou a été déplacée.
      </p>
      <Link
        to="/"
        className="inline-flex h-11 items-center rounded-pill bg-primary-500 px-5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-primary-600"
      >
        Retour à l'accueil
      </Link>
    </div>
  );
}
