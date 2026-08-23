import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer, CartesianGrid } from 'recharts'
import { incidentsApi } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import type { Incident } from '@/types'

const SEVERITY_COLORS: Record<string, string> = {
  P1: '#ef4444',
  P2: '#f97316',
  P3: '#eab308',
  P4: '#3b82f6',
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

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

export default function Dashboard() {
  const { logout, user } = useAuth()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => incidentsApi.dashboardStats(),
    refetchInterval: 30000,
  })

  const byApp = stats
    ? Object.entries(stats.incidents_by_application as Record<string, number>).map(([name, count]) => ({ name, count }))
    : []

  const bySev = stats
    ? Object.entries(stats.incidents_by_severity as Record<string, number>).map(([name, value]) => ({ name, value }))
    : []

  const last7 = stats?.incidents_last_7_days ?? []

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
            <Link key={label} to={href} className={`flex items-center rounded-lg px-3 py-2 text-sm ${href === '/' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
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
          <h1 className="text-lg font-semibold text-slate-900">Operations Dashboard</h1>
          <p className="text-sm text-slate-500">Real-time incident intelligence</p>
        </header>

        <div className="space-y-6 p-6">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-400">Loading dashboard…</div>
          ) : (
            <>
              {/* Metric cards */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <MetricCard label="Incidents This Week" value={stats?.incidents_this_week ?? 0} />
                <MetricCard label="Open Incidents" value={stats?.open_incidents ?? 0} />
                <MetricCard label="Critical (P1)" value={stats?.p1_incidents ?? 0} sub="Active" />
                <MetricCard label="AI Analyzed" value={stats?.ai_analyzed_count ?? 0} />
                <MetricCard label="Pending Approvals" value={stats?.pending_approvals ?? 0} />
                <MetricCard
                  label="Avg AI Confidence"
                  value={stats?.avg_confidence != null ? `${stats.avg_confidence}%` : '—'}
                />
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {/* Bar: incidents by application */}
                <div className="col-span-2 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-4 text-sm font-semibold text-slate-900">Incidents by Application</h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={byApp} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Donut: by severity */}
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-4 text-sm font-semibold text-slate-900">By Severity</h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={bySev} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {bySev.map(entry => (
                          <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] ?? '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Line chart: last 7 days */}
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold text-slate-900">Incidents — Last 7 Days</h2>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={last7} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Recent incidents + Pending approvals */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Recent incidents */}
                <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <h2 className="text-sm font-semibold text-slate-900">Recent Incidents</h2>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {(stats?.recent_incidents ?? []).map((inc: Incident) => (
                      <Link key={inc.id} to={`/incidents/${inc.incident_id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                        <div>
                          <p className="font-mono text-xs font-medium text-blue-600">{inc.incident_id}</p>
                          <p className="mt-0.5 line-clamp-1 text-sm text-slate-700">{inc.title}</p>
                          <p className="text-xs text-slate-400">{inc.application}</p>
                        </div>
                        <SeverityBadge severity={inc.severity} />
                      </Link>
                    ))}
                  </div>
                  <div className="border-t border-slate-100 px-5 py-3">
                    <Link to="/incidents" className="text-xs text-blue-600 hover:underline">View all incidents →</Link>
                  </div>
                </div>

                {/* Pending approvals widget */}
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-3 text-sm font-semibold text-slate-900">Pending Approvals</h2>
                  {(stats?.pending_approvals ?? 0) === 0 ? (
                    <div className="flex h-24 items-center justify-center text-sm text-slate-400">
                      No pending approvals
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg bg-amber-50 px-4 py-4">
                      <div>
                        <p className="text-2xl font-bold text-amber-700">{stats?.pending_approvals}</p>
                        <p className="text-xs text-amber-600">approval{stats?.pending_approvals !== 1 ? 's' : ''} awaiting review</p>
                      </div>
                      <Link to="/approvals" className="rounded bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700">
                        Review now →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
