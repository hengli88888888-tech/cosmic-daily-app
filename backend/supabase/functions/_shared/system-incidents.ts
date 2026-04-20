type AdminClientLike = {
  from: (table: string) => {
    upsert: (values: Record<string, unknown>, options?: Record<string, unknown>) => Promise<{ error: unknown }>
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: unknown) => Promise<{ error: unknown }>
    }
  }
}

export async function openInternalIncident(
  adminClient: AdminClientLike,
  {
    eventKey,
    incidentType,
    userId,
    severity = 'warning',
    message,
    payload = {},
  }: {
    eventKey: string
    incidentType: string
    userId?: string | null
    severity?: 'info' | 'warning' | 'error'
    message: string
    payload?: Record<string, unknown>
  },
) {
  const now = new Date().toISOString()
  const { error } = await adminClient.from('internal_incidents').upsert(
    {
      event_key: eventKey,
      incident_type: incidentType,
      user_id: userId ?? null,
      severity,
      status: 'open',
      message,
      payload_json: payload,
      updated_at: now,
      resolved_at: null,
    },
    { onConflict: 'event_key' },
  )

  if (error) throw error
}

export async function resolveInternalIncident(
  adminClient: AdminClientLike,
  eventKey: string,
) {
  const now = new Date().toISOString()
  const { error } = await adminClient
    .from('internal_incidents')
    .update({
      status: 'resolved',
      updated_at: now,
      resolved_at: now,
    })
    .eq('event_key', eventKey)

  if (error) throw error
}
