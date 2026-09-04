"""Photo upload security (docs/authentication.md 6, brief 17).

These are photos of other people's children, so the upload path is
treated as hostile input.
"""
import io
from datetime import date

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image

from apps.activities.models import Activity, ActivityPhoto
from common.images import process_upload, validate_image


def make_image_bytes(fmt="JPEG", size=(800, 600), exif=None) -> bytes:
    buffer = io.BytesIO()
    image = Image.new("RGB", size, (200, 120, 90))
    if exif is not None:
        image.save(buffer, format=fmt, exif=exif)
    else:
        image.save(buffer, format=fmt)
    return buffer.getvalue()


def upload(name="photo.jpg", content=None, content_type="image/jpeg"):
    return SimpleUploadedFile(
        name, content if content is not None else make_image_bytes(), content_type
    )


@pytest.fixture
def activity(db, staff):
    return Activity.objects.create(
        title="Peinture", date=date.today(), created_by=staff
    )


def photos_url(activity):
    return reverse("activity-photos", args=[activity.id])


class TestValidation:
    def test_accepts_a_real_jpeg(self):
        assert validate_image(upload()).format == "JPEG"

    def test_rejects_a_text_file_renamed_as_an_image(self):
        """The filename and Content-Type are attacker-controlled; the bytes
        are what decides."""
        from rest_framework.exceptions import ValidationError

        fake = SimpleUploadedFile("photo.jpg", b"not an image at all", "image/jpeg")
        with pytest.raises(ValidationError):
            validate_image(fake)

    def test_rejects_an_svg_even_though_it_is_an_image_type(self):
        """SVG can carry script, so it is not on the allowlist."""
        from rest_framework.exceptions import ValidationError

        svg = SimpleUploadedFile(
            "x.svg", b"<svg xmlns='http://www.w3.org/2000/svg'></svg>", "image/svg+xml"
        )
        with pytest.raises(ValidationError):
            validate_image(svg)

    def test_rejects_an_oversized_file(self, settings):
        from rest_framework.exceptions import ValidationError

        settings.MAX_UPLOAD_SIZE_BYTES = 100
        with pytest.raises(ValidationError):
            validate_image(upload())

    def test_accepts_png_and_webp(self):
        assert validate_image(
            upload("a.png", make_image_bytes("PNG"), "image/png")
        ).format == "PNG"
        assert validate_image(
            upload("a.webp", make_image_bytes("WEBP"), "image/webp")
        ).format == "WEBP"


class TestSanitisation:
    def test_exif_is_stripped(self):
        """Phone photos carry EXIF, including GPS. Publishing a nursery
        photo with the coordinates of a child's home embedded would be a
        serious leak, so re-encoding drops every tag."""
        exif = Image.Exif()
        exif[271] = "TestCamera"                 # Make
        exif[272] = "Model X"                    # Model
        exif[306] = "2026:09:04 10:30:00"        # DateTime
        exif[37510] = b"chez Mohamed"            # UserComment

        original = make_image_bytes(exif=exif.tobytes())
        before = dict(Image.open(io.BytesIO(original)).getexif())
        assert before, "fixture must actually carry EXIF"
        assert 271 in before

        full, _ = process_upload(upload(content=original), name="x")

        after = dict(Image.open(io.BytesIO(full.read())).getexif())
        assert after == {}, f"EXIF survived: {after}"

    def test_orientation_is_applied_before_exif_is_discarded(self):
        """Dropping EXIF must not leave the photo sideways."""
        exif = Image.Exif()
        exif[274] = 6  # Orientation: rotate 90°

        original = make_image_bytes(size=(800, 600), exif=exif.tobytes())
        full, _ = process_upload(upload(content=original), name="x")

        width, height = Image.open(io.BytesIO(full.read())).size
        assert (width, height) == (600, 800)

    def test_large_images_are_capped(self):
        full, _ = process_upload(
            upload(content=make_image_bytes(size=(4000, 3000))), name="x"
        )

        width, height = Image.open(io.BytesIO(full.read())).size
        assert max(width, height) <= 2400

    def test_a_thumbnail_is_produced(self):
        _, thumb = process_upload(upload(), name="x")

        width, height = Image.open(io.BytesIO(thumb.read())).size
        assert max(width, height) <= 400

    def test_everything_is_normalised_to_jpeg(self):
        full, _ = process_upload(
            upload("a.png", make_image_bytes("PNG"), "image/png"), name="x"
        )
        assert Image.open(io.BytesIO(full.read())).format == "JPEG"

    def test_transparency_is_flattened_not_dropped(self):
        buffer = io.BytesIO()
        Image.new("RGBA", (100, 100), (255, 0, 0, 128)).save(buffer, format="PNG")

        full, _ = process_upload(
            upload("a.png", buffer.getvalue(), "image/png"), name="x"
        )

        assert Image.open(io.BytesIO(full.read())).mode == "RGB"


@pytest.mark.django_db
class TestPhotoEndpoint:
    def test_staff_can_upload(self, api_client, staff, activity):
        api_client.force_authenticate(staff)

        response = api_client.post(
            photos_url(activity), {"image": upload()}, format="multipart"
        )

        assert response.status_code == 201
        assert ActivityPhoto.objects.count() == 1
        assert response.data["thumbnail_url"]

    def test_the_stored_name_is_not_the_uploaded_one(
        self, api_client, staff, activity
    ):
        """Original filenames are attacker-controlled and often contain a
        child's name."""
        api_client.force_authenticate(staff)

        api_client.post(
            photos_url(activity),
            {"image": upload("Photo de Mohamed Benali.jpg")},
            format="multipart",
        )

        photo = ActivityPhoto.objects.get()
        assert "Mohamed" not in photo.image.name
        assert "Benali" not in photo.image.name

    def test_a_non_image_is_rejected(self, api_client, staff, activity):
        api_client.force_authenticate(staff)

        response = api_client.post(
            photos_url(activity),
            {"image": SimpleUploadedFile("x.jpg", b"nope", "image/jpeg")},
            format="multipart",
        )

        assert response.status_code == 400
        assert ActivityPhoto.objects.count() == 0

    def test_photos_appear_on_the_activity(self, api_client, staff, activity):
        api_client.force_authenticate(staff)
        api_client.post(photos_url(activity), {"image": upload()}, format="multipart")

        response = api_client.get(reverse("activity-detail", args=[activity.id]))

        assert len(response.data["photos"]) == 1

    def test_staff_can_delete_a_photo(self, api_client, staff, activity):
        api_client.force_authenticate(staff)
        created = api_client.post(
            photos_url(activity), {"image": upload()}, format="multipart"
        )

        response = api_client.delete(
            reverse("activity-remove-photo", args=[activity.id, created.data["id"]])
        )

        assert response.status_code == 204
        assert ActivityPhoto.objects.count() == 0
