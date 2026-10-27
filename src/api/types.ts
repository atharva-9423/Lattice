export type UnitCode = 'AB' | 'ACB' | 'SGC' | 'VC';
export type UserRole = 'chairman' | 'bureau_head' | 'case_officer' | 'admin';
export type SeverityLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type RiskBand = 'Low' | 'Watch' | 'High' | 'Critical';
export type ComplaintStatus =
  | 'New'
  | 'Assigned'
  | 'In Review'
  | 'Awaiting Institution'
  | 'Escalated'
  | 'Resolved'
  | 'Closed';
export type SlaState = 'ok' | 'at_risk' | 'breached' | 'closed';

export interface RolePermissions {
  can_register_complaint: boolean;
  view_scope: 'all_full' | 'bureau_full' | 'bureau_assigned_first' | 'all_metadata_only';
  can_assign_officer: boolean;
  can_add_note: 'none' | 'own_bureau' | 'assigned_only';
  status_transitions: 'reopen_only' | 'section_5_bureau' | 'section_5_assigned' | 'none';
  can_resolve_link_queue: 'none' | 'own_bureau' | 'all';
  can_view_chairman_dashboard: boolean;
  can_view_bureau_dashboard: boolean;
}

export interface UserInfo {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  unit_code: UnitCode | null;
  officer_id: number | null;
  title: string;
  permissions: RolePermissions;
}

export interface DemoAccountInfo {
  email: string;
  password_hint: string;
  name: string;
  role: UserRole;
  unit_code: UnitCode | null;
  title: string;
}

export interface UnitSummary {
  id: number;
  code: UnitCode;
  name: string;
  kind: string;
  open_count: number;
  breached_count: number;
  officers: Array<{ id: number; name: string; title: string; unit_code: UnitCode }>;
}

export interface OverviewResponse {
  dashboard_type: 'chairman' | 'bureau';
  unit_code?: UnitCode | null;
  unit_name?: string | null;
  stats: {
    open: number;
    at_risk: number;
    breached: number;
    high_risk_institutions: number;
    resolved_30d: number;
    avg_resolution_days: number;
    pending_links?: number;
  };
  trend: Array<{
    week_start: string;
    AB: number;
    ACB: number;
    SGC: number;
    VC: number;
  }>;
  unit_workload: Array<{
    code: UnitCode;
    open: number;
    at_risk: number;
    breached?: number;
  }>;
  officer_workload?: Array<{
    id: number;
    name: string;
    title: string;
    assigned_open: number;
    at_risk: number;
    resolved_30d: number;
  }>;
  category_split: Array<{
    category: string;
    count: number;
  }>;
  watchlist: Array<{
    id: number;
    name: string;
    city: string;
    state: string;
    score: number;
    band: RiskBand;
    open_cases: number;
    sparkline: number[];
  }>;
  recent_alerts: AlertItem[];
}

export interface ComplaintListItem {
  id: number;
  ref: string;
  title: string;
  institution: { id: number; name: string };
  category: string;
  severity: SeverityLevel;
  status: ComplaintStatus;
  unit_code: UnitCode;
  assigned_officer_id: number | null;
  assigned_officer_name: string | null;
  is_assigned_to_me: boolean;
  metadata_only: boolean;
  created_at: string;
  due_at: string;
  sla_state: SlaState;
  breach_probability: number;
  cluster_size: number;
}

export interface PaginatedComplaints {
  items: ComplaintListItem[];
  total: number;
  page: number;
  page_size: number;
  metadata_only?: boolean;
}

export interface LinkedCaseItem {
  id: number;
  link_id?: number;
  ref: string;
  title: string;
  unit_code: UnitCode;
  severity: SeverityLevel;
  status: ComplaintStatus;
  created_at?: string;
  type: 'Duplicate' | 'Similar' | 'Context';
  similarity: number;
  resolution_status?: 'pending' | 'confirmed' | 'dismissed';
  resolved_by?: string | null;
}

export interface CaseEventItem {
  id: number;
  type: string;
  actor: string;
  message: string;
  created_at: string;
  redacted?: boolean;
}

