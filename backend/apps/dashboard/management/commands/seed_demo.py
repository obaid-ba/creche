"""Populate a database with a believable demo nursery.

Idempotent: re-running updates rather than duplicating, so it is safe to
call repeatedly while developing.

Refuses to run in production unless forced, because it creates accounts
with known passwords.
"""
from __future__ import annotations

import random
from datetime import timedelta

from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.accounts.access_codes import ChildAccessCode
from apps.accounts.models import Guardianship, ParentProfile, Role, StaffProfile, User
from apps.activities.models import Activity, ActivityParticipation
from apps.care.models import DailyRecord, TimelineEvent
from apps.children.models import Child
from apps.complaints.models import Complaint

DEMO_PASSWORD = "Demo!Passw0rd"

STAFF = [
    ("amina.sassi@mamati.test", "Amina", "Sassi", "Éducatrice", Role.STAFF),
    ("leila.brahim@mamati.test", "Leila", "Brahim", "Auxiliaire", Role.STAFF),
    ("directrice@mamati.test", "Nadia", "Mamati", "Directrice", Role.ADMIN),
]

FAMILIES = [
    ("sarah.benali@mamati.test", "Sarah", "Benali", "Mohamed", "Benali", 29, "MOTHER"),
    ("karim.trabelsi@mamati.test", "Karim", "Trabelsi", "Lina", "Trabelsi", 4, "FATHER"),
    ("ines.gharbi@mamati.test", "Inès", "Gharbi", "Omar", "Gharbi", 9, "MOTHER"),
    ("mehdi.jelassi@mamati.test", "Mehdi", "Jelassi", "Sofia", "Jelassi", 18, "FATHER"),
    ("rym.haddad@mamati.test", "Rym", "Haddad", "Yasmine", "Haddad", 34, "MOTHER"),
]

ALLERGIES = {"Mohamed": "Arachides", "Sofia": "Lactose"}


