import { useState } from "react";

import { FileUpload, ImagePreview, useToast, type PreviewImage } from "@/components/ui";
import { activitiesApi } from "../api";
import { useUploadPhoto } from "../hooks";
import type { ActivityPhoto } from "../types";

/**
 * Photos attached to an activity (brief §12).
 *
 * The upload endpoint existed from Phase 6 but nothing in the interface
 * called it, so the feature was unreachable. Staff-only: parents see the
 * photos on the activity card but cannot add or remove them.
 */
export function ActivityPhotos({
  activityId,
  photos,
  canEdit,
  onChanged,
}: {
  activityId: string;
  photos: ActivityPhoto[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const upload = useUploadPhoto(activityId);
  const { notify } = useToast();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const images: PreviewImage[] = photos.map((photo) => ({
    id: photo.id,
    url: photo.image_url ?? "",
    thumbnailUrl: photo.thumbnail_url,
    caption: photo.caption,
  }));

  async function remove(id: string) {
    try {
      await activitiesApi.removePhoto(activityId, id);
      notify("Photo supprimée.");
      onChanged();
    } catch {
      notify("Impossible de supprimer la photo.", "danger");
    }
  }

  return (
    <div className="space-y-4">
      <ImagePreview
        images={images}
        openIndex={openIndex}
        onOpenChange={setOpenIndex}
        {...(canEdit ? { onRemove: (id: string) => void remove(id) } : {})}
      />

      {canEdit && (
        <FileUpload
          label="Ajouter une photo"
          isUploading={upload.isPending}
          hint="Les métadonnées (dont la localisation) sont supprimées automatiquement."
          onSelect={async (file) => {
            try {
              await upload.mutateAsync({ file });
              notify("Photo ajoutée.");
              onChanged();
            } catch {
              notify("L'envoi de la photo a échoué.", "danger");
            }
          }}
        />
      )}
    </div>
  );
}
