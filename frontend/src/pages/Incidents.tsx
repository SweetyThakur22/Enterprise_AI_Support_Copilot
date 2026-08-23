import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { incidentsApi } from '@/services/api'
import type { Incident } from '@/types'
import { useAuth } from '@/hooks/useAuth'

const APPLICATIONS = ['Billing Platform', 'Customer Management', 'Payment Processing', 'Meter Data Platform', 'Notification Service', 'API Gateway']
const ENVIRONMENTS = ['DEV', 'TEST', 'UAT', 'PROD', 'DR']
const CATEGORIES = ['DATABASE', 'APPLICATION', 'NETWORK', 'API', 'BATCH', 'AUTHENTICATION', 'INFRASTRUCTURE', 'INTEGRATION', 'PERFORMANCE']
const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED']

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    P1: 'bg-red-100 text-red-700 border-red-200',
    P2: 'bg-orange-100 text-orange-700 border-orange-200',
    P3: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    P4: 'bg-blue-100 text-blue-700 border-blue-200',
  }
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${styles[severity] ?? 'bg-slate-100 text-slate-600'}`}>
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
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-slate-50 text-slate-600'}`}>
      {labels[status] ?? status}
    </span>
  )
}

export default function Incidents() {
  const { logout, user } = useAuth()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    severity: '', application: '', environment: '', category: '', status: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['incidents', page, filters],
    queryFn: () => incidentsApi.list({ page, page_size: 20, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }),
  })

  function setFilter(key: string, value: string) {
    setFilters(f => ({ ...f, [key]: value }))
    setPage(1)
  }

  const totalPages = data ? Math.ceil(data.total / 20) : 1

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
            <Link key={label} to={href} className={`flex items-center rounded-lg px-3 py-2 text-sm ${href === '/incidents' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-6 left-4 right-4">
          <div className="mb-1 text-xs text-slate-500">{user?.email}</div>
          <button onClick={logout} className="text-xs text-slate-500 hover:text-slate-300">Sign out</button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <h1 className="text-lg font-semibold text-slate-900">Incidents</h1>
          <p className="text-sm text-slate-500">{data?.total ?? 0} total incidents</p>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Filter panel */}
          <div className="w-52 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Filters</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Severity</label>
                <div className="space-y-1.5">
                  {['P1', 'P2', 'P3', 'P4'].map(s => (
                    <label key={s} className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="radio" name="severity" checked={filters.severity === s} onChange={() => setFilter('severity', filters.severity === s ? '' : s)} className="h-3.5 w-3.5" />
                      <SeverityBadge severity={s} />
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Application</label>
                <select value={filters.application} onChange={e => setFilter('application', e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="">All</option>
                  {APPLICATIONS.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Environment</label>
                <select value={filters.environment} onChange={e => setFilter('environment', e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="">All</option>
                  {ENVIRONMENTS.map(e => <option key={e}>{e}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Category</label>
                <select value={filters.category} onChange={e => setFilter('category', e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="">All</option>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Status</label>
                <select value={filters.status} onChange={e => setFilter('status', e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="">All</option>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              {Object.values(filters).some(Boolean) && (
                <button onClick={() => setFilters({ severity: '', application: '', environment: '', category: '', status: '' })} className="text-xs text-blue-600 hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <main className="flex-1 overflow-auto p-6">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center text-sm text-slate-400">Loading…</div>
            ) : (
              <>
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        {['ID', 'Title', 'Application', 'Environment', 'Severity', 'Category', 'Status', 'Created'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data?.items.map((inc: Incident) => (
                        <tr key={inc.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <Link to={`/incidents/${inc.incident_id}`} className="font-mono text-xs font-medium text-blue-600 hover:underline">
                              {inc.incident_id}
                            </Link>
                          </td>
                          <td className="max-w-xs px-4 py-3">
                            <Link to={`/incidents/${inc.incident_id}`} className="line-clamp-2 text-sm text-slate-800 hover:text-blue-600">
                              {inc.title}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">{inc.application}</td>
                          <td className="px-4 py-3">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">{inc.environment}</span>
                          </td>
                          <td className="px-4 py-3"><SeverityBadge severity={inc.severity} /></td>
                          <td className="px-4 py-3 text-xs text-slate-500">{inc.category}</td>
                          <td className="px-4 py-3"><StatusChip status={inc.status} /></td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {new Date(inc.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(!data?.items.length) && (
                    <div className="py-12 text-center text-sm text-slate-400">No incidents found</div>
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                    <span>Page {page} of {totalPages} ({data?.total} total)</span>
                    <div className="flex gap-2">
                      <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50 disabled:opacity-40">Prev</button>
                      <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50 disabled:opacity-40">Next</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
