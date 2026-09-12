import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <span className="text-5xl" aria-hidden="true">
        🧭
      </span>
      <h1 className="text-2xl font-bold">{t("notFound.title")}</h1>
      <p className="text-ink-500">{t("notFound.lead")}</p>
      <Link
        to="/"
        className="inline-flex h-11 items-center rounded-pill bg-primary-600 px-5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-primary-700"
      >
        {t("notFound.back")}
      </Link>
    </div>
  );
}
