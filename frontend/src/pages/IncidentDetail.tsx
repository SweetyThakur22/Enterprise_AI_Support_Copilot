import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { incidentsApi } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import { useAnalysis, type AnalysisStep } from '@/hooks/useAnalysis'
import type { LogFile, EvidenceItem, HistoricalIncident, TimelineEvent, Recommendation } from '@/types'

// ── Shared badges ──────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    P1: 'bg-red-100 text-red-700 border-red-200',
    P2: 'bg-orange-100 text-orange-700 border-orange-200',
    P3: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    P4: 'bg-blue-100 text-blue-700 border-blue-200',
  }
  return (
    <span className={`inline-flex items-center rounded border px-2.5 py-1 text-sm font-bold ${styles[severity] ?? 'bg-slate-100 text-slate-600'}`}>
      {severity}
    </span>
  )
}

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    OPEN: 'bg-red-50 text-red-700',
    IN_PROGRESS: 'bg-amber-50 text-amber-700',
    RESOLVED: 'bg-green-50 text-green-700',
  }
  const labels: Record<string, string> = { OPEN: 'Open', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved' }
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${styles[status] ?? 'bg-slate-50 text-slate-600'}`}>
      {labels[status] ?? status}
    </span>
  )
}

function RiskBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    LOW: 'bg-green-100 text-green-700',
    MEDIUM: 'bg-yellow-100 text-yellow-700',
    HIGH: 'bg-orange-100 text-orange-700',
    CRITICAL: 'bg-red-100 text-red-800',
  }
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${styles[level] ?? 'bg-slate-100 text-slate-600'}`}>
      {level}
    </span>
  )
}

// ── Progress steps ─────────────────────────────────────────────────────────────

const STEPS: { key: AnalysisStep; label: string }[] = [
  { key: 'classifying', label: 'Classifying Incident' },
  { key: 'parsing_logs', label: 'Parsing Logs' },
  { key: 'retrieving_knowledge', label: 'Retrieving Knowledge' },
  { key: 'searching_history', label: 'Searching History' },
  { key: 'analyzing', label: 'Analyzing with Claude' },
  { key: 'complete', label: 'Analysis Complete' },
]

const STEP_ORDER_MAP: Record<AnalysisStep, number> = {
  idle: -1,
  classifying: 0,
  parsing_logs: 1,
  retrieving_knowledge: 2,
  searching_history: 3,
  analyzing: 4,
  complete: 5,
  failed: 5,
}

