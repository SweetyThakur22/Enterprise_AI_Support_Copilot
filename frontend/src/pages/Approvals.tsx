import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { approvalsApi } from '@/services/api'
import { useAuth } from '@/hooks/useAuth'
import type { ApprovalRequest } from '@/types'

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

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-50 text-amber-700',
    APPROVED: 'bg-green-50 text-green-700',
    REJECTED: 'bg-red-50 text-red-700',
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-slate-50 text-slate-600'}`}>
      {status}
    </span>
  )
}

type DialogState = { id: number; action: 'approve' | 'reject'; text: string } | null

export default function Approvals() {
  const { logout, user } = useAuth()
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<DialogState>(null)
  const [comment, setComment] = useState('')
  const [formError, setFormError] = useState('')

  const { data: approvals, isLoading } = useQuery({
    queryKey: ['approvals'],
    queryFn: () => approvalsApi.list(),
  })

  const approveMut = useMutation({
    mutationFn: ({ id, comment }: { id: number; comment?: string }) =>
      approvalsApi.approve(id, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      setDialog(null)
      setComment('')
      setFormError('')
    },
  })

  const rejectMut = useMutation({
    mutationFn: ({ id, comment }: { id: number; comment: string }) =>
      approvalsApi.reject(id, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      setDialog(null)
      setComment('')
      setFormError('')
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail ?? 'Failed to reject')
    },
  })

  function handleConfirm() {
    if (!dialog) return
    if (dialog.action === 'approve') {
      approveMut.mutate({ id: dialog.id, comment: comment || undefined })
    } else {
      if (!comment.trim()) {
        setFormError('A comment is required when rejecting.')
        return
      }
      rejectMut.mutate({ id: dialog.id, comment })
    }
  }

  const pending = approvals?.filter(a => a.status === 'PENDING') ?? []
  const resolved = approvals?.filter(a => a.status !== 'PENDING') ?? []

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
            <Link key={label} to={href} className={`flex items-center rounded-lg px-3 py-2 text-sm ${href === '/approvals' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
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
          <h1 className="text-lg font-semibold text-slate-900">Approvals</h1>
          <p className="text-sm text-slate-500">{pending.length} pending</p>
        </header>

        <div className="mx-auto max-w-4xl space-y-6 p-6">
          {/* Pending */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Pending Approvals</h2>
            </div>
            {isLoading ? (
              <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
            ) : pending.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">No pending approvals</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pending.map((ap: ApprovalRequest) => (
                  <div key={ap.id} className="p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <RiskBadge level={ap.risk_level} />
                      <StatusChip status={ap.status} />
                      <span className="text-xs text-slate-400">#{ap.id} · {new Date(ap.requested_at).toLocaleString()}</span>
                    </div>
                    <p className="mb-3 text-sm text-slate-800">{ap.recommendation_text}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setDialog({ id: ap.id, action: 'approve', text: ap.recommendation_text }); setComment(''); setFormError('') }}
                        className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => { setDialog({ id: ap.id, action: 'reject', text: ap.recommendation_text }); setComment(''); setFormError('') }}
                        className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resolved */}
          {resolved.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-sm font-semibold text-slate-900">Resolved Approvals</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {resolved.map((ap: ApprovalRequest) => (
                  <div key={ap.id} className="p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <RiskBadge level={ap.risk_level} />
                      <StatusChip status={ap.status} />
                      <span className="text-xs text-slate-400">#{ap.id} · {ap.reviewed_at ? new Date(ap.reviewed_at).toLocaleString() : ''}</span>
                    </div>
                    <p className="text-sm text-slate-700">{ap.recommendation_text}</p>
                    {ap.review_comment && (
                      <p className="mt-1 text-xs text-slate-500">Comment: {ap.review_comment}</p>
                    )}
                    {ap.simulated_result && (
                      <p className="mt-1 rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">{ap.simulated_result}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation dialog */}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-base font-semibold text-slate-900">
              {dialog.action === 'approve' ? 'Approve Recommendation' : 'Reject Recommendation'}
            </h3>
            <p className="mb-4 text-sm text-slate-600">{dialog.text}</p>
            {dialog.action === 'approve' && (
              <p className="mb-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-700">
                This will simulate the action in a sandbox environment.
              </p>
            )}
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Comment {dialog.action === 'reject' ? '(required)' : '(optional)'}
              </label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder={dialog.action === 'reject' ? 'Reason for rejection…' : 'Optional comment…'}
              />
            </div>
            {formError && <p className="mb-3 text-xs text-red-600">{formError}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setDialog(null); setComment(''); setFormError('') }}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={approveMut.isPending || rejectMut.isPending}
                className={`rounded px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${dialog.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {approveMut.isPending || rejectMut.isPending ? 'Processing…' : dialog.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
