"""Language negotiation on the API.

The client is a single-page app that renders French and Arabic, but a
fair amount of user-facing text is produced server-side: age groups, ages
in words, relationship and event labels. Those have to follow the
request, not the deployment.

There is no session and no cookie on this API, so ``Accept-Language`` is
the only signal — which makes it worth asserting that it actually reaches
the response, and that an unknown or absent one still yields French
rather than a key or an empty string.
"""
from datetime import date, timedelta

import pytest
from django.urls import reverse
from django.utils import translation

from common.age import AgeGroup, age_display

AGE_GROUPS_URL = reverse("age-group-list")


class TestAgeDisplay:
    """`age_display` composes its result, so each branch needs checking."""

    @pytest.mark.parametrize(
        ("days", "french", "arabic"),
        [
            # Arabic distinguishes one / two / few (3-10) / many (11-99),
            # so these four exercise four different plural forms from a
            # language that only has two.
            (1, "1 jour", "يوم واحد"),
            (3, "3 jours", "3 أيام"),
            (40, "1 mois", "شهر واحد"),
            (340, "11 mois", "11 شهراً"),
        ],
    )
    def test_translates_and_pluralises(self, days, french, arabic):
        born = date.today() - timedelta(days=days)
        with translation.override("fr"):
            assert age_display(born) == french
        with translation.override("ar"):
            assert age_display(born) == arabic

    def test_composes_years_and_months_in_each_language(self):
        born = date.today() - timedelta(days=890)
        with translation.override("fr"):
            assert age_display(born) == "2 ans et 5 mois"
        with translation.override("ar"):
            # "سنتان" is the dual, not a plural: a singular/plural pair
            # cannot express it, which is why the catalogue carries six
            # forms rather than two.
            assert age_display(born) == "سنتان و5 أشهر"

    def test_an_unborn_date_does_not_crash(self):
        tomorrow = date.today() + timedelta(days=1)
        with translation.override("ar"):
            assert age_display(tomorrow) == "لا شهر"


class TestChoiceLabels:
    def test_age_group_labels_follow_the_active_language(self):
        with translation.override("fr"):
            assert AgeGroup.INFANT.label == "2 → 6 mois"
        with translation.override("ar"):
            assert AgeGroup.INFANT.label == "شهران ← 6 أشهر"

    def test_the_stored_value_is_never_translated(self):
        # The label is display text; the value is a database constant. If
        # translation ever reached the value, every stored row would stop
        # matching its own enum.
        with translation.override("ar"):
            assert AgeGroup.INFANT.value == "INFANT"


@pytest.mark.django_db
class TestRequestNegotiation:
    def test_arabic_is_returned_when_asked_for(self, api_client, staff):
        api_client.force_authenticate(staff)
        response = api_client.get(AGE_GROUPS_URL, headers={"Accept-Language": "ar"})

        assert response.status_code == 200
        assert [group["label"] for group in response.data] == [
            "شهران ← 6 أشهر",
            "7 أشهر ← سنة",
            "سنة ← سنتان",
            "سنتان فما فوق",
        ]

    def test_keys_stay_stable_across_languages(self, api_client, staff):
        """The client filters on `key`; only `label` may change."""
        api_client.force_authenticate(staff)
        keys = {}
        for language in ("fr", "ar"):
            response = api_client.get(
                AGE_GROUPS_URL, headers={"Accept-Language": language}
            )
            keys[language] = [group["key"] for group in response.data]
        assert keys["fr"] == keys["ar"] == ["INFANT", "BABY", "TODDLER", "PRESCHOOL"]

    @pytest.mark.parametrize("header", ["fr", "fr-FR,fr;q=0.9", "de", "", "xx-YY"])
    def test_anything_but_arabic_falls_back_to_french(
        self, api_client, staff, header
    ):
        api_client.force_authenticate(staff)
        response = api_client.get(AGE_GROUPS_URL, headers={"Accept-Language": header})

        assert response.status_code == 200
        assert response.data[0]["label"] == "2 → 6 mois"

    def test_quality_values_are_honoured(self, api_client, staff):
        # A browser set to Arabic with French as a fallback must get
        # Arabic, not whichever tag happens to appear first.
        api_client.force_authenticate(staff)
        response = api_client.get(
            AGE_GROUPS_URL, headers={"Accept-Language": "fr;q=0.5, ar;q=0.9"}
        )
        assert response.data[0]["label"] == "شهران ← 6 أشهر"

    def test_a_child_payload_is_translated_end_to_end(
        self, api_client, staff, make_child
    ):
        make_child(date_of_birth=date.today() - timedelta(days=890))
        api_client.force_authenticate(staff)

        response = api_client.get(
            reverse("child-list"), headers={"Accept-Language": "ar"}
        )

        child = response.data["results"][0]
        assert child["age_display"] == "سنتان و5 أشهر"
        assert child["age_group"]["label"] == "سنتان فما فوق"
        assert child["age_group"]["key"] == "PRESCHOOL"