function ProgressPanel({ activeStep }: { activeStep: AnalysisStep }) {
  const current = STEP_ORDER_MAP[activeStep]
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">AI Investigation Progress</h2>
      <div className="space-y-3">
        {STEPS.map((step, i) => {
          const done = i < current
          const active = i === current
          return (
            <div key={step.key} className="flex items-center gap-3">
              {done ? (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500">
                  <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : active ? (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                  <svg className="h-5 w-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-slate-300">
                  <span className="text-xs text-slate-400">{i + 1}</span>
                </div>
              )}
              <span className={`text-sm ${active ? 'font-semibold text-blue-700' : done ? 'text-slate-500 line-through' : 'text-slate-400'}`}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Confidence gauge ───────────────────────────────────────────────────────────

function ConfidenceGauge({ value }: { value: number }) {
  const color = value >= 75 ? 'bg-green-500' : value >= 50 ? 'bg-orange-500' : 'bg-red-500'
  const textColor = value >= 75 ? 'text-green-700' : value >= 50 ? 'text-orange-700' : 'text-red-700'
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">Confidence</span>
        <span className={`text-lg font-bold ${textColor}`}>{value}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

// ── Results panel ──────────────────────────────────────────────────────────────

function ResultsPanel({ analysis, incidentId }: { analysis: NonNullable<ReturnType<typeof useAnalysis>['analysis']>; incidentId: string }) {
  const [expandedEvidence, setExpandedEvidence] = useState<number | null>(null)
  const evidence = analysis.evidence
  const kbChunks = evidence?.kb_chunks ?? []
  const historicalIncidents = evidence?.historical_incidents ?? []
  const timeline = evidence?.timeline ?? []
  const facts = evidence?.facts ?? []
  const assumptions = evidence?.assumptions ?? []
  const contradicting = evidence?.contradicting_evidence ?? []

  return (
    <div className="space-y-4">
      {/* Classification + confidence */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <span className="rounded bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
              {analysis.classification}
            </span>
            {analysis.risk_level && (
              <span className="ml-2">
                <RiskBadge level={analysis.risk_level} />
              </span>
            )}
          </div>
          <div className="text-right text-xs text-slate-400">
            {analysis.llm_model} · {analysis.token_usage?.toLocaleString()} tokens · {analysis.latency_ms}ms
          </div>
        </div>
        {analysis.confidence != null && <ConfidenceGauge value={analysis.confidence} />}
        {evidence?.escalation_required && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <strong>Escalation required:</strong> {evidence.escalation_reason}
          </div>
        )}
      </div>

      {/* Root cause */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Root Cause</h3>
        <p className="text-sm leading-relaxed text-slate-700">{analysis.root_cause}</p>
      </div>

      {/* Facts vs assumptions */}
      {(facts.length > 0 || assumptions.length > 0) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {facts.length > 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-700">Confirmed Facts</h3>
              <ul className="space-y-1">
                {facts.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-green-800">
                    <span className="mt-0.5 text-green-500">✓</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {assumptions.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">Assumptions</h3>
              <ul className="space-y-1">
                {assumptions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                    <span className="mt-0.5 text-amber-500">~</span>{a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Contradicting evidence — honest AI transparency */}
      {contradicting.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-red-700">Contradicting Evidence</h3>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">transparency</span>
          </div>
          <p className="mb-2 text-xs text-red-600">These observations do not fully fit the root cause — shown so nothing is hidden.</p>
          <ul className="space-y-1">
            {contradicting.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-800">
                <span className="mt-0.5 shrink-0 text-red-400">✗</span>{c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Evidence */}
      {kbChunks.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Evidence — Knowledge Base</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {kbChunks.map((ev: EvidenceItem, i: number) => (
              <div key={i} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-700">
                      {(ev.score * 100).toFixed(0)}%
                    </span>
                    <span className="text-sm font-medium text-slate-800">{ev.source}</span>
                  </div>
                  <button
                    onClick={() => setExpandedEvidence(expandedEvidence === i ? null : i)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {expandedEvidence === i ? 'Collapse' : 'View excerpt'}
                  </button>
                </div>
                {expandedEvidence === i && (
                  <blockquote className="mt-2 rounded bg-slate-50 border-l-2 border-blue-300 px-4 py-2 text-xs leading-relaxed text-slate-600">
                    {ev.text}
                  </blockquote>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historical incidents */}
      {historicalIncidents.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Similar Historical Incidents</h3>
          </div>
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                {['ID', 'Application', 'Severity', 'Similarity', 'Resolution'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historicalIncidents.map((h: HistoricalIncident, i: number) => (
                <tr key={i}>
                  <td className="px-4 py-2 font-mono text-xs font-medium text-blue-600">{h.incident_id}</td>
                  <td className="px-4 py-2 text-xs text-slate-600">{h.application}</td>
                  <td className="px-4 py-2"><SeverityBadge severity={h.severity} /></td>
                  <td className="px-4 py-2 text-xs text-slate-600">{(h.similarity * 100).toFixed(0)}%</td>
                  <td className="max-w-xs px-4 py-2 text-xs text-slate-500 truncate">{h.resolution_hint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Event Timeline</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {timeline.map((ev: TimelineEvent, i: number) => {
              const levelColor =
                ev.level === 'ERROR' || ev.level === 'FATAL'
                  ? 'text-red-600 bg-red-50'
                  : ev.level === 'WARN'
                    ? 'text-amber-600 bg-amber-50'
                    : 'text-slate-500 bg-slate-50'
              return (
                <div key={i} className="flex items-start gap-3 px-4 py-2">
                  <span className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${levelColor}`}>{ev.level}</span>
                  <span className="font-mono text-xs text-slate-400 shrink-0">
                    {ev.timestamp.replace('T', ' ').slice(0, 19)}
                  </span>
                  <span className="text-xs text-slate-700">{ev.message}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {(analysis.recommendations?.length ?? 0) > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Recommendations</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {(analysis.recommendations as Recommendation[]).map((rec, i) => (
              <div key={i} className="flex items-start justify-between gap-4 p-4">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <RiskBadge level={rec.risk_level} />
                    {rec.requires_approval && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                        Approval required
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700">{rec.text}</p>
                </div>
                {rec.requires_approval && (
                  <div className="flex shrink-0 gap-2">
                    <Link
                      to="/approvals"
                      className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                    >
                      Approve
                    </Link>
                    <Link
                      to="/approvals"
                      className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Reject
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>()
  const { logout, user, canAccess } = useAuth()
  const [expandedLog, setExpandedLog] = useState<number | null>(null)

  const { data: incident, isLoading } = useQuery({
    queryKey: ['incident', id],
    queryFn: () => incidentsApi.get(id!),
    enabled: !!id,
  })

  const { data: logs } = useQuery({
    queryKey: ['incident-logs', id],
    queryFn: () => incidentsApi.getLogs(id!),
    enabled: !!id,
  })

  const { analysis, isRunning, activeStep, trigger } = useAnalysis(id ?? '')
  const canAnalyze = canAccess('SUPPORT_ENGINEER', 'INCIDENT_MANAGER', 'ADMIN')
  const hasResult = analysis?.status === 'COMPLETED'
  const isFailed = analysis?.status === 'FAILED'

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-400">Loading incident…</div>
      </div>
    )
  }

  if (!incident) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-800">Incident not found</p>
          <Link to="/incidents" className="mt-2 text-sm text-blue-600 hover:underline">Back to incidents</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-slate-900 px-4 py-6">
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-blue-600">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-white">AI Copilot</span>
        </div>
        <nav className="space-y-1">
          {[
            { label: 'Dashboard', href: '/' },
            { label: 'Incidents', href: '/incidents' },
            { label: 'Approvals', href: '/approvals' },
            { label: 'Audit Log', href: '/audit' },
          ].map(({ label, href }) => (
            <Link key={label} to={href} className="flex items-center rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white">
              {label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-6 left-4 right-4">
          <div className="mb-1 text-xs text-slate-500">{user?.email}</div>
          <button onClick={logout} className="text-xs text-slate-500 hover:text-slate-300">Sign out</button>
        </div>
      </aside>

      <div className="flex-1 overflow-auto">
        {/* Breadcrumb + header */}
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
            <Link to="/incidents" className="hover:text-blue-600">Incidents</Link>
            <span>/</span>
            <span className="font-mono">{incident.incident_id}</span>
          </div>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold text-slate-500">{incident.incident_id}</span>
              <SeverityBadge severity={incident.severity} />
              <StatusChip status={incident.status} />
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{incident.environment}</span>
            </div>
            {canAnalyze && (
              <button
                onClick={trigger}
                disabled={isRunning}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRunning ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyzing…
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Analyze Incident
                  </>
                )}
              </button>
            )}
          </div>
          <h1 className="mt-2 text-xl font-bold text-slate-900">{incident.title}</h1>
        </header>

        <div className="mx-auto max-w-5xl space-y-6 p-6">
          {/* Incident details card */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Incident Details</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: 'Application', value: incident.application },
                { label: 'Category', value: incident.category },
                { label: 'Environment', value: incident.environment },
                { label: 'Assigned To', value: incident.assigned_to ?? 'Unassigned' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs font-medium text-slate-500">{label}</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <dt className="mb-1 text-xs font-medium text-slate-500">Description</dt>
              <dd className="text-sm leading-relaxed text-slate-700">{incident.description}</dd>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-medium text-slate-500">Created</dt>
                <dd className="mt-1 text-sm text-slate-700">{new Date(incident.created_at).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Last Updated</dt>
                <dd className="mt-1 text-sm text-slate-700">{new Date(incident.updated_at).toLocaleString()}</dd>
              </div>
            </div>
          </div>

          {/* Log files */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Log Files</h2>
              <p className="text-xs text-slate-500">{logs?.length ?? 0} file(s) attached</p>
            </div>
            {logs?.length ? (
              <div className="divide-y divide-slate-100">
                {logs.map((log: LogFile) => (
                  <div key={log.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div>
                          <p className="font-mono text-sm font-medium text-slate-800">{log.filename}</p>
                          <p className="text-xs text-slate-500">{(log.file_size / 1024).toFixed(1)} KB · {new Date(log.uploaded_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                        className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        {expandedLog === log.id ? 'Collapse' : 'View'}
                      </button>
                    </div>
                    {expandedLog === log.id && (
                      <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-200">
                        {log.content}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-slate-400">No log files attached</div>
            )}
          </div>

          {/* Analysis section */}
          {isRunning && activeStep !== 'idle' && (
            <ProgressPanel activeStep={activeStep} />
          )}

          {isFailed && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Analysis failed. {analysis?.error_message ?? 'An unexpected error occurred.'}
            </div>
          )}

          {hasResult && analysis && (
            <ResultsPanel analysis={analysis} incidentId={id ?? ''} />
          )}

          {!isRunning && !hasResult && !isFailed && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <svg className="mx-auto mb-3 h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p className="text-sm font-medium text-slate-500">No AI Analysis Yet</p>
              {canAnalyze ? (
                <p className="mt-1 text-xs text-slate-400">Click "Analyze Incident" to start the AI investigation pipeline.</p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">A Support Engineer or higher can trigger analysis for this incident.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
