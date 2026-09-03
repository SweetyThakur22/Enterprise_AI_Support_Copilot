import { useRef, useState, useCallback, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
  AreaChart, Area, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  LayoutDashboard, AlertTriangle, CheckSquare, ScrollText,
  Sparkles, Plus, TrendingUp, ShieldAlert, Clock, Brain,
  ChevronRight, Activity,
} from 'lucide-react'
import { incidentsApi } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import type { Incident } from '@/types'

// ── Palette ───────────────────────────────────────────────────────────────────

const P = {
  bg:      '#0d0f1a',
  sidebar: '#111320',
  card:    'rgba(17,19,32,0.92)',
  border:  'rgba(99,102,241,0.12)',
  indigo:  '#6366f1',
  sky:     '#0ea5e9',
  emerald: '#10b981',
  amber:   '#f59e0b',
  rose:    '#f43f5e',
  muted:   '#4b5563',
  dimText: '#64748b',
}

const SEV_COLORS: Record<string, string> = {
  P1: P.rose, P2: P.amber, P3: '#facc15', P4: P.sky,
}

const APPS = ['Billing Platform','Customer Management','Payment Processing','Meter Data Platform','Notification Service','API Gateway']

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ── 3D tilt card ──────────────────────────────────────────────────────────────

function TiltCard({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState<React.CSSProperties>({})

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el) return
    const { left, top, width, height } = el.getBoundingClientRect()
    const x = (e.clientX - left) / width - 0.5
    const y = (e.clientY - top) / height - 0.5
    setTilt({ transform: `perspective(900px) rotateX(${-y * 8}deg) rotateY(${x * 8}deg) scale3d(1.02,1.02,1.02)`, transition: 'transform 0.08s ease-out' })
  }, [])

  const onLeave = useCallback(() => {
    setTilt({ transform: 'perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)', transition: 'transform 0.5s ease-out' })
  }, [])

  return (
    <div ref={ref} style={{ ...tilt, ...style }} onMouseMove={onMove} onMouseLeave={onLeave} className={className}>
      {children}
    </div>
  )
}

// ── Animated count-up ─────────────────────────────────────────────────────────

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (value === 0) { setDisplay(0); return }
    let n = 0
    const step = Math.max(1, Math.ceil(value / 40))
    const t = setInterval(() => { n = Math.min(n + step, value); setDisplay(n); if (n >= value) clearInterval(t) }, 20)
    return () => clearInterval(t)
  }, [value])
  return <>{display}</>
}

// ── Circular gauge ────────────────────────────────────────────────────────────

function CircularGauge({ value, color }: { value: number; color: string }) {
  const r = 48, circ = 2 * Math.PI * r, filled = ((value || 0) / 100) * circ
  return (
    <svg width={120} height={120} viewBox="0 0 120 120" role="img" aria-label={`AI confidence: ${value}%`}>
      <defs>
        <filter id="cglow">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dasharray 1.3s cubic-bezier(0.4,0,0.2,1)' }}
        filter="url(#cglow)"
      />
      <text x="60" y="55" textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="20" fontWeight="900">{value || 0}%</text>
      <text x="60" y="73" textAnchor="middle" fill="#64748b" fontSize="10">confidence</text>
    </svg>
  )
}

// ── Service health grid ───────────────────────────────────────────────────────

function ServiceHealthGrid({ byApp }: { byApp: Record<string, number> }) {
  const max = Math.max(...Object.values(byApp), 1)
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {APPS.map(app => {
        const n = byApp[app] ?? 0
        const ratio = n / max
        const s = n === 0 ? 'ok' : ratio < 0.45 ? 'degraded' : 'critical'
        const cfg = {
          ok:       { dot: 'bg-emerald-400',        text: P.emerald, bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.18)' },
          degraded: { dot: 'bg-amber-400',           text: P.amber,   bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.2)' },
          critical: { dot: 'bg-rose-400 animate-pulse', text: P.rose, bg: 'rgba(244,63,94,0.07)', border: 'rgba(244,63,94,0.2)' },
        }[s]
        return (
          <div key={app} className="rounded-xl p-3" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-slate-300 truncate" title={app}>{app.split(' ')[0]}</p>
              <div className={`h-2 w-2 rounded-full ${cfg.dot}`} />
            </div>
            <p className="text-xl font-black" style={{ color: cfg.text }}>{n}</p>
            <p className="text-xs capitalize mt-0.5" style={{ color: cfg.text, opacity: 0.65 }}>{s === 'ok' ? 'healthy' : s}</p>
          </div>
        )
      })}
    </div>
  )
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function ChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/95 px-3 py-2 shadow-2xl backdrop-blur">
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-bold text-white">{payload[0].value}</p>
    </div>
  )
}

