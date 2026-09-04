export type NotificationType =
  | "NEW_MESSAGE"
  | "DAY_PUBLISHED"
  | "NEW_ACTIVITY"
  | "COMPLAINT_CREATED"
  | "COMPLAINT_UPDATED"
  | "COMPLAINT_REPLY";

export interface AppNotification {
  id: string;
  type: NotificationType;
  type_label: string;
  title: string;
  body: string;
  /** In-app route this points at. */
  link: string;
  child: { id: string; first_name: string } | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  NEW_MESSAGE: "💬",
  DAY_PUBLISHED: "📋",
  NEW_ACTIVITY: "🎨",
  COMPLAINT_CREATED: "📣",
  COMPLAINT_UPDATED: "🔄",
  COMPLAINT_REPLY: "↩️",
};
