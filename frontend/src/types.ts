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
export interface CodeSymbol {
  id: number;
  name: string;
  start_line: number;
  end_line: number;
  documentation: string | null;
  content_hash: string | null;
  documentation_hash: string | null;
  documentation_status: string | null;
  is_orphan?: boolean; // <<<< ADD THIS (optional if not always present)
  // For context when listing orphans:
  filePath?: string;
  className?: string;
  loc?: number | null;
  cyclomatic_complexity?: number | null;
}

export interface CodeClass {
  id: number;
  name: string;
  start_line: number;
  end_line: number;
  structure_hash: string | null;
  methods: CodeSymbol[];
}

export interface CodeFile {
  id: number;
  file_path: string;
  structure_hash: string | null;
  symbols: CodeSymbol[];
  classes: CodeClass[];
}

export interface Repository {
  id: number;
  full_name: string;
  status: string;
  root_merkle_hash: string | null;
  files: CodeFile[];
}