class TestCompiledCatalogue:
    """`.mo` is committed, so it can drift from the `.po` beside it.

    Django reads only the compiled file. Editing a translation and
    forgetting `manage.py compilemessages` therefore changes nothing at
    runtime and fails silently — the old wording simply keeps appearing.
    This is the check that makes that loud.
    """

    @staticmethod
    def _po_entries(path):
        """Every non-plural entry in a `.po` file, keyed by (context, msgid).

        The context matters: a contextual entry is stored in the compiled
        catalogue under "context\x04msgid", so looking it up by the bare
        msgid finds nothing and the entry reads as stale when it is not.
        """
        import re

        text = path.read_text(encoding="utf-8")
        pairs = {}
        for block in text.split("\n\n"):
            if "msgid_plural" in block:
                continue
            msgid = re.search(r'^msgid "(.*)"$', block, re.M)
            msgstr = re.search(r'^msgstr "(.*)"$', block, re.M)
            if msgid is None or msgstr is None or msgid.group(1) == "":
                continue
            ctx = re.search(r'^msgctxt "(.*)"$', block, re.M)
            pairs[(ctx.group(1) if ctx else None, msgid.group(1))] = msgstr.group(1)
        return pairs

    def test_the_compiled_catalogue_matches_its_source(self, settings):
        import gettext
        from pathlib import Path

        locale_dir = Path(settings.LOCALE_PATHS[0]) / "ar" / "LC_MESSAGES"
        po = locale_dir / "django.po"
        mo = locale_dir / "django.mo"
        assert mo.exists(), f"{mo} is missing — run `manage.py compilemessages`"

        with mo.open("rb") as handle:
            compiled = gettext.GNUTranslations(handle)

        def lookup(context, msgid):
            if context is None:
                return compiled.gettext(msgid)
            return compiled.pgettext(context, msgid)

        stale = [
            msgid
            for (context, msgid), msgstr in self._po_entries(po).items()
            if lookup(context, msgid) != msgstr
        ]
        assert stale == [], (
            "these translations are in django.po but not in django.mo; "
            "run `manage.py compilemessages`"
        )

    def test_every_message_is_translated(self, settings):
        from pathlib import Path

        po = Path(settings.LOCALE_PATHS[0]) / "ar" / "LC_MESSAGES" / "django.po"
        untranslated = [
            msgid
            for (_context, msgid), msgstr in self._po_entries(po).items()
            if msgstr == ""
        ]
        assert untranslated == [], "Arabic strings left empty would render as French"


class TestMsgidCollisions:
    """French is the source language, so it has no catalogue of its own.

    That is what makes short msgids dangerous: Django resolves them
    against *every* installed app's French catalogue, and a bare "Change"
    matched django.contrib.admin's own — which is French for
    "Modification". The nappy-change chip in the staff quick-add bar read
    "Modification" until it was given a context.

    Nothing fails when this happens. The string is simply wrong, in one
    language, on one screen.
    """

    @staticmethod
    def _msgids(path):
        import re

        text = path.read_text(encoding="utf-8")
        # A msgid carrying a msgctxt is namespaced and cannot collide.
        out = []
        for block in text.split("\n\n"):
            if "msgctxt" in block or "msgid_plural" in block:
                continue
            m = re.search(r'^msgid "(.+)"$', block, re.M)
            if m:
                out.append(m.group(1))
        return out

    def test_no_msgid_is_hijacked_by_another_catalogue(self, settings):
        from pathlib import Path

        from django.utils import translation
        from django.utils.translation import gettext

        po = Path(settings.LOCALE_PATHS[0]) / "ar" / "LC_MESSAGES" / "django.po"
        with translation.override("fr"):
            hijacked = {
                msgid: gettext(msgid)
                for msgid in self._msgids(po)
                if gettext(msgid) != msgid
            }

        assert hijacked == {}, (
            "these msgids resolve to someone else's French translation; "
            "give them a context with pgettext"
        )

    def test_no_entry_is_marked_fuzzy(self, settings):
        from pathlib import Path

        po = Path(settings.LOCALE_PATHS[0]) / "ar" / "LC_MESSAGES" / "django.po"
        # gettext ignores a fuzzy entry at runtime, so a translation that
        # looks present in the .po silently does not apply. makemessages
        # adds the marker whenever it guesses at a changed msgid.
        assert "#, fuzzy" not in po.read_text(encoding="utf-8"), (
            "a fuzzy entry is ignored at runtime; review it and remove the marker"
        )
