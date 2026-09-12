import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
// Side-effect import: sets up i18next before the first render, so no
// component ever paints with raw translation keys.
import "./i18n/config";
import "./index.css";

const container = document.getElementById("root");
if (!container) throw new Error("Élément racine #root introuvable.");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
