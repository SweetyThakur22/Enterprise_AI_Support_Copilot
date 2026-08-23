import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { auditApi } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import type { AuditLog } from '@/types'

export default function AuditLogPage() {
  const { logout, user } = useAuth()
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filters, setFilters] = useState({ action: '', entity_type: '', from_date: '', to_date: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, filters],
    queryFn: () => auditApi.list({
      page,
      page_size: 50,
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.entity_type ? { entity_type: filters.entity_type } : {}),
      ...(filters.from_date ? { from_date: filters.from_date } : {}),
      ...(filters.to_date ? { to_date: filters.to_date } : {}),
    }),
  })

  const totalPages = data ? Math.ceil(data.total / 50) : 1

  function exportCsv() {
    const rows = data?.items ?? []
    const header = 'id,created_at,user_id,action,entity_type,entity_id'
    const lines = rows.map(r =>
      [r.id, r.created_at, r.user_id ?? '', r.action, r.entity_type, r.entity_id ?? ''].join(',')
    )
    const csv = [header, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'audit_log.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const ACTION_COLORS: Record<string, string> = {
    ANALYSIS_TRIGGERED: 'bg-blue-100 text-blue-700',
    ANALYSIS_COMPLETED: 'bg-green-100 text-green-700',
    ANALYSIS_FAILED: 'bg-red-100 text-red-700',
    APPROVAL_REQUESTED: 'bg-amber-100 text-amber-700',
    APPROVAL_APPROVED: 'bg-green-100 text-green-700',
    APPROVAL_REJECTED: 'bg-red-100 text-red-700',
    LOGIN: 'bg-slate-100 text-slate-600',
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
            <Link key={label} to={href} className={`flex items-center rounded-lg px-3 py-2 text-sm ${href === '/audit' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
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
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Audit Log</h1>
              <p className="text-sm text-slate-500">{data?.total ?? 0} records</p>
            </div>
            <button
              onClick={exportCsv}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Export CSV
            </button>
          </div>

          {/* Filter bar */}
          <div className="mt-3 flex flex-wrap gap-3">
            <select
              value={filters.action}
              onChange={e => { setFilters(f => ({ ...f, action: e.target.value })); setPage(1) }}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All actions</option>
              {['ANALYSIS_TRIGGERED', 'ANALYSIS_COMPLETED', 'ANALYSIS_FAILED', 'APPROVAL_REQUESTED', 'APPROVAL_APPROVED', 'APPROVAL_REJECTED', 'LOGIN'].map(a => (
                <option key={a}>{a}</option>
              ))}
            </select>
            <select
              value={filters.entity_type}
              onChange={e => { setFilters(f => ({ ...f, entity_type: e.target.value })); setPage(1) }}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All entities</option>
              {['incident', 'analysis_result', 'approval_request', 'user'].map(t => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input
              type="date"
              value={filters.from_date}
              onChange={e => { setFilters(f => ({ ...f, from_date: e.target.value })); setPage(1) }}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="date"
              value={filters.to_date}
              onChange={e => { setFilters(f => ({ ...f, to_date: e.target.value })); setPage(1) }}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {Object.values(filters).some(Boolean) && (
              <button
                onClick={() => { setFilters({ action: '', entity_type: '', from_date: '', to_date: '' }); setPage(1) }}
                className="text-xs text-blue-600 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        </header>

        <div className="p-6">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-400">Loading…</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.items.map((log: AuditLog) => (
                    <>
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{log.user_id ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${ACTION_COLORS[log.action] ?? 'bg-slate-100 text-slate-600'}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{log.entity_type}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{log.entity_id ?? '—'}</td>
                        <td className="px-4 py-3">
                          {log.details && Object.keys(log.details).length > 0 && (
                            <button
                              onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              {expandedId === log.id ? 'Hide' : 'Details'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedId === log.id && log.details && (
                        <tr key={`${log.id}-detail`}>
                          <td colSpan={6} className="bg-slate-50 px-6 py-3">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {Object.entries(log.details).map(([k, v]) => (
                                <div key={k}>
                                  <span className="font-medium text-slate-500">{k}: </span>
                                  <span className="text-slate-700">{JSON.stringify(v)}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
              {(!data?.items.length) && (
                <div className="py-12 text-center text-sm text-slate-400">No audit records found</div>
              )}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
              <span>Page {page} of {totalPages} ({data?.total} total)</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50 disabled:opacity-40">Prev</button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
