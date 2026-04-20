import { cleanString } from './chart-engine.ts'

type AdminClientLike = {
  from: (table: string) => {
    upsert: (
      values: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => Promise<{ error: unknown }>
  }
}

export async function ensurePublicUserRow(
  adminClient: AdminClientLike,
  user: { id: string; email?: string | null },
) {
  const normalizedEmail = cleanString(user.email)
  const row = normalizedEmail == null
    ? { id: user.id }
    : { id: user.id, email: normalizedEmail }

  const { error } = await adminClient.from('users').upsert(row, {
    onConflict: 'id',
  })
  if (error) throw error
}
