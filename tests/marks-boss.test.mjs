import { test } from 'node:test'
import assert from 'node:assert/strict'
import { KILL_KINDS, crawlerMarks, migrateKills, stepKill } from '../src/rules/crawler-marks.ts'
import { BOSS_BATTLE_SOUND, battleSides, cleanBattle, groupFighters, soundSource } from '../src/rules/boss-battle.ts'
import { cleanParties, partyNameOf } from '../src/rules/party.ts'

test('kills are listed from the most important: floor boss down to crawlers', () => {
  assert.deepEqual(
    KILL_KINDS.map((kind) => [kind.key, kind.icon, kind.tier]),
    [
      ['floor', 'star', 'celestial'],
      ['country', 'star', 'legendary'],
      ['province', 'star', 'platinum'],
      ['city', 'star', 'gold'],
      ['borough', 'star', 'silver'],
      ['neighborhood', 'star', 'bronze'],
      ['leaderboard', 'skull', 'gold'],
      ['crawlers', 'skull', 'white'],
    ],
  )
})

test('a crawler shows one mark per kind earned, with its count, most important first', () => {
  const marks = crawlerMarks({ crawlers: 2, leaderboard: 1, neighborhood: 3, floor: 1, city: 0 })
  assert.deepEqual(marks.map((mark) => [mark.key, mark.count]), [
    ['floor', 1],
    ['neighborhood', 3],
    ['leaderboard', 1],
    ['crawlers', 2],
  ])
})

test('no kills shows no marks, and odd values round down and never go negative', () => {
  assert.deepEqual(crawlerMarks(undefined), [])
  assert.deepEqual(crawlerMarks({ crawlers: 0, leaderboard: -2, borough: 0.9 }), [])
  assert.equal(crawlerMarks({ borough: 2.7 })[0].count, 2)
})

test('the + and - buttons change a count by one and never go below zero', () => {
  assert.equal(stepKill(2, 1), 3)
  assert.equal(stepKill(2, -1), 1)
  assert.equal(stepKill(0, -1), 0)
  assert.equal(stepKill(undefined, 1), 1)
})

test('older crawlers keep their boss kills as neighborhood bosses', () => {
  assert.deepEqual(migrateKills({ crawlers: 1, leaderboard: 0, bosses: 4 }), { crawlers: 1, leaderboard: 0, neighborhood: 4 })
  assert.deepEqual(migrateKills({ crawlers: 1, bosses: 2, neighborhood: 5 }), { crawlers: 1, neighborhood: 5 })
  assert.deepEqual(migrateKills({ crawlers: 1 }), { crawlers: 1 })
})

const token = (id, disposition, extra = {}) => ({ id, actorUuid: `Actor.${id}`, name: id, img: `${id}.webp`, disposition, ...extra })
const names = (list) => list.map((entry) => entry.name)

test("the GM's selected tokens are the enemies, leaving out the party and friendly tokens", () => {
  const { enemies } = battleSides({
    party: [token('Carl', 1, { crawler: true })],
    selected: [token('Boss', -1), token('Carl', 1), token('Gnoll', 0), token('Ally', 1)],
    combatants: [token('Rat', -1)],
  })
  assert.deepEqual(names(enemies), ['Boss', 'Gnoll'])
})

test("with nothing selected, the combat's hostile combatants are the enemies", () => {
  const { enemies } = battleSides({
    party: [token('Carl', 1, { crawler: true })],
    selected: [],
    combatants: [token('Boss', -1), token('Donut', 1), token('Shopkeeper', 0), token('Boss', -1), token('Minion', -1, { actorUuid: 'Actor.Carl' })],
  })
  assert.deepEqual(names(enemies), ['Boss'])
})

test("the party's pets and minions are never enemies", () => {
  const { allies, enemies } = battleSides({ party: [], selected: [token('Mongo', -1), token('Boss', -1)], combatants: [], friends: ['Actor.Mongo'] })
  assert.deepEqual(names(enemies), ['Boss'])
  assert.deepEqual(names(allies), [])
})

test('the crawler side is the party, then other crawlers in the fight who are not hostile', () => {
  const { allies, enemies } = battleSides({
    party: [token('Carl', 1, { crawler: true }), token('Donut', 1, { crawler: true })],
    selected: [],
    combatants: [token('Carl', 1, { crawler: true }), token('Imani', 1, { crawler: true }), token('Imani', 1, { crawler: true, id: 'Imani2' }), token('Rival', -1, { crawler: true }), token('Shopkeeper', 0), token('Boss', -1)],
  })
  assert.deepEqual(names(allies), ['Carl', 'Donut', 'Imani'])
  assert.deepEqual(names(enemies), ['Rival', 'Boss'])
})

test('crawlers are grouped under their party, Solo last; monsters get no banner', () => {
  const groups = groupFighters(
    [
      token('Carl', 1, { crawler: true, party: 'The Royal Court', level: 9 }),
      token('Loner', 1, { crawler: true, level: 3 }),
      token('Imani', 1, { crawler: true, party: 'Meadow Lark', level: 10.6 }),
      token('Donut', 1, { crawler: true, party: 'The Royal Court', level: 9 }),
      token('Boss', -1, { level: 12 }),
    ],
    'Solo',
  )
  assert.deepEqual(groups.map((group) => [group.name, names(group.fighters)]), [
    ['The Royal Court', ['Carl', 'Donut']],
    ['Meadow Lark', ['Imani']],
    ['', ['Boss']],
    ['Solo', ['Loner']],
  ])
  assert.equal(groups[1].fighters[0].level, 10)
})

