import { findCompendiumEntry } from '../import/fill-damage.ts'

const nameKey = (name: unknown) => String(name ?? '').trim().toLowerCase()

/** Only active, positive rank bonuses can introduce a skill the actor does not own. */
export function missingGrantedSkills(actor: any): string[] {
  const bonuses = actor.system?.bonuses ?? {}
  const base = bonuses.baseSkillRanks ?? {}
  const enhanced = bonuses.skillRanks ?? {}
  const owned = new Set(actor.items.filter((item: any) => item.type === 'skill').map((item: any) => nameKey(item.name)))
  const names = new Map<string, string>()
  for (const effect of actor.allApplicableEffects()) {
    if (!effect.active) continue
    for (const change of effect.system?.changes ?? []) {
      if (!['crawlspace.skillRank', 'crawlspace.baseSkillRank'].includes(change.type)) continue
      for (const name of String(change.key ?? '').split(',').map((name) => name.trim()).filter(Boolean)) names.set(nameKey(name), name)
    }
  }
  return [...new Set([...Object.keys(base), ...Object.keys(enhanced)])]
    .filter((key) => key && !owned.has(key) && (Number(base[key]) || 0) + (Number(enhanced[key]) || 0) > 0)
    .map((key) => names.get(key) ?? key)
}

/** Actors whose items are being replaced wholesale (a re-import), keyed by uuid. */
const paused = new Map<string, number>()
let recheck: ((actor: any) => void) | null = null

/**
 * Run a wholesale item swap without adding skills mid-way: between deleting the old items and
 * creating the new ones, a granted skill looks missing, and adding it would duplicate the incoming one.
 * The actor is checked once afterwards.
 */
export async function withoutGrantedSkills<T>(actor: any, swap: () => Promise<T>): Promise<T> {
  if (!actor) return swap()
  const uuid = actor.uuid
  paused.set(uuid, (paused.get(uuid) ?? 0) + 1)
  try {
    return await swap()
  } finally {
    const left = (paused.get(uuid) ?? 1) - 1
    if (left) paused.set(uuid, left)
    else {
      paused.delete(uuid)
      recheck?.(actor)
    }
  }
}

/** Keep the learned rank at zero: the granting item's effect supplies the ranks exactly once. */
export async function addGrantedSkills(actor: any) {
  if (paused.has(actor.uuid)) return
  const creates: any[] = []
  for (const name of missingGrantedSkills(actor)) {
    const source = await findCompendiumEntry('skill', name)
    const data: any = source ? game.items.fromCompendium(source) : { name, type: 'skill', system: {} }
    delete data._id
    data.system ??= {}
    data.system.rank = { ...data.system.rank, value: 0, override: null }
    data.system.marked = false
    creates.push(data)
  }
  // A skill may have been dropped, or its granting item unequipped, during the compendium lookup,
  // or a swap may have started (it rechecks when done).
  if (paused.has(actor.uuid)) return
  const missing = new Set(missingGrantedSkills(actor).map(nameKey))
  const current = creates.filter((data) => missing.has(nameKey(data.name)))
  if (current.length) await actor.createEmbeddedDocuments('Item', current)
}

/** Serialize per actor, and elect one client so multiple owners never create duplicate skills. */
export function registerGrantedSkills() {
  const pending = new Map<string, { dirty: boolean }>()
  const check = (document: any) => {
    const actor = document?.documentName === 'Actor' ? document : document?.actor ?? (document?.parent?.documentName === 'Actor' ? document.parent : document?.parent?.actor)
    if (!actor || actor.type !== 'crawler' || !actor.isOwner) return
    if (paused.has(actor.uuid)) return
    const writer = game.users.activeGM ?? game.users.find((user: any) => user.active && actor.testUserPermission(user, 'OWNER'))
    if (writer?.id !== game.user.id) return
    const running = pending.get(actor.uuid)
    if (running) { running.dirty = true; return }
    const state = { dirty: true }
    pending.set(actor.uuid, state)
    setTimeout(async () => {
      try {
        while (state.dirty) {
          state.dirty = false
          await addGrantedSkills(actor)
        }
      } catch (error) {
        console.error('CrawlSpace | adding item-granted skills', error)
        ui.notifications.error('CrawlSpace could not add an item-granted skill. See the console for details.')
      } finally { pending.delete(actor.uuid) }
    }, 0)
  }
  recheck = check
  for (const type of ['Actor', 'Item', 'ActiveEffect'])
    for (const action of ['create', 'update', 'delete']) Hooks.on(`${action}${type}`, check)
  Hooks.on('renderCrawlerSheet', (sheet: any) => check(sheet.actor))
  for (const actor of game.actors) check(actor)
}