// ── Severity chip ─────────────────────────────────────────────────────────────

function SevChip({ s }: { s: string }) {
  const color = SEV_COLORS[s] ?? '#94a3b8'
  return (
    <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold" style={{ color, borderColor: `${color}40`, background: `${color}18` }}>
      {s}
    </span>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { logout, user } = useAuth()
  const location = useLocation()

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
  const gaugeColor = avgConf >= 75 ? P.emerald : avgConf >= 50 ? P.amber : P.rose

  const navItems = [
    { label: 'Dashboard', href: '/',         Icon: LayoutDashboard },
    { label: 'Incidents', href: '/incidents', Icon: AlertTriangle    },
    { label: 'Approvals', href: '/approvals', Icon: CheckSquare      },
    { label: 'Audit Log', href: '/audit',     Icon: ScrollText       },
  ]

  const insightCards = [
    {
      label: 'Open Incidents',
      value: stats?.open_incidents ?? 0,
      sub: 'need attention',
      Icon: AlertTriangle,
      accent: P.rose,
      bg: `${P.rose}12`,
      pulse: (stats?.open_incidents ?? 0) > 0,
    },
    {
      label: 'Critical P1',
      value: stats?.p1_incidents ?? 0,
      sub: 'highest priority',
      Icon: ShieldAlert,
      accent: P.amber,
      bg: `${P.amber}12`,
      pulse: (stats?.p1_incidents ?? 0) > 0,
    },
    {
      label: 'AI Analyses',
      value: stats?.ai_analyzed_count ?? 0,
      sub: 'investigations run',
      Icon: Brain,
      accent: P.indigo,
      bg: `${P.indigo}12`,
    },
    {
      label: 'Pending Approvals',
      value: stats?.pending_approvals ?? 0,
      sub: 'awaiting review',
      Icon: Clock,
      accent: P.sky,
      bg: `${P.sky}12`,
    },
  ]

  const recentIncidents: Incident[] = stats?.recent_incidents ?? []

  return (
    <div className="flex min-h-screen" style={{ background: P.bg }}>

      {/* ── Sidebar ── */}
      <aside
        className="w-72 shrink-0 flex flex-col border-r"
        style={{ background: P.sidebar, borderColor: 'rgba(99,102,241,0.1)' }}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 0 20px rgba(99,102,241,0.4)' }}
          >
            <Brain className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">AI Copilot</p>
            <p className="text-xs text-slate-500 mt-0.5">Enterprise Support</p>
          </div>
        </div>

        {/* New investigation CTA */}
        <div className="px-4 pt-4">
          <Link
            to="/incidents"
            className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}
            aria-label="Start new incident investigation"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Investigation
          </Link>
        </div>

        {/* Nav */}
        <nav className="mt-5 px-3 space-y-0.5" aria-label="Page navigation">
          <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: P.muted }}>Navigate</p>
          {navItems.map(({ label, href, Icon }) => {
            const active = location.pathname === href
            return (
              <Link
                key={label}
                to={href}
                aria-current={active ? 'page' : undefined}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                style={active
                  ? { background: 'rgba(99,102,241,0.15)', color: '#c7d2fe', borderLeft: `2px solid ${P.indigo}` }
                  : { color: P.dimText }}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {label}
                {active && <ChevronRight className="h-3 w-3 ml-auto opacity-50" aria-hidden="true" />}
              </Link>
            )
          })}
        </nav>

        {/* Recent investigations */}
        {recentIncidents.length > 0 && (
          <div className="mt-5 px-3 flex-1 overflow-hidden">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: P.muted }}>Recent</p>
            <div className="space-y-1">
              {recentIncidents.slice(0, 4).map((inc) => (
                <Link
                  key={inc.id}
                  to={`/incidents/${inc.incident_id}`}
                  className="group flex items-start gap-2.5 rounded-xl px-3 py-2 text-xs transition-all duration-150 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                  aria-label={`Incident ${inc.incident_id}: ${inc.title}`}
                >
                  <div
                    className="mt-0.5 h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ background: SEV_COLORS[inc.severity] ?? '#94a3b8', boxShadow: `0 0 4px ${SEV_COLORS[inc.severity] ?? '#94a3b8'}` }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-slate-400 group-hover:text-indigo-300 transition-colors">{inc.incident_id}</p>
                    <p className="mt-0.5 text-slate-600 group-hover:text-slate-400 transition-colors truncate">{inc.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* User card */}
        <div className="mt-auto mx-4 mb-4 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #0ea5e9)' }}
              aria-hidden="true"
            >
              {(user?.full_name?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-300 truncate">{user?.full_name}</p>
              <p className="text-xs text-slate-600 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-2 text-xs text-slate-600 hover:text-rose-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 rounded"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto" role="main">

        {/* Greeting header */}
        <header
          className="sticky top-0 z-10 border-b px-7 py-4"
          style={{ background: `${P.bg}cc`, backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.05)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-white">
                {timeGreeting()}{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}.
              </h1>
              <p className="text-sm" style={{ color: P.dimText }}>Here's your operational snapshot.</p>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-2 rounded-full px-3 py-1.5"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
                role="status"
                aria-label="Live data, refreshes every 30 seconds"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" aria-hidden="true" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                </span>
                <span className="text-xs font-medium" style={{ color: P.emerald }}>Live · 30s</span>
              </div>
            </div>
          </div>
        </header>

        <div className="space-y-5 p-6">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center" role="status" aria-label="Loading dashboard">
              <div className="text-center space-y-3">
                <div className="mx-auto h-9 w-9 animate-spin rounded-full" style={{ border: `3px solid ${P.indigo}30`, borderTop: `3px solid ${P.indigo}` }} aria-hidden="true" />
                <p className="text-sm" style={{ color: P.dimText }}>Loading your workspace…</p>
              </div>
            </div>
          ) : (
            <>
              {/* ── Ask the Copilot bar ── */}
              <Link
                to="/incidents"
                className="group flex items-center gap-4 w-full rounded-2xl px-5 py-4 text-left transition-all duration-200 hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                style={{ background: 'rgba(99,102,241,0.08)', border: `1px solid ${P.indigo}30` }}
                aria-label="Navigate to incidents to start a new investigation"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0" style={{ background: `${P.indigo}20`, border: `1px solid ${P.indigo}30` }}>
                  <Sparkles className="h-4 w-4" style={{ color: P.indigo }} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: '#a5b4fc' }}>What would you like to investigate today?</p>
                  <p className="text-xs mt-0.5" style={{ color: P.muted }}>Select an incident to trigger the AI analysis pipeline →</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 opacity-30 group-hover:opacity-70 transition-opacity" style={{ color: P.indigo }} aria-hidden="true" />
              </Link>

              {/* ── 4 insight cards ── */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {insightCards.map(({ label, value, sub, Icon, accent, bg, pulse }) => (
                  <TiltCard key={label}>
                    <div
                      className="relative rounded-2xl p-5 overflow-hidden cursor-default"
                      style={{ background: bg, border: `1px solid ${accent}25` }}
                      role="region"
                      aria-label={`${label}: ${value}`}
                    >
                      {pulse && <div className="absolute inset-0 rounded-2xl animate-pulse" style={{ background: `${accent}06` }} aria-hidden="true" />}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${accent}18`, border: `1px solid ${accent}25` }}>
                          <Icon className="h-4 w-4" style={{ color: accent }} aria-hidden="true" />
                        </div>
                      </div>
                      <p className="text-3xl font-black text-white leading-none">
                        <AnimatedNumber value={value} />
                      </p>
                      <p className="mt-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>{label}</p>
                      <p className="text-xs mt-0.5" style={{ color: P.muted }}>{sub}</p>
                      <div className="absolute -bottom-5 -right-5 h-20 w-20 rounded-full opacity-10" style={{ background: accent, filter: 'blur(14px)' }} aria-hidden="true" />
                    </div>
                  </TiltCard>
                ))}
              </div>

              {/* ── AI gauge + Bar chart ── */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {/* Gauge */}
                <TiltCard style={{ height: '100%' }}>
                  <div
                    className="rounded-2xl p-5 h-full"
                    style={{ background: P.card, border: `1px solid ${P.indigo}18`, backdropFilter: 'blur(12px)' }}
                    role="region"
                    aria-label="AI confidence score gauge"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="h-4 w-4" style={{ color: P.indigo }} aria-hidden="true" />
                      <h2 className="text-sm font-bold text-white">AI Confidence</h2>
                    </div>
                    <p className="text-xs mb-5" style={{ color: P.dimText }}>Average score across completed analyses</p>
                    <div className="flex justify-center">
                      <CircularGauge value={avgConf} color={gaugeColor} />
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                      {[
                        { l: 'Analyses', v: stats?.ai_analyzed_count ?? 0 },
                        { l: 'Pending', v: stats?.pending_approvals ?? 0 },
                        { l: 'P1 Open', v: stats?.p1_incidents ?? 0 },
                      ].map(({ l, v }) => (
                        <div key={l} className="rounded-xl p-2" style={{ background: 'rgba(0,0,0,0.3)' }}>
                          <p className="text-lg font-black text-white">{v}</p>
                          <p className="text-xs" style={{ color: P.muted }}>{l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </TiltCard>

                {/* Bar chart */}
                <div
                  className="col-span-2 rounded-2xl p-5"
                  style={{ background: P.card, border: `1px solid ${P.sky}18`, backdropFilter: 'blur(12px)' }}
                  role="region"
                  aria-label="Incidents by application bar chart"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4" style={{ color: P.sky }} aria-hidden="true" />
                    <h2 className="text-sm font-bold text-white">Incidents by Application</h2>
                  </div>
                  <p className="text-xs mb-4" style={{ color: P.dimText }}>Total incident count per service</p>
                  <ResponsiveContainer width="100%" height={188}>
                    <BarChart data={byApp} margin={{ top: 0, right: 0, left: -22, bottom: 0 }}>
                      <defs>
                        <linearGradient id="bGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={P.indigo} stopOpacity={1} />
                          <stop offset="100%" stopColor={P.sky} stopOpacity={0.8} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: P.dimText }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: P.dimText }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                      <Bar dataKey="count" fill="url(#bGrad)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ── Activity area chart ── */}
              <div
                className="rounded-2xl p-5"
                style={{ background: P.card, border: `1px solid rgba(255,255,255,0.05)`, backdropFilter: 'blur(12px)' }}
                role="region"
                aria-label="Investigation activity over the last 7 days"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white">Investigation Activity</h2>
                    <p className="text-xs mt-0.5" style={{ color: P.dimText }}>Incidents over the last 7 days</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-5 rounded-full" style={{ background: `linear-gradient(90deg,${P.indigo},${P.sky})` }} aria-hidden="true" />
                    <span className="text-xs" style={{ color: P.dimText }}>Daily incidents</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={last7} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
                    <defs>
                      <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={P.indigo} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={P.sky} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: P.dimText }} axisLine={false} tickLine={false} tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: P.dimText }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="count" stroke={P.indigo} strokeWidth={2.5} fill="url(#aGrad)"
                      dot={{ fill: P.indigo, r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: '#a5b4fc', stroke: P.indigo, strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* ── Investigation threads + health/severity ── */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">

                {/* Investigation threads (2/3 width) */}
                <div
                  className="md:col-span-2 rounded-2xl overflow-hidden"
                  style={{ background: P.card, border: `1px solid rgba(255,255,255,0.05)`, backdropFilter: 'blur(12px)' }}
                  role="region"
                  aria-label="Recent incident investigations"
                >
                  <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <div>
                      <h2 className="text-sm font-bold text-white">Recent Investigations</h2>
                      <p className="text-xs mt-0.5" style={{ color: P.dimText }}>Latest incidents across all services</p>
                    </div>
                    <span className="relative flex h-2 w-2" role="status" aria-label="Live feed">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: P.indigo }} aria-hidden="true" />
                      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: P.indigo }} aria-hidden="true" />
                    </span>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    {recentIncidents.map((inc: Incident) => (
                      <Link
                        key={inc.id}
                        to={`/incidents/${inc.incident_id}`}
                        className="group flex items-start gap-4 px-5 py-4 transition-all duration-150 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                        aria-label={`Incident ${inc.incident_id}: ${inc.title}`}
                      >
                        {/* Severity dot */}
                        <div
                          className="mt-1 h-2 w-2 rounded-full shrink-0"
                          style={{ background: SEV_COLORS[inc.severity] ?? '#94a3b8', boxShadow: `0 0 6px ${SEV_COLORS[inc.severity] ?? '#94a3b8'}80` }}
                          aria-hidden="true"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-indigo-400 group-hover:text-indigo-300 transition-colors">{inc.incident_id}</span>
                            <span style={{ color: P.muted }} aria-hidden="true">·</span>
                            <span className="text-xs" style={{ color: P.dimText }}>{inc.application}</span>
                            <span style={{ color: P.muted }} aria-hidden="true">·</span>
                            <span className="text-xs" style={{ color: P.muted }}>{inc.environment}</span>
                          </div>
                          <p className="mt-0.5 text-sm text-slate-300 group-hover:text-white truncate transition-colors">{inc.title}</p>
                          <p className="mt-1 text-xs" style={{ color: P.muted }}>{new Date(inc.created_at).toLocaleString()}</p>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-2">
                          <SevChip s={inc.severity} />
                          <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity" style={{ color: P.indigo }} aria-hidden="true" />
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="border-t px-5 py-3" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <Link to="/incidents" className="text-xs font-semibold transition-colors hover:text-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded" style={{ color: P.indigo }}>
                      Browse all incidents →
                    </Link>
                  </div>
                </div>

                {/* Severity + Service health (1/3 width) */}
                <div className="space-y-4">
                  {/* Donut */}
                  <div
                    className="rounded-2xl p-5"
                    style={{ background: P.card, border: `1px solid rgba(255,255,255,0.05)`, backdropFilter: 'blur(12px)' }}
                    role="region"
                    aria-label="Incidents by severity distribution"
                  >
                    <h2 className="text-sm font-bold text-white mb-1">Severity Split</h2>
                    <p className="text-xs mb-4" style={{ color: P.dimText }}>Incident distribution</p>
                    <div className="flex items-center gap-3">
                      <ResponsiveContainer width={100} height={100}>
                        <PieChart>
                          <Pie data={bySev} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={48} paddingAngle={3}>
                            {bySev.map(entry => (
                              <Cell key={entry.name} fill={SEV_COLORS[entry.name] ?? '#94a3b8'} stroke="transparent" />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-2">
                        {bySev.map(({ name, value }) => (
                          <div key={name} className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div className="h-2 w-2 rounded-full" style={{ background: SEV_COLORS[name] ?? '#94a3b8' }} aria-hidden="true" />
                              <span className="text-xs" style={{ color: P.dimText }}>{name}</span>
                            </div>
                            <span className="text-xs font-bold text-white">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Service health */}
                  <div
                    className="rounded-2xl p-5"
                    style={{ background: P.card, border: `1px solid rgba(255,255,255,0.05)`, backdropFilter: 'blur(12px)' }}
                    role="region"
                    aria-label="Service health status"
                  >
                    <h2 className="text-sm font-bold text-white mb-1">Service Health</h2>
                    <p className="text-xs mb-4" style={{ color: P.dimText }}>Live from incident counts</p>
                    <ServiceHealthGrid byApp={stats?.incidents_by_application ?? {}} />
                  </div>

                  {/* Approvals CTA */}
                  {(stats?.pending_approvals ?? 0) > 0 && (
                    <TiltCard>
                      <div
                        className="rounded-2xl p-4"
                        style={{ background: `${P.amber}10`, border: `1px solid ${P.amber}30` }}
                        role="alert"
                        aria-live="polite"
                      >
                        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: P.amber }}>Approvals needed</p>
                        <p className="text-4xl font-black text-white my-1">
                          <AnimatedNumber value={stats?.pending_approvals ?? 0} />
                        </p>
                        <p className="text-xs mb-3" style={{ color: `${P.amber}99` }}>high-risk recommendations awaiting you</p>
                        <Link
                          to="/approvals"
                          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white transition-all hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                          style={{ background: `linear-gradient(135deg, ${P.amber}, #d97706)`, boxShadow: `0 4px 12px ${P.amber}30` }}
                        >
                          <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
                          Review now →
                        </Link>
                      </div>
                    </TiltCard>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