test('a battle sent over the socket is trimmed to group names, names, pictures and levels', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ name: `E${i}`, img: 7, level: '4' }))
  const battle = cleanBattle({ crawlers: [{ name: 'Court', fighters: [{ name: 'Carl', img: 'carl.webp', level: 9, secret: 1 }, 'junk'] }, { name: 'Empty', fighters: [] }], enemies: [{ name: 5, fighters: many }] })
  assert.deepEqual(battle.crawlers, [{ name: 'Court', fighters: [{ name: 'Carl', img: 'carl.webp', level: 9 }] }])
  assert.equal(battle.enemies[0].name, '')
  assert.equal(battle.enemies[0].fighters.length, 12)
  assert.deepEqual(battle.enemies[0].fighters[0], { name: 'E0', img: '', level: 4 })
  assert.deepEqual(cleanBattle(null), { crawlers: [], enemies: [] })
})

test("other parties come from the setting cleaned up, and a crawler's party name follows its membership", () => {
  const parties = cleanParties([{ id: 'a', name: ' Meadow Lark ' }, { id: 'a', name: 'dupe' }, { name: 'no id' }, null, { id: 'b' }])
  assert.deepEqual(parties, [{ id: 'a', name: 'Meadow Lark' }, { id: 'b', name: '' }])
  const context = { members: new Set(['carl']), playerName: '', fallback: 'Crawlers', parties }
  assert.equal(partyNameOf({ id: 'carl', flags: { crawlspace: { partyId: 'a' } } }, context), 'Crawlers')
  assert.equal(partyNameOf({ id: 'carl' }, { ...context, playerName: 'The Royal Court' }), 'The Royal Court')
  assert.equal(partyNameOf({ id: 'imani', flags: { crawlspace: { partyId: 'a' } } }, context), 'Meadow Lark')
  assert.equal(partyNameOf({ id: 'loner', flags: { crawlspace: { partyId: 'gone' } } }, context), '')
})

test('the boss battle plays the bundled sound bite unless another is set, and nothing when sound bites are off', () => {
  assert.equal(soundSource('', true), BOSS_BATTLE_SOUND)
  assert.equal(soundSource('   ', true), BOSS_BATTLE_SOUND)
  assert.equal(soundSource(undefined, true), BOSS_BATTLE_SOUND)
  assert.equal(soundSource(' sounds/boss.ogg ', true), 'sounds/boss.ogg')
  assert.equal(soundSource(' sounds/boss.ogg ', false), null)
  assert.equal(soundSource('', false), null)
  assert.equal(BOSS_BATTLE_SOUND, 'systems/crawlspace/assets/sounds/boss-battle.mp3')
})

test('the VS. overlay uses the headshot, then the portrait, then the token art', async () => {
  const { headshotOf } = await import('../src/rules/headshot.ts')
  assert.equal(headshotOf({ headshot: 'h.png', portrait: 'p.png', token: 't.png' }), 'h.png')
  assert.equal(headshotOf({ headshot: '  ', portrait: 'p.png', token: 't.png' }), 'p.png')
  assert.equal(headshotOf({ portrait: 'icons/svg/mystery-man.svg', token: 't.png' }), 't.png')
  assert.equal(headshotOf({}), 'icons/svg/mystery-man.svg')
})

test('a headshot crop is a square inside the picture: zoom 1 is the largest square, zoom 2 half as wide', async () => {
  const { headshotCrop } = await import('../src/rules/headshot.ts')
  // A tall portrait: the square is as wide as the picture, centred where asked.
  assert.deepEqual(headshotCrop({ width: 400, height: 1000 }, { zoom: 1, x: 0.5, y: 0.2 }), { sx: 0, sy: 0, side: 400 })
  assert.deepEqual(headshotCrop({ width: 400, height: 1000 }, { zoom: 2, x: 0.5, y: 0.5 }), { sx: 100, sy: 400, side: 200 })
  // The square never leaves the picture, and odd sizes round down.
  assert.deepEqual(headshotCrop({ width: 400, height: 1000 }, { zoom: 3, x: 1, y: 1 }), { sx: 267, sy: 867, side: 133 })
  assert.deepEqual(headshotCrop({ width: 400, height: 1000 }, { zoom: 0.2, x: -1, y: -1 }), { sx: 0, sy: 0, side: 400 })
})

test('the frames list a crawler\'s players unless that is turned off', async () => {
  const { framePlayers } = await import('../src/rules/crawler-marks.ts')
  assert.equal(framePlayers(['Ann', 'Bo'], true), 'Ann, Bo')
  assert.equal(framePlayers(['Ann', 'Bo'], false), '')
  assert.equal(framePlayers([], true), '')
})

test('bosses lead their side: one group of their own, first, marked to stand above and centred over the rest', () => {
  const groups = groupFighters(
    [
      token('Rat', -1, { level: 2 }),
      token('Rival', -1, { crawler: true, party: 'Daughters of Kali', level: 8 }),
      token('Krakaren', -1, { boss: true, level: 12 }),
      token('Rat Two', -1, { level: 2 }),
    ],
    'Solo',
  )
  assert.deepEqual(groups.map((group) => [group.name, !!group.lead, names(group.fighters)]), [
    ['', true, ['Krakaren']],
    ['', false, ['Rat', 'Rat Two']],
    ['Daughters of Kali', false, ['Rival']],
  ])
  const sent = cleanBattle({ crawlers: [], enemies: groups })
  assert.equal(sent.enemies[0].lead, true)
  assert.equal('lead' in sent.enemies[1], false)
})
