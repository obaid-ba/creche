import { ImagePlus, Loader2, X } from "lucide-react";
import { useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { cn } from "@/lib/cn";

const MAX_MB = 10;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

/**
 * Image picker with drag-and-drop and a local preview.
 *
 * The checks here are a courtesy, not a control: they stop an obvious
 * mistake before a 10 MB round-trip. The server sniffs the bytes,
 * re-encodes to strip EXIF and enforces the real limits regardless
 * (docs/authentication.md §6).
 */
export function FileUpload({
  label,
  onSelect,
  isUploading = false,
  hint,
}: {
  label: string;
  onSelect: (file: File) => void | Promise<void>;
  isUploading?: boolean;
  hint?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOver, setIsOver] = useState(false);

  function accept(file: File | undefined) {
    if (file === undefined) return;
    setError(null);

    if (!ACCEPTED.includes(file.type)) {
      setError("Format non accepté. Utilisez JPEG, PNG ou WebP.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Le fichier dépasse ${MAX_MB} Mo.`);
      return;
    }

    // Released when it is replaced or the preview is cleared.
    setPreview((old) => {
      if (old !== null) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
    void onSelect(file);
  }

  function clear() {
    setPreview((old) => {
      if (old !== null) URL.revokeObjectURL(old);
      return null;
    });
    setError(null);
    if (inputRef.current !== null) inputRef.current.value = "";
  }

  return (
    <div className="w-full">
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-ink-700">
        {label}
      </label>

      <div
        onDragOver={(event: DragEvent) => {
          event.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(event: DragEvent) => {
          event.preventDefault();
          setIsOver(false);
          accept(event.dataTransfer.files[0]);
        }}
        className={cn(
          "rounded-card border-2 border-dashed p-4 transition-colors",
          isOver ? "border-primary-400 bg-primary-50" : "border-ink-200 bg-white",
        )}
      >
        {preview !== null ? (
          <div className="flex items-center gap-3">
            <img
              src={preview}
              alt="Aperçu de l'image sélectionnée"
              className="size-20 rounded-card object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-800">
                {isUploading ? "Envoi en cours…" : "Image prête"}
              </p>
            </div>
            {isUploading ? (
              <Loader2 aria-hidden="true" className="size-5 animate-spin text-primary-500" />
            ) : (
              <button
                type="button"
                onClick={clear}
                aria-label="Retirer l'image"
                className="rounded-pill p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <ImagePlus aria-hidden="true" className="size-7 text-ink-300" />
            <p className="text-sm text-ink-600">
              Glissez une image ici, ou{" "}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-semibold text-primary-700 underline underline-offset-2"
              >
                parcourez vos fichiers
              </button>
            </p>
            <p className="text-xs text-ink-400">
              {hint ?? `JPEG, PNG ou WebP · ${MAX_MB} Mo maximum`}
            </p>
          </div>
        )}

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED.join(",")}
          className="sr-only"
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            accept(event.target.files?.[0])
          }
        />
      </div>

      {error !== null && (
        <p role="alert" className="mt-1.5 text-xs font-semibold text-danger-700">
          {error}
        </p>
      )}
    </div>
  );
}
