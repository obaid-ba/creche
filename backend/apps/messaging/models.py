"""Messaging.

Models land here in Phase 4 because ``TimelineEvent`` references
``Message``. The messaging API and UI arrive in Phase 7.

Conversations are scoped to a child, which is what lets parent
authorisation reuse the same guardianship check as everything else
(docs/database.md 7).
"""
from __future__ import annotations

from django.conf import settings
from django.db import models

from common.models import BaseModel


class Conversation(BaseModel):
    child = models.ForeignKey(
        "children.Child", on_delete=models.CASCADE, related_name="conversations"
    )
    subject = models.CharField(max_length=150, blank=True)
    last_message_at = models.DateTimeField(null=True, blank=True)
    is_closed = models.BooleanField(default=False)

    class Meta:
        db_table = "messaging_conversation"
        ordering = ["-last_message_at", "-created_at"]
        indexes = [models.Index(fields=["child", "-last_message_at"])]
        verbose_name = "Conversation"
        verbose_name_plural = "Conversations"

    def __str__(self) -> str:
        return self.subject or f"Conversation {self.pk}"


class Message(BaseModel):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        "accounts.User", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="sent_messages",
    )
    body = models.TextField()

    class Meta:
        db_table = "messaging_message"
        ordering = ["created_at"]
        indexes = [models.Index(fields=["conversation", "-created_at"])]
        verbose_name = "Message"
        verbose_name_plural = "Messages"

    def __str__(self) -> str:
        return f"{self.sender_id}: {self.body[:40]}"


class MessageAttachment(BaseModel):
    message = models.ForeignKey(
        Message, on_delete=models.CASCADE, related_name="attachments"
    )
    file = models.FileField(upload_to="messages/attachments/")
    thumbnail = models.ImageField(
        upload_to="messages/thumbnails/", null=True, blank=True
    )
    content_type = models.CharField(max_length=60)
    size_bytes = models.PositiveIntegerField()

    class Meta:
        db_table = "messaging_messageattachment"
        constraints = [
            # The 10 MB ceiling is enforced by the database too, not only
            # by the upload view.
            models.CheckConstraint(
                condition=models.Q(size_bytes__lte=10 * 1024 * 1024),
                name="attachment_size_limit",
            ),
        ]
        verbose_name = "Pièce jointe"
        verbose_name_plural = "Pièces jointes"


class MessageRead(BaseModel):
    """Read receipts, and the source of the unread counts on both dashboards."""

    message = models.ForeignKey(
        Message, on_delete=models.CASCADE, related_name="reads"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="message_reads"
    )
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "messaging_messageread"
        constraints = [
            models.UniqueConstraint(
                fields=["message", "user"], name="uniq_message_read_per_user"
            ),
        ]
        verbose_name = "Lecture"
        verbose_name_plural = "Lectures"
