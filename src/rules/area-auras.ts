/**
 * Placed areas that work as auras although their published template has none: the spell's conditions go to the
 * tokens inside it. Confusing Fog's mist hides the caster's side, so mobs attack anyone in it with Disadvantage;
 * each ally inside (the caster too) carries the spell's condition while they stay in the fog. Pure module.
 */
import type { AbilityTemplate } from '../crawlspace-shared/shared/abilityTemplates'
import type { Aura } from '../crawlspace-shared/shared/auraDefinition'

export const AREA_AURAS: Record<string, Omit<Aura, 'effects'>> = {
  'confusing fog': { kind: 'aura', targets: 'allies', includeSource: true },
}

/** The area with its named aura on every shape that has no aura of its own. */
export function withAreaAura<T extends AbilityTemplate | null>(name: string, template: T): T {
  const aura = AREA_AURAS[String(name ?? '').trim().toLowerCase()]
  if (!template || !aura || template.areas.some((area) => area.aura)) return template
  return { ...template, areas: template.areas.map((area) => ({ ...area, aura: { ...aura, effects: [] } as Aura })) }
}
