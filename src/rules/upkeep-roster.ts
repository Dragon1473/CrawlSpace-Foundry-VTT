/**
 * Party Upkeep's roster: the crawlers listed in the window, grouped by the party each stands with. The players'
 * party comes first, then the other parties in the GM's order, then Solo crawlers. The scene-controls order of
 * the CarlRPG tools lives here too, so it can be checked without Foundry.
 */

/** A listed crawler: its party key is 'players', another party's id, or '' for Solo. */
export type RosterCrawler = { uuid: string; name: string; party: string }
export type RosterGroup = {
  key: string
  label: string
  crawlers: (RosterCrawler & { checked: boolean })[]
  /** Every crawler in the group is checked. */
  allChecked: boolean
}

export const PLAYERS = 'players'
export const SOLO = ''

/** Groups in party order, each sorted by name; empty groups are left out. */
export function rosterGroups(
  crawlers: RosterCrawler[],
  checked: Set<string>,
  { parties, playersLabel, soloLabel, unnamedLabel }: { parties: { id: string; name: string }[]; playersLabel: string; soloLabel: string; unnamedLabel: string },
): RosterGroup[] {
  const known = new Set(parties.map((party) => party.id))
  const order = [
    { key: PLAYERS, label: playersLabel },
    ...parties.map((party) => ({ key: party.id, label: party.name || unnamedLabel })),
    { key: SOLO, label: soloLabel },
  ]
  // A party id that is no longer in the list counts as Solo.
  const keyOf = (crawler: RosterCrawler) => (crawler.party === PLAYERS || known.has(crawler.party) ? crawler.party : SOLO)
  return order
    .map(({ key, label }) => {
      const members = crawlers
        .filter((crawler) => keyOf(crawler) === key)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((crawler) => ({ ...crawler, party: key, checked: checked.has(crawler.uuid) }))
      return { key, label, crawlers: members, allChecked: members.length > 0 && members.every((crawler) => crawler.checked) }
    })
    .filter((group) => group.crawlers.length)
}

/** The select/deselect button on a party: checks the whole party unless all of it is checked already. */
export function toggleGroup(checked: Set<string>, uuids: string[]) {
  const next = new Set(checked)
  const all = uuids.length > 0 && uuids.every((uuid) => next.has(uuid))
  for (const uuid of uuids) {
    if (all) next.delete(uuid)
    else next.add(uuid)
  }
  return next
}

/** The CarlRPG scene-control tools, top to bottom. */
export const CARL_TOOLS = ['partyScreen', 'upkeep', 'crafting', 'leaderboard', 'timers', 'race', 'bossBattle', 'encounterTuner'] as const
export type CarlTool = (typeof CARL_TOOLS)[number]
