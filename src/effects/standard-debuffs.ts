/**
 * The standard debuffs' effect rules (rules/debuffs.ts `changes`): Woozy's lost DEX, Held's Advantage for
 * attackers, Shit-Faced's Disadvantage and the rest. Every new effect that is a standard debuff gets the rules it
 * is missing, whether it was toggled from the token HUD, dropped from a compendium built before these rules or
 * imported. Named compendium buffs that only change a number (Nitrous Oxide's Move) get theirs the same way. On load, the GM fills them into conditions already on actors.
 */
import { missingNamedChanges, missingStandardChanges } from '../rules/debuffs'

const missingFor = (effect: any) => {
  const existing = effect._source?.system?.changes ?? effect.system?.changes ?? []
  const standard = missingStandardChanges(effect.statuses ?? [], existing)
  return [...standard, ...missingNamedChanges(effect.name, [...existing, ...standard])]
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
  Hooks.once('ready', () => {
    if (game.user.isActiveGM) fillExisting().catch((error) => console.error('CrawlSpace | Filling in debuff rules failed', error))
  })
}
