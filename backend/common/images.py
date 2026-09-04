"""Image upload validation and sanitisation.

These are photos of other people's children, so uploads are treated as
hostile input (docs/authentication.md 6):

* the declared filename and Content-Type are ignored; the bytes are
  sniffed with Pillow, which refuses anything that is not a real image;
* EXIF is stripped by re-encoding, because phone photos routinely carry
  GPS coordinates - publishing a nursery photo with the location of a
  child's home embedded in it would be a serious leak;
* a decompression-bomb guard rejects images whose pixel count is absurd
  relative to their file size.
"""
from __future__ import annotations

import io

from django.conf import settings
from django.core.files.uploadedfile import InMemoryUploadedFile
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework import serializers

# Pillow format name -> the MIME type we will store.
ALLOWED_FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}

THUMBNAIL_SIZE = (400, 400)
MAX_DIMENSION = 2400
#: Refuse absurd pixel counts regardless of file size (decompression bomb).
MAX_PIXELS = 40_000_000


def validate_image(uploaded) -> Image.Image:
    """Return a decoded image, or raise a French ValidationError."""
    max_bytes = settings.MAX_UPLOAD_SIZE_BYTES
    if uploaded.size > max_bytes:
        raise serializers.ValidationError(
            f"Le fichier dépasse la taille maximale de "
            f"{settings.MAX_UPLOAD_SIZE_MB} Mo."
        )

    try:
        uploaded.seek(0)
        image = Image.open(uploaded)
        # verify() detects truncated or malformed data, but consumes the
        # file object, so the image has to be reopened afterwards.
        image.verify()
        uploaded.seek(0)
        image = Image.open(uploaded)
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise serializers.ValidationError(
            "Ce fichier n'est pas une image valide."
        ) from exc

    if image.format not in ALLOWED_FORMATS:
        raise serializers.ValidationError(
            "Format non accepté. Utilisez JPEG, PNG ou WebP."
        )

    width, height = image.size
    if width * height > MAX_PIXELS:
        raise serializers.ValidationError("Cette image est trop grande.")

    return image


def sanitise_image(image: Image.Image, *, name: str) -> InMemoryUploadedFile:
    """Re-encode to strip metadata and cap the stored dimensions.

    Re-encoding is what removes EXIF: nothing from the original file's
    metadata survives, because only the pixels are copied forward.
    """
    # Honour any EXIF orientation flag *before* discarding EXIF, so the
    # photo does not come out sideways.
    image = ImageOps.exif_transpose(image)

    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGB")
    if image.mode == "RGBA":
        # JPEG has no alpha channel; flatten onto white.
        background = Image.new("RGB", image.size, (255, 255, 255))
        background.paste(image, mask=image.split()[-1])
        image = background

    image.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=85, optimize=True)
    buffer.seek(0)

    return InMemoryUploadedFile(
        buffer, None, f"{name}.jpg", "image/jpeg", buffer.getbuffer().nbytes, None
    )


def make_thumbnail(image: Image.Image, *, name: str) -> InMemoryUploadedFile:
    thumb = ImageOps.exif_transpose(image)
    if thumb.mode not in ("RGB",):
        thumb = thumb.convert("RGB")
    thumb.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)

    buffer = io.BytesIO()
    thumb.save(buffer, format="JPEG", quality=80, optimize=True)
    buffer.seek(0)

    return InMemoryUploadedFile(
        buffer, None, f"{name}_thumb.jpg", "image/jpeg",
        buffer.getbuffer().nbytes, None,
    )


def process_upload(uploaded, *, name: str):
    """Validate, strip metadata and build a thumbnail in one step."""
    image = validate_image(uploaded)
    # sanitise_image mutates via thumbnail(), so the thumbnail is built
    # from its own copy rather than from an already-resized image.
    full = sanitise_image(image.copy(), name=name)
    thumb = make_thumbnail(image.copy(), name=name)
    return full, thumb