class Command(BaseCommand):
    help = "Create a demo nursery: staff, families, children and a recorded day."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force", action="store_true",
            help="Allow seeding even when DEBUG is off.",
        )
        parser.add_argument(
            "--days", type=int, default=3,
            help="How many past days of care events to generate.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG and not options["force"]:
            raise CommandError(
                "Refusing to seed with DEBUG=False. This creates accounts "
                "with a known password. Re-run with --force if you are sure."
            )

        random.seed(42)  # reproducible demo data
        self.codes: list[tuple[str, str, str]] = []

        staff_users = self._create_staff()
        recorder = staff_users[0]
        children = self._create_families()

        self._record_days(children, recorder, options["days"])
        self._create_activities(children, recorder)
        self._create_complaints(children)

        self.stdout.write(self.style.SUCCESS("\nDemo data ready."))
        self.stdout.write("  Staff sign in with e-mail + password:")
        self.stdout.write(f"    password: {DEMO_PASSWORD}")
        for email, first, _, title, role in STAFF:
            self.stdout.write(f"    {email:32} {first} ({title}, {role})")

        # Parents have neither: the code and the child's first name are
        # the whole credential, and the plaintext exists only here.
        self.stdout.write("\n  Parents sign in with a code + their child's name:")
        for child_first, parent_name, plain in self.codes:
            self.stdout.write(f"    {plain:18} {parent_name} — enfant : {child_first}")
        if not self.codes:
            self.stdout.write(
                "    (codes already issued on a previous run; reissue from a "
                "child's page to see one)"
            )

    # ── builders ────────────────────────────────────────────────────────
    def _create_staff(self) -> list[User]:
        users = []
        for email, first, last, title, role in STAFF:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={"first_name": first, "last_name": last, "role": role},
            )
            if created:
                user.set_password(DEMO_PASSWORD)
                user.role = role
                user.save()
            StaffProfile.objects.get_or_create(
                user=user, defaults={"job_title": title}
            )
            users.append(user)
        self.stdout.write(f"  staff: {len(users)}")
        return users

    def _create_families(self) -> list[Child]:
        today = timezone.localdate()
        children = []

        for email, first, last, child_first, child_last, months, relation in FAMILIES:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={"first_name": first, "last_name": last, "role": Role.PARENT},
            )
            if created:
                user.set_password(DEMO_PASSWORD)
                user.save()
            profile, _ = ParentProfile.objects.get_or_create(user=user)

            child, _ = Child.objects.get_or_create(
                first_name=child_first,
                last_name=child_last,
                defaults={
                    "date_of_birth": today - relativedelta(months=months),
                    "registration_date": today - relativedelta(months=1),
                    "allergies": ALLERGIES.get(child_first, ""),
                },
            )
            Guardianship.objects.get_or_create(
                parent=profile, child=child,
                defaults={"relationship": relation, "is_primary": True},
            )

            # The code is how a parent signs in, so the demo data is
            # useless without one. Printed at the end with the accounts.
            if not ChildAccessCode.objects.usable().filter(
                child=child, parent=profile
            ).exists():
                _, plain = ChildAccessCode.issue(child=child, parent=profile)
                self.codes.append((child.first_name, user.get_full_name(), plain))

            children.append(child)

        self.stdout.write(f"  families: {len(children)}")
        return children

    def _record_days(self, children, recorder, days: int) -> None:
        """A plausible day per child: bottles, a nap, a meal, a change."""
        created = 0
        for offset in range(days):
            day = timezone.localdate() - timedelta(days=offset)
            start = timezone.make_aware(
                timezone.datetime.combine(day, timezone.datetime.min.time()),
                timezone.get_current_timezone(),
            )

            for child in children:
                if TimelineEvent.objects.filter(child=child, local_date=day).exists():
                    continue

                nap_start = start + timedelta(hours=10, minutes=30)
                plan = [
                    ("BOTTLE", 8, 15, {"volume_ml": random.choice([150, 180, 200])}, None),
                    ("DIAPER", 9, 30, {"state": random.choice(["WET", "SOILED"])}, None),
                    ("SLEEP", 10, 30, {"quality": "GOOD"},
                     nap_start + timedelta(minutes=random.choice([60, 75, 90]))),
                    ("MEAL", 12, 0,
                     {"meal": "LUNCH", "eaten": random.choice(["ALL", "MOST"])}, None),
                    ("TEMPERATURE", 14, 30,
                     {"celsius": random.choice(["36.4", "36.6", "36.9"])}, None),
                    ("MOOD", 15, 0,
                     {"mood": random.choice(["HAPPY", "CALM", "ACTIVE"])}, None),
                    ("BOTTLE", 16, 0, {"volume_ml": 150}, None),
                ]

                for kind, hour, minute, data, ended_at in plan:
                    TimelineEvent.objects.create(
                        child=child, type=kind,
                        occurred_at=start + timedelta(hours=hour, minutes=minute),
                        ended_at=ended_at, data=data,
                        created_by=recorder,
                        # Past days are published; today is left in draft so
                        # the publish flow is demonstrable.
                        is_published=offset > 0,
                    )
                    created += 1

                record, _ = DailyRecord.objects.get_or_create(
                    child=child, date=day,
                    defaults={
                        "created_by": recorder,
                        "general_notes": f"{child.first_name} a passé une bonne journée.",
                    },
                )
                if offset > 0 and not record.is_published:
                    record.publish(by=recorder)

        self.stdout.write(f"  care events: {created}")

    def _create_activities(self, children, recorder) -> None:
        today = timezone.localdate()
        plan = [
            ("Atelier peinture", "ART", 0, "Peinture aux doigts sur grande feuille."),
            ("Éveil musical", "MUSIC", 1, "Découverte des instruments."),
            ("Jeux extérieurs", "OUTDOOR", 2, "Motricité dans la cour."),
        ]
        for title, category, offset, description in plan:
            activity, created = Activity.objects.get_or_create(
                title=title, date=today - timedelta(days=offset),
                defaults={
                    "category": category,
                    "description": description,
                    "start_time": timezone.datetime.min.time().replace(hour=9),
                    "end_time": timezone.datetime.min.time().replace(hour=10),
                    "created_by": recorder,
                },
            )
            if created:
                for child in random.sample(children, k=min(3, len(children))):
                    ActivityParticipation.objects.get_or_create(
                        activity=activity, child=child
                    )
                from apps.activities.services import sync_timeline_events

                sync_timeline_events(activity)
        self.stdout.write(f"  activities: {len(plan)}")

    def _create_complaints(self, children) -> None:
        subjects = [
            ("Horaires du soir", "Serait-il possible d'ajuster l'heure de sortie ?"),
            ("Repas", "Mon enfant a peu mangé cette semaine."),
        ]
        for (subject, message), child in zip(subjects, children):
            guardianship = Guardianship.objects.filter(child=child).first()
            if guardianship is None:
                continue
            Complaint.objects.get_or_create(
                parent=guardianship.parent, child=child, subject=subject,
                defaults={"message": message},
            )
        self.stdout.write(f"  complaints: {len(subjects)}")
