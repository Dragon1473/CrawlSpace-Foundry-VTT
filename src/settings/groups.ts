/**
 * The boxes the CrawlSpace settings are grouped into on the Configure Settings window (settings/layout.ts), in
 * order, each listing its settings in order. A setting no box names goes in Other. Pure module.
 */
export const SETTING_GROUPS: readonly { id: string; keys: readonly string[] }[] = [
  { id: 'frames', keys: ['crawlerFramePlayers', 'crawlerMarks'] },
  { id: 'combat', keys: ['autoAdvancePhase'] },
  { id: 'bosses', keys: ['autoBossBattle', 'bossHealthBar', 'bossBattleSound', 'soundBites'] },
  { id: 'upkeep', keys: ['upkeepAutomation', 'playerUpkeep'] },
  { id: 'crafting', keys: ['craftApproval', 'craftRules', 'craftCategories'] },
  { id: 'compendiums', keys: ['homebrewCompendium'] },
]

/** The boxes for the settings on show (a player sees fewer than the GM), without empty ones. */
export function groupSettings(shown: string[]) {
  const present = new Set(shown)
  const named = new Set(SETTING_GROUPS.flatMap((group) => group.keys))
  const groups = SETTING_GROUPS.map((group) => ({ id: group.id, keys: group.keys.filter((key) => present.has(key)) }))
  groups.push({ id: 'other', keys: shown.filter((key) => !named.has(key)) })
  return groups.filter((group) => group.keys.length)
}
