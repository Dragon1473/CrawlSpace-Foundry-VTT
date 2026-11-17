/**
 * Upkeep's one summary card: for each crawler, what the rest or hourly recovery restored, and what regeneration
 * buffs (You are full!, Replenish…) added while its time passed. Health is in points (a slot is 10). Pure module.
 */
type Pools = { health: number; mana: number }

export function recoveryRow(before: Pools, afterRegen: Pools, after: Pools, regen: { sources?: string[] } = {}) {
  const slots = (from: number, to: number) => Math.max(0, Math.floor((to - from) / 10))
  const gain = (from: number, to: number) => Math.max(0, Math.floor(to - from))
  const bonusSlots = slots(before.health, afterRegen.health)
  const bonusMana = gain(before.mana, afterRegen.mana)
  return {
    slots: slots(afterRegen.health, after.health),
    mana: gain(afterRegen.mana, after.mana),
    bonusSlots,
    bonusMana,
    bonusFrom: bonusSlots || bonusMana ? [...new Set(regen.sources ?? [])] : [],
  }
}
