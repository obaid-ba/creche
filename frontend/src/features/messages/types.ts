import type { Role } from "@/types/api";

export interface MessageSender {
  id: string;
  first_name: string;
  last_name: string;
  role: Role;
}

export interface MessageAttachment {
  id: string;
  file_url: string | null;
  thumbnail_url: string | null;
  content_type: string;
  size_bytes: number;
}

export interface Message {
  id: string;
  conversation: string;
  body: string;
  sender: MessageSender | null;
  attachments: MessageAttachment[];
  /** Computed per viewer, server-side. */
  is_mine: boolean;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  child: { id: string; first_name: string; last_name: string };
  subject: string;
  is_closed: boolean;
  last_message: {
    body: string;
    created_at: string;
    sender_role: Role | null;
  } | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
}
