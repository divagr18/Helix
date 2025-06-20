// Example: frontend/src/types.ts
export interface AppNotification {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string; // ISO string date
  repository_full_name?: string | null;
  link_url?: string | null;
  notification_type?: string; // e.g., 'STALENESS_ALERT'
  get_notification_type_display?: string; // Human-readable type
}