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
export interface LinkedSymbol {
  id: number;
  name: string;
  unique_id: string; // Ensure this matches your LinkedSymbolSerializer
}
export interface CodeSymbol {
  id: number;
  name: string;
  start_line: number;
  end_line: number;
  documentation: string | null;
  content_hash: string | null;
  incoming_calls: LinkedSymbol[];
  outgoing_calls: LinkedSymbol[];
  documentation_hash: string | null;
  documentation_status: string | null;
  is_orphan?: boolean; // <<<< ADD THIS (optional if not always present)
  // For context when listing orphans:
  filePath?: string;
  className?: string;
  loc?: number | null;
  cyclomatic_complexity?: number | null;
}
export interface SymbolDetail extends CodeSymbol { // Extends the base
  source_code: string | null;       // Specific to detail view
  incoming_calls: LinkedSymbol[]; // Specific to detail view
  outgoing_calls: LinkedSymbol[]; // Specific to detail view
  unique_id: string;              // Guaranteed to be present and non-optional
  // Potentially other detailed fields
}

export interface CodeClass {
  id: number;
  name: string;
  start_line: number;
  end_line: number;
  structure_hash: string | null;
  methods: CodeSymbol[];
  summary: string | null; // <--- ADD THIS

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
export interface InsightRelatedSymbol {
  id: number;
  name: string;
  unique_id: string;
}

// The main Insight type, matching the Django serializer output
export interface Insight {
  id: number;
  commit_hash: string;
  insight_type: 'SYMBOL_ADDED' | 'SYMBOL_REMOVED' | 'SYMBOL_MODIFIED' | 'DEPENDENCY_ADDED' | 'DEPENDENCY_REMOVED'; // Add more as you create them
  get_insight_type_display: string; // The human-readable version
  message: string;
  data: {
    // The structure of 'data' can vary, so we define it loosely
    // or create specific types for each insight_type if needed.
    id?: number;
    name: string;
    file_path: string;
    class_name?: string;
    [key: string]: any; // Allows for other properties
  };
  related_symbol: InsightRelatedSymbol | null;
  is_resolved: boolean;
  created_at: string; // ISO 8601 date string
}