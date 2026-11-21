import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { MongoClient, type Db } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { emptyExistingMortgageTrack } from '@/features/refinance/existingMortgage'

const database = vi.hoisted(() => ({ db: null as Db | null }))
vi.mock('@/server/auth/mongo', () => ({ getDb: async () => database.db! }))
import { createSavedRefinance, deleteSavedRefinance, listSavedRefinances,
  updateSavedRefinance } from '@/server/refinances/repo'

let mongo: MongoMemoryServer
let client: MongoClient
beforeAll(async () => {
  mongo = await MongoMemoryServer.create()
  client = await new MongoClient(mongo.getUri()).connect()
  database.db = client.db('refinance-test')
})
afterAll(async () => { await client?.close(); await mongo?.stop() })

const input = { label: 'Proposal', snapshot: { version: 1 as const,
  existingTracks: [emptyExistingMortgageTrack('one')],
  proposedTracks: [{ type: 'fixed' as const, sharePercent: 100, annualRatePercent: 4,
    termYears: 20, method: 'spitzer' as const, resetMonths: 0 }],
  feeAmount: 2000, feeMode: 'cash' as const } }

describe('saved refinance ownership and limits', () => {
  it('round-trips inputs and prevents another owner reading, updating or deleting them', async () => {
    const saved = await createSavedRefinance('alice', input)
    expect(saved.ok).toBe(true)
    if (!saved.ok) throw new Error('Save failed')
    const id = saved.refinance.id
    expect((await listSavedRefinances('alice'))[0].snapshot).toEqual(input.snapshot)
    expect(await listSavedRefinances('bob')).toEqual([])
    expect(await updateSavedRefinance('bob', id, input)).toEqual({ ok: false, reason: 'not_found' })
    expect(await deleteSavedRefinance('bob', id)).toBe(false)
    expect(await deleteSavedRefinance('alice', id)).toBe(true)
  })
  it('refuses a fifth save, allows updating at the cap, and frees a deleted slot', async () => {
    for (let i = 0; i < 4; i++) {
      expect((await createSavedRefinance('cap-owner', { ...input, label: `Proposal ${i}` })).ok).toBe(true)
    }
    expect(await createSavedRefinance('cap-owner', input)).toEqual({ ok: false, reason: 'cap' })
    const first = (await listSavedRefinances('cap-owner'))[0]
    expect((await updateSavedRefinance('cap-owner', first.id, input)).ok).toBe(true)
    expect(await deleteSavedRefinance('cap-owner', first.id)).toBe(true)
    expect((await createSavedRefinance('cap-owner', input)).ok).toBe(true)
  })
  it('rejects duplicate labels for the same owner and permits them for another owner', async () => {
    expect((await createSavedRefinance('names', input)).ok).toBe(true)
    expect(await createSavedRefinance('names', { ...input, label: ' proposal ' })).toEqual({ ok: false, reason: 'duplicate' })
    expect((await createSavedRefinance('other-names', input)).ok).toBe(true)
  })
})
