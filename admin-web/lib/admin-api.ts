'use client'

import { getSupabaseBrowser } from './supabase-browser'

async function invoke(functionName: string, body?: object) {
  const supabase = getSupabaseBrowser()
  const result = await supabase.functions.invoke(functionName, {
    body: body ?? {},
  })

  if (result.error) {
    throw result.error
  }

  return result.data as Record<string, unknown>
}

export const adminApi = {
  dashboard: () => invoke('admin-dashboard'),
  usersSearch: (params: { q?: string; limit?: number }) =>
    invoke('admin-users-search', params),
  userDetail: (userId: string) =>
    invoke('admin-user-detail', { user_id: userId }),
  readingsList: (params: { q?: string; limit?: number; divination_system?: string }) =>
    invoke('admin-readings-list', params),
  readingDetail: (threadId: string) =>
    invoke('admin-reading-detail', { thread_id: threadId }),
  incidents: (params?: { q?: string; status?: string; severity?: string; user_id?: string; limit?: number }) =>
    invoke('admin-incidents', params ?? {}),
  updateIncident: (incidentId: string, action: 'resolve' | 'ignore' | 'reopen') =>
    invoke('admin-incidents', { incident_id: incidentId, action }),
  adjustCoins: (payload: { user_id: string; amount: number; reason: string; note?: string }) =>
    invoke('admin-coins-adjust', payload),
  rerunFirstImpression: (userId: string) =>
    invoke('admin-first-impression-rerun', { user_id: userId }),
  importRuns: () => invoke('admin-import-runs'),
  qimenFeedback: (threadId: string) =>
    invoke('admin-qimen-feedback', { thread_id: threadId, action: 'get' }),
  qimenFeedbackStats: () =>
    invoke('admin-qimen-feedback', { action: 'stats' }),
  qimenTeacherRoutingReport: () =>
    invoke('admin-qimen-feedback', { action: 'routing_report' }),
  saveQimenFeedback: (payload: {
    thread_id: string
    verdict: string
    teacher_conclusion?: string
    user_feedback?: string
    failed_step?: string
    failed_support_id?: string
    failure_summary?: string
    failure_tags?: string[] | string
    operator_notes?: string
    system_profile?: string
    question_type?: string
  }) => invoke('admin-qimen-feedback', { ...payload, action: 'save' }),
  firstImpressionDebug: (userId: string) =>
    invoke('first-impression-debug', { user_id: userId }),
}