export interface ComplaintDetail {
  id: number;
  ref: string;
  title: string;
  description: string | null;
  metadata_only: boolean;
  category: string;
  severity: SeverityLevel;
  status: ComplaintStatus;
  unit_code: UnitCode;
  unit_name: string;
  complainant_type: string;
  created_at: string;
  updated_at: string;
  due_at: string;
  resolved_at: string | null;
  escalation_count: number;
  auto_confidence: number;
  assigned_officer: { id: number; name: string; title: string } | null;
  is_assigned_to_me: boolean;
  unit_officers: Array<{ id: number; name: string; title: string }>;
  institution: {
    id: number;
    name: string;
    city: string;
    state: string;
    score: number;
    band: RiskBand;
  } | null;
  sla: {
    state: SlaState;
    breach_probability: number;
    elapsed_ratio: number;
    due_at: string;
  };
  cluster: {
    id: number | null;
    size: number;
  };
  links: LinkedCaseItem[];
  events: CaseEventItem[];
  allowed_actions: string[];
  allowed_status_transitions: ComplaintStatus[];
}

export interface LinkQueueItem {
  id: number;
  institution: { id: number; name: string; city: string; state: string };
  type: 'Duplicate' | 'Similar' | 'Context';
  similarity: number;
  resolution_status: 'pending' | 'confirmed' | 'dismissed';
  resolved_by: string | null;
  resolved_at: string | null;
  case_a: {
    id: number;
    ref: string;
    title: string;
    unit_code: UnitCode;
    severity: SeverityLevel;
    status: ComplaintStatus;
    created_at: string;
  };
  case_b: {
    id: number;
    ref: string;
    title: string;
    unit_code: UnitCode;
    severity: SeverityLevel;
    status: ComplaintStatus;
    created_at: string;
  };
  can_resolve: boolean;
}

export interface AnalyzeResponse {
  category: string;
  confidence: number;
  unit_code: UnitCode;
  severity: SeverityLevel;
  auto_category?: string;
  auto_unit_code?: UnitCode;
  auto_severity?: SeverityLevel;
  links: LinkedCaseItem[];
  projected_risk: {
    current: number;
    projected: number;
    delta: number;
    band_before: RiskBand;
    band_after: RiskBand;
  };
}

export interface InstitutionListItem {
  id: number;
  name: string;
  city: string;
  state: string;
  type: string;
  established_year: number;
  intake: number;
  score: number;
  band: RiskBand;
  open_cases: number;
  total_90d: number;
  sparkline: number[];
}

export interface PaginatedInstitutions {
  items: InstitutionListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface RiskFactorItem {
  key: string;
  label: string;
  weight: number;
  value: number;
  points: number;
  explanation: string;
}

export interface InstitutionDetailResponse {
  id: number;
  name: string;
  city: string;
  state: string;
  type: string;
  established_year: number;
  intake: number;
  score: number;
  band: RiskBand;
  pattern_summary: string | null;
  factors: RiskFactorItem[];
  history: Array<{ week: string; score: number }>;
  sparkline: number[];
  units_involved: UnitCode[];
  complaints: Array<{
    id: number;
    ref: string;
    title: string;
    category: string;
    severity: SeverityLevel;
    status: ComplaintStatus;
    unit_code: UnitCode;
    created_at: string;
    due_at: string;
    sla_state: SlaState;
    breach_probability: number;
  }>;
}

export interface GraphResponse {
  nodes: Array<{
    id: number;
    ref: string;
    title: string;
    unit_code: UnitCode;
    severity: SeverityLevel;
    status: ComplaintStatus;
    created_at: string;
  }>;
  edges: Array<{
    source: number;
    target: number;
    type: 'Duplicate' | 'Similar' | 'Context';
    similarity: number;
  }>;
}

export interface AlertItem {
  id: number;
  rule: 'R1' | 'R2' | 'R3' | 'R4';
  rule_label?: string;
  severity: SeverityLevel;
  institution_id: number | null;
  institution_name?: string | null;
  complaint_id: number | null;
  complaint_ref?: string | null;
  message: string;
  created_at: string;
  acknowledged: boolean;
  acknowledged_by?: string | null;
}
