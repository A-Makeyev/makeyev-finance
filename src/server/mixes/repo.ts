import { ObjectId, type WithId } from 'mongodb'
import { getDb } from '../auth/mongo'
import { normalizeMixLabel } from './label'
import {
  MAX_SAVED_MIXES,
  type SavedMixInput,
  type SavedMixScenario,
  type SavedTrack,
} from './schema'

/**
 * Mongo access for saved mortgage mixes. Every function takes the caller's
 * user id and scopes its query by it, so a guessed or incremented document id
 * can never reach another user's mix (AGENTS.md security rules).
 *
 * `userId` is the Better Auth user id stored as the string the session
 * reports. Better Auth's Mongo adapter does not use ObjectId for its own ids
 * (checked against the installed adapter), so storing the string verbatim is
 * both correct and immune to an ObjectId conversion throwing on an id shape we
 * do not control.
 */

const COLLECTION = 'saved_mixes'

export interface SavedMixDoc {
  userId: string
  label: string
  tracks: SavedTrack[]
  termYears: number
  /** Null for a mix saved before the scenario was stored. */
  scenario: SavedMixScenario | null
  createdAt: Date
  updatedAt: Date
}

/** The client-facing shape: `_id`/`userId` (internal) become `id`. */
export interface SavedMix {
  id: string
  label: string
  tracks: SavedTrack[]
  termYears: number
  scenario: SavedMixScenario | null
  createdAt: Date
  updatedAt: Date
}

function toSavedMix(doc: WithId<SavedMixDoc>): SavedMix {
  return {
    id: doc._id.toHexString(),
    label: doc.label,
    tracks: doc.tracks,
    termYears: doc.termYears,
    scenario: doc.scenario ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

let indexesEnsured: Promise<void> | null = null

function ensureIndexes(): Promise<void> {
  if (!indexesEnsured) {
    indexesEnsured = getDb()
      .then((db) =>
        db
          .collection<SavedMixDoc>(COLLECTION)
          .createIndex({ userId: 1, createdAt: -1 }),
      )
      .then(() => undefined)
      .catch((error: unknown) => {
        indexesEnsured = null
        throw error
      })
  }
  return indexesEnsured
}

/** The caller's own mixes, newest first. */
export async function listSavedMixes(userId: string): Promise<SavedMix[]> {
  await ensureIndexes()
  const db = await getDb()
  const docs = await db
    .collection<SavedMixDoc>(COLLECTION)
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray()
  return docs.map(toSavedMix)
}

export type SaveMixResult =
  | { ok: true; mix: SavedMix }
  | { ok: false; reason: 'cap' }
  | { ok: false; reason: 'duplicate' }

/**
 * Whether the caller already has a mix with this name (case-insensitive,
 * trimmed). `exceptId` lets an update keep its own name without counting as a
 * duplicate of itself.
 */
async function labelTaken(
  userId: string,
  label: string,
  exceptId?: string,
): Promise<boolean> {
  const db = await getDb()
  const docs = await db
    .collection<SavedMixDoc>(COLLECTION)
    .find({ userId }, { projection: { _id: 1, label: 1 } })
    .toArray()
  const wanted = normalizeMixLabel(label)
  return docs.some(
    (doc) =>
      doc._id.toHexString() !== exceptId && normalizeMixLabel(doc.label) === wanted,
  )
}

/**
 * Stores one mix for the caller, unless the per-user cap is already reached or
 * the caller already has a mix with that name.
 *
 * The cap is refused rather than evicting the oldest: silently deleting a
 * saved mix would throw away work the user deliberately chose to keep. A
 * duplicate name is refused too: with only four slots, two mixes called
 * "First home" are indistinguishable, and the name is the only handle the
 * profile card has.
 */
export async function createSavedMix(userId: string, input: SavedMixInput): Promise<SaveMixResult> {
  await ensureIndexes()
  const db = await getDb()
  const collection = db.collection<SavedMixDoc>(COLLECTION)

  const count = await collection.countDocuments({ userId })
  if (count >= MAX_SAVED_MIXES) return { ok: false, reason: 'cap' }
  if (await labelTaken(userId, input.label)) return { ok: false, reason: 'duplicate' }

  const now = new Date()
  const doc: SavedMixDoc = {
    userId,
    label: input.label,
    tracks: input.tracks,
    termYears: input.termYears,
    scenario: input.scenario ?? null,
    createdAt: now,
    updatedAt: now,
  }
  const result = await collection.insertOne(doc)
  return { ok: true, mix: toSavedMix({ ...doc, _id: result.insertedId }) }
}

/**
 * Overwrites one of the caller's own mixes (label, tracks, term, scenario).
 * Returns null when the id is malformed or belongs to someone else, so the
 * caller cannot probe for other users' ids, and 'duplicate' when the new name
 * is already taken by another of the caller's mixes. Deliberately ignores the
 * cap: an update uses no new slot, so editing a loaded mix is never blocked.
 */
export type UpdateMixResult = { ok: true; mix: SavedMix } | { ok: false; reason: 'not_found' | 'duplicate' }

export async function updateSavedMix(
  userId: string,
  id: string,
  input: SavedMixInput,
): Promise<UpdateMixResult> {
  if (!ObjectId.isValid(id)) return { ok: false, reason: 'not_found' }
  await ensureIndexes()
  const db = await getDb()
  if (await labelTaken(userId, input.label, id)) return { ok: false, reason: 'duplicate' }
  const updated = await db.collection<SavedMixDoc>(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(id), userId },
    {
      $set: {
        label: input.label,
        tracks: input.tracks,
        termYears: input.termYears,
        scenario: input.scenario ?? null,
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' },
  )
  return updated ? { ok: true, mix: toSavedMix(updated) } : { ok: false, reason: 'not_found' }
}

/**
 * Deletes one of the caller's own mixes. Returns false when the id is malformed
 * or belongs to someone else, so the caller cannot probe for other users' ids.
 */
export async function deleteSavedMix(userId: string, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false
  await ensureIndexes()
  const db = await getDb()
  const result = await db
    .collection<SavedMixDoc>(COLLECTION)
    .deleteOne({ _id: new ObjectId(id), userId })
  return result.deletedCount === 1
}
