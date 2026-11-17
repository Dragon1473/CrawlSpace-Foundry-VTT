/**
 * The standard debuffs' effect rules (rules/debuffs.ts `changes`): Woozy's lost DEX, Held's Advantage for
 * attackers, Shit-Faced's Disadvantage and the rest. Every new effect that is a standard debuff gets the rules it
 * is missing, whether it was toggled from the token HUD, dropped from a compendium built before these rules or
 * imported. Named compendium buffs (Nitrous Oxide, Iron Skin, Invisible…) get theirs the same way; Recovery and
 * Restore act at once and go. On load, the GM fills them into conditions already on actors.
 */
import { instantRestore, missingNamedChanges, missingStandardChanges } from '../rules/debuffs'
import { HEALTH_MAX } from '../config'

/** The Floor of the actor an effect sits on (Good Sleep adds it to every stat), or undefined off an actor. */
const floorOf = (effect: any) => {
  const actor = effect.parent?.documentName === 'Actor' ? effect.parent : null
  if (!actor) return undefined
  const floor = Number(actor.system?.details?.floor ?? actor.system?.floor)
  return Number.isFinite(floor) ? floor : undefined
}

const missingFor = (effect: any) => {
  const existing = effect._source?.system?.changes ?? effect.system?.changes ?? []
  const standard = missingStandardChanges(effect.statuses ?? [], existing)
  return [...standard, ...missingNamedChanges(effect.name, [...existing, ...standard], { floor: floorOf(effect) })]
}

/** Recovery and Restore act once when they land on an actor: full Health or full Mana, then they are gone. */
async function restore(effect: any) {
  const actor = effect.parent
  const kind = instantRestore(effect.name)
  if (!kind || actor?.documentName !== 'Actor') return
  if (kind === 'mana') await actor.update({ 'system.mana.value': Number(actor.system.mana?.max) || 0 })
  else if (actor.type === 'crawler') await actor.update({ 'system.health.value': HEALTH_MAX })
  else await actor.update({ 'system.slotsLost': 0 })
  await effect.delete()
}

/** Conditions already on the world's actors and on the scenes' unlinked tokens. */
async function fillExisting() {
  const actors = [...game.actors, ...game.scenes.contents.flatMap((scene: any) => scene.tokens.contents.filter((token: any) => !token.actorLink && token.actor).map((token: any) => token.actor))]
  for (const actor of actors) {
    const updates = actor.effects.contents
      .map((effect: any) => ({ effect, missing: missingFor(effect) }))
      .filter(({ missing }: any) => missing.length)
      .map(({ effect, missing }: any) => ({ _id: effect.id, 'system.changes': [...(effect._source.system?.changes ?? []), ...missing] }))
    if (updates.length) await actor.updateEmbeddedDocuments('ActiveEffect', updates)
  }
}

export function registerStandardDebuffRules() {
  Hooks.on('preCreateActiveEffect', (effect: any) => {
    const missing = missingFor(effect)
    if (missing.length) effect.updateSource({ 'system.changes': [...(effect._source.system?.changes ?? []), ...missing] })
  })
  Hooks.on('createActiveEffect', (effect: any) => {
    if (game.user.isActiveGM) restore(effect).catch((error) => console.error('CrawlSpace | Recovery or Restore failed', error))
  })
  Hooks.once('ready', () => {
    if (game.user.isActiveGM) fillExisting().catch((error) => console.error('CrawlSpace | Filling in debuff rules failed', error))
  })
}
