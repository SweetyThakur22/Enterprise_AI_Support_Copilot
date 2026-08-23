import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { analysisApi, incidentsApi } from '@/services/api'
import type { AnalysisResult } from '@/types'

export type AnalysisStep =
  | 'idle'
  | 'classifying'
  | 'parsing_logs'
  | 'retrieving_knowledge'
  | 'searching_history'
  | 'analyzing'
  | 'complete'
  | 'failed'

const STEP_ORDER: AnalysisStep[] = [
  'classifying',
  'parsing_logs',
  'retrieving_knowledge',
  'searching_history',
  'analyzing',
  'complete',
]

function statusToStep(status: AnalysisResult['status']): AnalysisStep {
  if (status === 'COMPLETED') return 'complete'
  if (status === 'FAILED') return 'failed'
  if (status === 'PROCESSING') return 'analyzing'
  return 'classifying'
}

export function useAnalysis(incidentId: string) {
  const queryClient = useQueryClient()
  const [isTriggering, setIsTriggering] = useState(false)
  const [currentStep, setCurrentStep] = useState<AnalysisStep>('idle')
  const [stepProgression, setStepProgression] = useState<number>(0)

  const { data: analysis, isLoading } = useQuery<AnalysisResult | null>({
    queryKey: ['analysis', incidentId],
    queryFn: () => incidentsApi.getAnalysis(incidentId),
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return false
      if (data.status === 'COMPLETED' || data.status === 'FAILED') return false
      return 2000
    },
    enabled: !!incidentId,
    retry: false,
  })

  // Simulate step progression while PROCESSING
  const stepIndex = analysis
    ? analysis.status === 'COMPLETED'
      ? STEP_ORDER.length - 1
      : analysis.status === 'PROCESSING'
        ? Math.min(stepProgression, STEP_ORDER.length - 2)
        : 0
    : 0

  const trigger = useCallback(async () => {
    setIsTriggering(true)
    setCurrentStep('classifying')
    setStepProgression(0)
    try {
      await analysisApi.trigger(incidentId)
      queryClient.invalidateQueries({ queryKey: ['analysis', incidentId] })
      // Advance steps visually while waiting
      let step = 0
      const interval = setInterval(() => {
        step = Math.min(step + 1, STEP_ORDER.length - 2)
        setStepProgression(step)
        setCurrentStep(STEP_ORDER[step])
      }, 3000)
      // Stop when analysis completes
      const poll = setInterval(async () => {
        const latest = await incidentsApi.getAnalysis(incidentId)
        if (latest?.status === 'COMPLETED' || latest?.status === 'FAILED') {
          clearInterval(interval)
          clearInterval(poll)
          setCurrentStep(latest.status === 'COMPLETED' ? 'complete' : 'failed')
          queryClient.invalidateQueries({ queryKey: ['analysis', incidentId] })
        }
      }, 2000)
    } catch {
      setCurrentStep('failed')
    } finally {
      setIsTriggering(false)
    }
  }, [incidentId, queryClient])

  const activeStep: AnalysisStep =
    analysis?.status === 'COMPLETED'
      ? 'complete'
      : analysis?.status === 'FAILED'
        ? 'failed'
        : currentStep

  return {
    analysis: analysis ?? null,
    isLoading,
    isTriggering,
    activeStep,
    trigger,
    isRunning:
      isTriggering ||
      (analysis?.status === 'PENDING' || analysis?.status === 'PROCESSING'),
  }
}
