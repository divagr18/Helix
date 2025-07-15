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
export interface SignatureLocation {
  line: number;
  column: number;
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
  existing_docstring: string | null;
  signature_end_location: SignatureLocation | null;
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
  organization: number;
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

export interface AsyncTaskStatus {
  task_id: string;
  name: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILURE';
  progress: number; // A percentage from 0 to 100
  message: string | null;
  created_at: string; // ISO 8601 date string
  updated_at: string; // ISO 8601 date string

  // The result field can have different shapes depending on the task.
  // We use a generic object type and can narrow it down in components if needed.
  result: {
    // For PR creation tasks
    pull_request_url?: string;

    // For batch doc generation tasks
    files_processed?: number;
    pr_url?: string; // If it also creates a PR

    // For any failed task
    error?: string;

    // Allow for other potential properties
    [key: string]: any;
  } | null;
}
export interface Organization {
  id: number;
  name: string;
  // You can add more fields like owner, members, etc. as needed
}
export interface Invitation {
  id: number;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
  created_at: string;
}
export interface DetailedOrganization extends Organization {
  memberships: {
    id: number;
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
    user: {
      id: number;
      username: string;
      email: string;
    };
  }[];
  invitations: Invitation[];
}
export interface GeneratedDoc {
  markdown: string;
}
export interface FileCoverageData {
  id: number;
  file_path: string;
  code_file_id: number;
  line_rate: number;
  covered_lines: number[];
  missed_lines: number[];
}

export interface CoverageReport {
  id: number;
  commit_hash: string;
  uploaded_at: string;
  overall_coverage: number;
  file_coverages: FileCoverageData[];
}

export interface GraphLinkData {
  source: number; // ID of the caller symbol
  target: number; // ID of the callee symbol
}

// The data structure for the entire graph API response
export interface ComplexityGraphData {
  nodes: CodeSymbol[];
  links: GraphLinkData[];
}

// The internal representation of a node for D3 simulation
export interface GraphNode extends d3.SimulationNodeDatum {
  id: number;
  name: string;
  complexity: number;
  radius: number;
}

// The internal representation of a link for D3 simulation
export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: number | GraphNode; // D3 populates this
  target: number | GraphNode; // D3 populates this
}