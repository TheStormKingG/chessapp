import type { SupabaseClient } from '@supabase/supabase-js';
import { db, type LearnerEvent } from '@/data';

/** The shape of a row in public.events (see the Phase 0 migration). */
interface Row {
  id: string;
  user_id?: string;
  type: string;
  payload: Record<string, unknown>;
  device_day: string;
  created_at: string;
}

function toRow(e: LearnerEvent, userId: string): Row {
  const { type, ...rest } = e.payload;
  return {
    id: e.id,
    user_id: userId,
    type,
    payload: { ...rest },
    device_day: e.deviceDay,
    created_at: e.createdAt,
  };
}

function fromRow(r: Row): LearnerEvent {
  return {
    id: r.id,
    deviceDay: r.device_day,
    createdAt: r.created_at,
    payload: { type: r.type, ...r.payload } as LearnerEvent['payload'],
    synced: 1,
  };
}

/**
 * F-AC-3: drain the outbox. The server applies events idempotently (the id is
 * the primary key and duplicates are ignored), so a repeat of a batch is safe.
 * Events stay unsynced if the upsert fails, so the next flush retries them.
 */
export async function flush(client: SupabaseClient, userId: string): Promise<number> {
  const pending = await db.events.where('synced').equals(0).sortBy('createdAt');
  let n = 0;
  for (let i = 0; i < pending.length; i += 100) {
    const batch = pending.slice(i, i + 100);
    const { error } = await client
      .from('events')
      .upsert(
        batch.map((e) => toRow(e, userId)),
        { onConflict: 'id', ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
    await db.events.bulkPut(batch.map((e) => ({ ...e, synced: 1 as const })));
    n += batch.length;
  }
  return n;
}

/** Every event the account holds, for the sign-in merge (F-AC-2). */
export async function pullAll(client: SupabaseClient, userId: string): Promise<LearnerEvent[]> {
  const { data, error } = await client
    .from('events')
    .select('id,type,payload,device_day,created_at')
    .eq('user_id', userId)
    .order('created_at');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(fromRow);
}
