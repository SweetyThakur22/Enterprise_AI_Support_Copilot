export type UserRole = 'ADMIN' | 'SUPPORT_ENGINEER' | 'INCIDENT_MANAGER' | 'VIEWER'

export interface User {
  id: number
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: User
}

export interface Incident {
  id: number
  incident_id: string
  title: string
  description: string
  application: string
  environment: 'DEV' | 'TEST' | 'UAT' | 'PROD' | 'DR'
  severity: 'P1' | 'P2' | 'P3' | 'P4'
  category: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'
  created_at: string
  updated_at: string
  assigned_to?: string | null
}

export interface IncidentListResponse {
  items: Incident[]
  total: number
  page: number
  page_size: number
}

export interface LogFile {
  id: number
  incident_id: number
  filename: string
  content: string
  file_size: number
  uploaded_at: string
}

export interface EvidenceItem {
  source: string
  chunk_id: number
  text: string
  score: number
}

export interface TimelineEvent {
  timestamp: string
  level: string
  message: string
}

export interface HistoricalIncident {
  incident_id: string
  title: string
  application: string
  severity: string
  similarity: number
  resolution_hint: string
}

export interface AnalysisEvidence {
  kb_chunks?: EvidenceItem[]
  historical_incidents?: HistoricalIncident[]
  log_stats?: {
    total_lines: number
    error_count: number
    warn_count: number
    time_span_seconds?: number
  }
  timeline?: TimelineEvent[]
  facts?: string[]
  assumptions?: string[]
  escalation_required?: boolean
  escalation_reason?: string | null
}

export interface AnalysisResult {
  id: number
  incident_id: number
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  classification?: string
  root_cause?: string
  confidence?: number
  evidence?: AnalysisEvidence
  recommendations?: Recommendation[]
  risk_level?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  requires_approval: boolean
  llm_model?: string
  token_usage?: number
  latency_ms?: number
  error_message?: string
  created_at: string
}

export interface Recommendation {
  text: string
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  requires_approval: boolean
  action_type?: string
}

export interface ApprovalRequest {
  id: number
  analysis_id: number
  recommendation_index: number
  recommendation_text: string
  risk_level: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  requested_by?: number
  reviewed_by?: number
  review_comment?: string
  simulated_result?: string
  requested_at: string
  reviewed_at?: string
}

export interface AuditLog {
  id: number
  user_id?: number
  action: string
  entity_type: string
  entity_id?: string
  details?: Record<string, unknown>
  ip_address?: string
  created_at: string
}
