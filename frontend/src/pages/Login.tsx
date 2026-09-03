import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, BookOpen, BrainCircuit, CheckCircle2, ClipboardList,
  ChevronDown, FileText,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

// ── Inject keyframe animations once ──────────────────────────────────────────

const CSS = `
@keyframes gradientDrift {
  0%, 100% { background-position: 0% 50%, 0 0; }
  50%       { background-position: 100% 50%, 0 0; }
}
@keyframes loginPanelIn {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
`

// ── Feature list ──────────────────────────────────────────────────────────────

const FEATURES = [
  { Icon: Search,        text: 'Automated log parsing & timeline reconstruction' },
  { Icon: BookOpen,      text: 'RAG retrieval from your knowledge base' },
  { Icon: BrainCircuit,  text: 'AI root cause analysis with grounded evidence' },
  { Icon: CheckCircle2,  text: 'Approval workflow for risky remediations' },
  { Icon: ClipboardList, text: 'Full audit trail for compliance' },
]

// ── FAQ items ─────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'What is this app?',
    a: 'Enterprise AI Support Copilot is an AI-powered incident investigation platform. It analyzes production incidents by parsing logs, retrieving knowledge-base documentation, and using a large language model to produce a structured root cause analysis — complete with evidence, recommendations, and a confidence score.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. All API endpoints are protected by JWT authentication and role-based access control. Log content is treated as data (never as instructions), secrets are masked in all logs, and every action is recorded in an immutable audit trail. The platform is deployed on Railway (backend) and Vercel (frontend) with HTTPS enforced.',
  },
  {
    q: 'What AI model powers this?',
    a: 'The platform is provider-agnostic. By default it uses Groq (free tier, OpenAI-compatible API) or Anthropic\'s Claude claude-sonnet-4-6. Switching providers is a single environment variable change — no code modifications needed.',
  },
  {
    q: 'How do I get access?',
    a: 'Access is provisioned by an Admin user. Contact your platform team to request an account. Each user is assigned a role (Viewer, Support Engineer, Incident Manager, or Admin) which controls what they can see and do.',
  },
  {
    q: 'Can I use this with my own data?',
    a: 'Yes. The knowledge base is seeded with example documents, but you can add your own runbooks and troubleshooting guides. Incidents and log files are ingested from your PostgreSQL database. The embedding model runs locally — no log data is sent to external services for RAG.',
  },
]

// ── FAQ accordion item ────────────────────────────────────────────────────────

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center justify-between py-3 text-left text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 rounded"
      >
        <span>{q}</span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-hidden="true"
        />
      </button>
      <div
        style={{
          maxHeight: open ? '200px' : '0',
          overflow: 'hidden',
          transition: 'max-height 0.25s ease',
        }}
      >
        <p className="pb-4 text-sm text-slate-500 leading-relaxed">{a}</p>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Login() {
  const { login, isLoading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  // Inject animation CSS
  useEffect(() => {
    const el = document.createElement('style')
    el.textContent = CSS
    document.head.appendChild(el)
    return () => { document.head.removeChild(el) }
  }, [])

  // Staggered entrance animation
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40)
    return () => clearTimeout(t)
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Invalid email or password'
      setError(msg)
    }
  }

  const panelBase: React.CSSProperties = {
    transition: 'opacity 0.55s ease, transform 0.55s ease',
  }

  return (
    <div className="flex min-h-screen">

      {/* ── Left panel — animated gradient mesh ── */}
      <div
        className="hidden lg:flex w-[480px] shrink-0 flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background: `
            radial-gradient(circle at 1px 1px, rgba(99,102,241,0.13) 1px, transparent 1px),
            linear-gradient(-45deg, #0f172a 0%, #1e1b4b 30%, #0c1445 60%, #1e1b4b 80%, #0f172a 100%)
          `,
          backgroundSize: '28px 28px, 400% 400%',
          animation: 'gradientDrift 16s ease infinite',
          ...panelBase,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(20px)',
        }}
      >
        {/* Radial accent glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.18) 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(67,56,202,0.12) 0%, transparent 50%)',
          }}
          aria-hidden="true"
        />

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 0 24px rgba(99,102,241,0.45)' }}
            >
              <BrainCircuit className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold text-white tracking-wide">AI Support Copilot</p>
              <p className="text-xs text-slate-500">Enterprise Edition</p>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-3xl font-extrabold leading-tight text-white tracking-tight">
            Enterprise-grade AI<br />for production incidents
          </h1>
          <p className="mt-4 text-sm text-slate-400 leading-relaxed max-w-xs">
            Investigate incidents faster with AI-powered root cause analysis, RAG-backed knowledge retrieval, and human-in-the-loop approvals.
          </p>

          {/* Feature list */}
          <ul className="mt-10 space-y-3" role="list">
            {FEATURES.map(({ Icon, text }) => (
              <li
                key={text}
                className="group flex items-start gap-3 cursor-default"
              >
                <div
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-all duration-200 group-hover:scale-110"
                  style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}
                >
                  <Icon className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
                </div>
                <span className="text-sm text-slate-400 transition-colors duration-200 group-hover:text-slate-200 group-hover:translate-x-0.5 inline-block transform">
                  {text}
                </span>
              </li>
            ))}
          </ul>

          {/* Project details link */}
          <a
            href="/project-details.html"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-indigo-300 transition-all duration-200 hover:text-white hover:bg-indigo-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
            style={{ border: '1px solid rgba(99,102,241,0.25)' }}
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            View Project Overview ↗
          </a>
        </div>

        <p className="relative z-10 text-xs text-slate-700">
          Enterprise AI Support Copilot · v0.1.0
        </p>
      </div>

      {/* ── Right panel — sign-in form ── */}
      <div
        className="flex flex-1 flex-col items-center justify-start bg-white px-6 py-12 overflow-y-auto"
        style={{
          ...panelBase,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(20px)',
          transitionDelay: '130ms',
        }}
      >
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
            >
              <BrainCircuit className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <span className="font-semibold text-slate-900">AI Support Copilot</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Enter your credentials to access the platform</p>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                boxShadow: isLoading ? 'none' : '0 4px 14px rgba(99,102,241,0.35)',
              }}
            >
              {isLoading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* FAQ accordion */}
          <div className="mt-10">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Frequently asked questions
            </p>
            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 px-4">
              {FAQS.map((item, i) => (
                <FaqItem
                  key={i}
                  q={item.q}
                  a={item.a}
                  open={openFaq === i}
                  onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                />
              ))}
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-slate-400">
            Need access?{' '}
            <span className="text-indigo-600 font-medium">Contact your platform administrator</span>
          </p>
        </div>
      </div>
    </div>
  )
}
