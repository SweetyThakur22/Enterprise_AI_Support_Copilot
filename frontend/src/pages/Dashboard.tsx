import { useRef, useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
  AreaChart, Area, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { incidentsApi } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import type { Incident } from '@/types'

const SEVERITY_COLORS: Record<string, string> = {
  P1: '#ef4444', P2: '#f97316', P3: '#eab308', P4: '#3b82f6',
}

const APPS = ['Billing Platform', 'Customer Management', 'Payment Processing', 'Meter Data Platform', 'Notification Service', 'API Gateway']

// ── 3D tilt card ──────────────────────────────────────────────────────────────

function TiltCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({})

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const { left, top, width, height } = el.getBoundingClientRect()
    const x = (e.clientX - left) / width - 0.5
    const y = (e.clientY - top) / height - 0.5
    setStyle({
      transform: `perspective(900px) rotateX(${-y * 10}deg) rotateY(${x * 10}deg) scale3d(1.025,1.025,1.025)`,
      transition: 'transform 0.08s ease-out',
    })
  }, [])

  const onMouseLeave = useCallback(() => {
    setStyle({ transform: 'perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)', transition: 'transform 0.5s ease-out' })
  }, [])

  return (
    <div ref={ref} style={style} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} className={className}>
      {children}
    </div>
  )
}

// ── Animated count-up ─────────────────────────────────────────────────────────

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (value === 0) { setDisplay(0); return }
    let start = 0
    const step = Math.max(1, Math.ceil(value / 40))
    const timer = setInterval(() => {
      start = Math.min(start + step, value)
      setDisplay(start)
      if (start >= value) clearInterval(timer)
    }, 20)
    return () => clearInterval(timer)
  }, [value])
  return <>{display}</>
}

// ── Circular SVG gauge ────────────────────────────────────────────────────────

function CircularGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 50
  const circ = 2 * Math.PI * r
  const filled = ((value || 0) / 100) * circ
  return (
    <div className="flex flex-col items-center">
      <svg width={130} height={130} viewBox="0 0 130 130">
        <defs>
          <filter id="gaugeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
        {/* Fill */}
        <circle
          cx="65" cy="65" r={r} fill="none"
          stroke={color} strokeWidth="12"
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 65 65)"
          style={{ transition: 'stroke-dasharray 1.4s cubic-bezier(0.4,0,0.2,1)' }}
          filter="url(#gaugeGlow)"
        />
        {/* Inner glow ring */}
        <circle cx="65" cy="65" r="38" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <text x="65" y="58" textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="22" fontWeight="900">{value || 0}%</text>
        <text x="65" y="78" textAnchor="middle" fill="#64748b" fontSize="11">{label}</text>
      </svg>
    </div>
  )
}

// ── Service health grid ────────────────────────────────────────────────────────

function ServiceHealthGrid({ incidentsByApp }: { incidentsByApp: Record<string, number> }) {
  const maxCount = Math.max(...Object.values(incidentsByApp), 1)
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {APPS.map(app => {
        const count = incidentsByApp[app] ?? 0
        const ratio = count / maxCount
        const status = count === 0 ? 'healthy' : ratio < 0.45 ? 'degraded' : 'critical'
        const cfg = {
          healthy: { dotClass: 'bg-green-400', textClass: 'text-green-400', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)' },
          degraded: { dotClass: 'bg-amber-400', textClass: 'text-amber-400', bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.2)' },
          critical: { dotClass: 'bg-red-400 animate-pulse', textClass: 'text-red-400', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)' },
        }[status]
        const shortName = app.split(' ')[0]
        return (
          <div key={app} className="rounded-lg p-3" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-slate-300 truncate" title={app}>{shortName}</p>
              <div className={`h-2 w-2 rounded-full ${cfg.dotClass}`} />
            </div>
            <p className={`text-xl font-black ${cfg.textClass}`}>{count}</p>
            <p className="text-xs capitalize" style={{ color: cfg.textClass.includes('green') ? '#4ade80' : cfg.textClass.includes('amber') ? '#fbbf24' : '#f87171', opacity: 0.7 }}>{status}</p>
          </div>
        )
      })}
    </div>
  )
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 shadow-xl">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-bold text-white">{payload[0].value}</p>
    </div>
  )
}

// ── Severity badge ─────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    P1: 'bg-red-500/20 text-red-400 border-red-500/30',
    P2: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    P3: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    P4: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  }
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-bold ${styles[severity] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
      {severity}
    </span>
  )
}

// ── Metric card config ─────────────────────────────────────────────────────────

