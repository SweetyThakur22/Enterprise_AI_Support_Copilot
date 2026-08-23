import axios from 'axios'
import type { TokenResponse, User, Incident, IncidentListResponse, LogFile, AnalysisResult, ApprovalRequest, AuditLog } from '@/types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('current_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

// ── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post<TokenResponse>('/auth/login', { email, password }).then((r) => r.data),

  me: () => api.get<User>('/auth/me').then((r) => r.data),

  register: (data: { email: string; password: string; full_name: string; role: string }) =>
    api.post<User>('/auth/register', data).then((r) => r.data),

  refresh: () => api.post<TokenResponse>('/auth/refresh').then((r) => r.data),
}

// ── Incidents ─────────────────────────────────────────────────────────────────

export const incidentsApi = {
  list: (params?: {
    page?: number
    page_size?: number
    severity?: string
    application?: string
    environment?: string
    category?: string
    status?: string
  }) => api.get<IncidentListResponse>('/incidents', { params }).then((r) => r.data),

  get: (incidentId: string) =>
    api.get<Incident>(`/incidents/${incidentId}`).then((r) => r.data),

  getLogs: (incidentId: string) =>
    api.get<LogFile[]>(`/incidents/${incidentId}/logs`).then((r) => r.data),

  getAnalysis: (incidentId: string) =>
    api.get<AnalysisResult>(`/incidents/${incidentId}/analysis`).then((r) => r.data),

  dashboardStats: () =>
    api.get('/dashboard/stats').then((r) => r.data),
}

// ── Analysis ──────────────────────────────────────────────────────────────────

export const analysisApi = {
  trigger: (incidentId: string) =>
    api.post<{ job_id: string; status: string }>(`/incidents/${incidentId}/analyze`).then((r) => r.data),

  getEvidence: (analysisId: number) =>
    api.get(`/analysis/${analysisId}/evidence`).then((r) => r.data),
}

// ── Approvals ─────────────────────────────────────────────────────────────────

export const approvalsApi = {
  list: () => api.get<ApprovalRequest[]>('/approvals').then((r) => r.data),

  get: (id: number) => api.get<ApprovalRequest>(`/approvals/${id}`).then((r) => r.data),

  approve: (id: number, comment?: string) =>
    api.post<ApprovalRequest>(`/approvals/${id}/approve`, { comment }).then((r) => r.data),

  reject: (id: number, comment: string) =>
    api.post<ApprovalRequest>(`/approvals/${id}/reject`, { comment }).then((r) => r.data),
}

// ── Audit ─────────────────────────────────────────────────────────────────────

export const auditApi = {
  list: (params?: { user_id?: number; action?: string; entity_type?: string; from_date?: string; to_date?: string; page?: number; page_size?: number }) =>
    api.get<{ items: AuditLog[]; total: number }>('/audit', { params }).then((r) => r.data),
}

export default api