interface CardCfg {
  label: string
  value: number | string
  sub: string
  accent: string
  bg: string
  pulse?: boolean
  icon: string
}

// ── Main dashboard ─────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { logout, user } = useAuth()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => incidentsApi.dashboardStats(),
    refetchInterval: 30000,
  })

  const byApp: Array<{ name: string; count: number }> = stats
    ? Object.entries(stats.incidents_by_application as Record<string, number>)
        .map(([name, count]) => ({ name: name.split(' ')[0], count }))
        .sort((a, b) => b.count - a.count)
    : []

  const bySev: Array<{ name: string; value: number }> = stats
    ? Object.entries(stats.incidents_by_severity as Record<string, number>).map(([name, value]) => ({ name, value }))
    : []

  const last7: Array<{ date: string; count: number }> = stats?.incidents_last_7_days ?? []

  const avgConf = Math.round(stats?.avg_confidence ?? 0)
  const gaugeColor = avgConf >= 75 ? '#22c55e' : avgConf >= 50 ? '#f97316' : '#ef4444'

  const cards: CardCfg[] = [
    { label: 'This Week', value: stats?.incidents_this_week ?? 0, sub: 'incidents', accent: '#3b82f6', bg: 'rgba(59,130,246,0.1)', icon: '📊' },
    { label: 'Open', value: stats?.open_incidents ?? 0, sub: 'active now', accent: '#f97316', bg: 'rgba(249,115,22,0.1)', icon: '🔓' },
    { label: 'Critical P1', value: stats?.p1_incidents ?? 0, sub: 'need action', accent: '#ef4444', bg: 'rgba(239,68,68,0.12)', pulse: (stats?.p1_incidents ?? 0) > 0, icon: '🔴' },
    { label: 'AI Analyzed', value: stats?.ai_analyzed_count ?? 0, sub: 'total runs', accent: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', icon: '🤖' },
    { label: 'Approvals', value: stats?.pending_approvals ?? 0, sub: 'pending', accent: '#eab308', bg: 'rgba(234,179,8,0.1)', icon: '⏳' },
    { label: 'Avg Accuracy', value: stats?.avg_confidence != null ? `${avgConf}%` : '—', sub: 'AI confidence', accent: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: '🎯' },
  ]

  return (
    <div
      className="flex min-h-screen"
      style={{ background: 'linear-gradient(135deg, #060b14 0%, #0d1b2e 40%, #0a1628 70%, #060b14 100%)' }}
    >
      {/* ── Sidebar ── */}
      <aside
        className="w-60 shrink-0 flex flex-col border-r border-slate-700/30 px-4 py-6"
        style={{ background: 'rgba(6,11,20,0.85)', backdropFilter: 'blur(20px)' }}
      >
        <div className="mb-8 flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl shadow-lg"
            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', boxShadow: '0 0 20px rgba(139,92,246,0.4)' }}
          >
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-black text-white tracking-wide">AI Copilot</p>
            <p className="text-xs text-slate-500">Enterprise Support</p>
          </div>
        </div>

        <nav className="space-y-1 flex-1">
          {[
            { label: 'Dashboard', href: '/', emoji: '⬡' },
            { label: 'Incidents', href: '/incidents', emoji: '⚡' },
            { label: 'Approvals', href: '/approvals', emoji: '✓' },
            { label: 'Audit Log', href: '/audit', emoji: '📋' },
          ].map(({ label, href, emoji }) => {
            const active = window.location.pathname === href
            return (
              <Link
                key={label}
                to={href}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
                style={active
                  ? { background: 'linear-gradient(135deg, rgba(59,130,246,0.25),rgba(139,92,246,0.25))', color: '#e2e8f0', borderLeft: '2px solid #3b82f6' }
                  : { color: '#64748b' }
                }
              >
                <span className="text-base">{emoji}</span>
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="mt-6 rounded-xl border border-slate-700/40 p-3" style={{ background: 'rgba(15,23,42,0.6)' }}>
          <p className="text-xs font-semibold text-slate-300 truncate">{user?.full_name}</p>
          <p className="text-xs text-slate-500 truncate mb-2">{user?.email}</p>
          <button
            onClick={logout}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <header
          className="sticky top-0 z-10 border-b border-slate-700/30 px-6 py-4"
          style={{ background: 'rgba(6,11,20,0.8)', backdropFilter: 'blur(20px)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">Operations Dashboard</h1>
              <p className="text-sm text-slate-400">Real-time incident intelligence</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 rounded-full border border-green-500/25 bg-green-500/10 px-3 py-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                <span className="text-xs font-medium text-green-400">Live</span>
              </div>
              <span className="text-xs text-slate-600">Refreshes every 30s</span>
            </div>
          </div>
        </header>

        <div className="space-y-5 p-6">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center space-y-3">
                <div
                  className="mx-auto h-10 w-10 animate-spin rounded-full"
                  style={{ border: '3px solid rgba(59,130,246,0.2)', borderTop: '3px solid #3b82f6' }}
                />
                <p className="text-sm text-slate-400">Loading intelligence…</p>
              </div>
            </div>
          ) : (
            <>
              {/* ── Metric cards ── */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                {cards.map(({ label, value, sub, accent, bg, pulse, icon }) => (
                  <TiltCard key={label}>
                    <div
                      className="relative rounded-xl p-4 overflow-hidden cursor-default"
                      style={{ background: bg, border: `1px solid ${accent}28` }}
                    >
                      {pulse && (
                        <div
                          className="absolute inset-0 rounded-xl animate-pulse"
                          style={{ background: `${accent}08` }}
                        />
                      )}
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>{label}</p>
                        <span className="text-base">{icon}</span>
                      </div>
                      <p className="text-3xl font-black text-white leading-none">
                        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{sub}</p>
                      {/* Decorative orb */}
                      <div
                        className="absolute -bottom-4 -right-4 h-16 w-16 rounded-full opacity-15"
                        style={{ background: accent, filter: 'blur(12px)' }}
                      />
                    </div>
                  </TiltCard>
                ))}
              </div>

              {/* ── AI Health + Bar chart ── */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {/* AI confidence gauge */}
                <TiltCard>
                  <div
                    className="rounded-xl p-5 h-full"
                    style={{ background: 'rgba(13,27,46,0.9)', border: '1px solid rgba(139,92,246,0.2)', backdropFilter: 'blur(12px)' }}
                  >
                    <h2 className="text-sm font-bold text-white">AI Engine Health</h2>
                    <p className="mb-4 text-xs text-slate-500">Average confidence score</p>
                    <div className="flex justify-center">
                      <CircularGauge value={avgConf} label="Confidence" color={gaugeColor} />
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      {[
                        { l: 'Analyzed', v: stats?.ai_analyzed_count ?? 0 },
                        { l: 'Pending', v: stats?.pending_approvals ?? 0 },
                        { l: 'P1 Active', v: stats?.p1_incidents ?? 0 },
                      ].map(({ l, v }) => (
                        <div key={l} className="rounded-lg p-2" style={{ background: 'rgba(6,11,20,0.6)' }}>
                          <p className="text-lg font-black text-white">{v}</p>
                          <p className="text-xs text-slate-600">{l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </TiltCard>

                {/* Incidents by application bar chart */}
                <div
                  className="col-span-2 rounded-xl p-5"
                  style={{ background: 'rgba(13,27,46,0.9)', border: '1px solid rgba(59,130,246,0.15)', backdropFilter: 'blur(12px)' }}
                >
                  <h2 className="text-sm font-bold text-white">Incidents by Application</h2>
                  <p className="mb-4 text-xs text-slate-500">Total count per service</p>
                  <ResponsiveContainer width="100%" height={188}>
                    <BarChart data={byApp} margin={{ top: 0, right: 0, left: -22, bottom: 0 }}>
                      <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.8} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                      <Bar dataKey="count" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ── Activity area chart ── */}
              <div
                className="rounded-xl p-5"
                style={{ background: 'rgba(13,27,46,0.9)', border: '1px solid rgba(59,130,246,0.1)', backdropFilter: 'blur(12px)' }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white">Investigation Activity</h2>
                    <p className="text-xs text-slate-500">Incidents over the last 7 days</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-6 rounded-full" style={{ background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)' }} />
                    <span className="text-xs text-slate-500">Daily incidents</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={last7} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false} tickLine={false}
                      tickFormatter={(v: string) => v.slice(5)}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone" dataKey="count"
                      stroke="#3b82f6" strokeWidth={2.5}
                      fill="url(#areaGrad)"
                      dot={{ fill: '#3b82f6', r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 7, fill: '#60a5fa', stroke: '#1d4ed8', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* ── Service health + severity + approvals ── */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {/* Service health grid */}
                <div
                  className="rounded-xl p-5"
                  style={{ background: 'rgba(13,27,46,0.9)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}
                >
                  <h2 className="text-sm font-bold text-white mb-1">Service Health</h2>
                  <p className="text-xs text-slate-500 mb-4">Derived from active incident count</p>
                  <ServiceHealthGrid incidentsByApp={stats?.incidents_by_application ?? {}} />
                </div>

                {/* Severity donut */}
                <div
                  className="rounded-xl p-5"
                  style={{ background: 'rgba(13,27,46,0.9)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}
                >
                  <h2 className="text-sm font-bold text-white mb-1">Severity Split</h2>
                  <p className="text-xs text-slate-500 mb-3">Distribution by priority level</p>
                  <div className="flex items-center gap-3">
                    <ResponsiveContainer width={110} height={110}>
                      <PieChart>
                        <Pie data={bySev} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={52} paddingAngle={3}>
                          {bySev.map(entry => (
                            <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] ?? '#94a3b8'} stroke="transparent" />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {bySev.map(({ name, value }) => (
                        <div key={name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full" style={{ background: SEVERITY_COLORS[name] ?? '#94a3b8' }} />
                            <span className="text-xs text-slate-400">{name}</span>
                          </div>
                          <span className="text-xs font-bold text-white">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Pending approvals CTA */}
                <TiltCard>
                  <div
                    className="rounded-xl p-5 h-full flex flex-col justify-between"
                    style={{
                      background: (stats?.pending_approvals ?? 0) > 0 ? 'rgba(234,179,8,0.1)' : 'rgba(13,27,46,0.9)',
                      border: `1px solid ${(stats?.pending_approvals ?? 0) > 0 ? 'rgba(234,179,8,0.3)' : 'rgba(255,255,255,0.06)'}`,
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    {(stats?.pending_approvals ?? 0) === 0 ? (
                      <>
                        <div>
                          <h2 className="text-sm font-bold text-white mb-1">Pending Approvals</h2>
                          <p className="text-xs text-slate-500">Human-in-the-loop review</p>
                        </div>
                        <div className="flex items-center gap-3 mt-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20">
                            <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">Queue clear</p>
                            <p className="text-xs text-slate-400">No pending approvals</p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <h2 className="text-sm font-bold text-amber-400 mb-1">Pending Approvals</h2>
                          <p className="text-xs text-amber-500/70">High-risk AI recommendations</p>
                        </div>
                        <div className="mt-4">
                          <p className="text-5xl font-black text-white">
                            <AnimatedNumber value={stats?.pending_approvals ?? 0} />
                          </p>
                          <p className="text-xs text-amber-400/80 mb-4">awaiting human review</p>
                          <Link
                            to="/approvals"
                            className="inline-block rounded-xl px-4 py-2 text-xs font-bold text-white transition-all hover:opacity-90 hover:scale-105"
                            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 4px 15px rgba(245,158,11,0.3)' }}
                          >
                            Review Now →
                          </Link>
                        </div>
                      </>
                    )}
                  </div>
                </TiltCard>
              </div>

              {/* ── Recent incidents ── */}
              <div
                className="rounded-xl overflow-hidden"
                style={{ background: 'rgba(13,27,46,0.9)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}
              >
                <div className="flex items-center justify-between border-b border-slate-700/40 px-5 py-4">
                  <div>
                    <h2 className="text-sm font-bold text-white">Recent Incidents</h2>
                    <p className="text-xs text-slate-500">Latest activity across all applications</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                    </span>
                    <span className="text-xs text-slate-500">Live feed</span>
                  </div>
                </div>
                <div className="divide-y divide-slate-700/30">
                  {(stats?.recent_incidents ?? []).map((inc: Incident, idx: number) => (
                    <Link
                      key={inc.id}
                      to={`/incidents/${inc.incident_id}`}
                      className="flex items-center justify-between px-5 py-3.5 transition-all hover:bg-slate-700/20 group"
                      style={{ animationDelay: `${idx * 80}ms` }}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-mono text-xs font-bold text-blue-400 group-hover:text-blue-300 transition-colors">{inc.incident_id}</p>
                            <span className="text-slate-600">·</span>
                            <p className="text-xs text-slate-500">{inc.application}</p>
                            <span className="text-slate-600">·</span>
                            <p className="text-xs text-slate-600">{inc.environment}</p>
                          </div>
                          <p className="mt-0.5 text-sm text-slate-200 group-hover:text-white truncate max-w-lg transition-colors">{inc.title}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <SeverityBadge severity={inc.severity} />
                        <span className="text-xs text-slate-600 hidden md:block">
                          {new Date(inc.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="border-t border-slate-700/40 px-5 py-3">
                  <Link to="/incidents" className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors">
                    View all incidents →
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
