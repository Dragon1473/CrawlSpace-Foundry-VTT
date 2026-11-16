import { test } from 'node:test'
import assert from 'node:assert/strict'
import { crawlerMarks } from '../src/rules/crawler-marks.ts'
import { bossBattleEnemies, cleanBattle, soundSource } from '../src/rules/boss-battle.ts'

test('a crawler shows skulls for crawlers killed, golden skulls for leaderboard kills and stars for bosses', () => {
  const marks = crawlerMarks({ crawlers: 2, leaderboard: 1, bosses: 3 })
  assert.deepEqual(marks.map((mark) => [mark.kind, mark.count, mark.icons]), [
    ['skull', 2, 2],
    ['goldenSkull', 1, 1],
    ['star', 3, 3],
  ])
})

test('no kills shows no marks, and odd values round down and never go negative', () => {
  assert.deepEqual(crawlerMarks(undefined), [])
  assert.deepEqual(crawlerMarks({ crawlers: 0, leaderboard: -2, bosses: 0.9 }), [])
  assert.equal(crawlerMarks({ bosses: 2.7 })[0].count, 2)
})

test('many marks collapse to one icon with a count', () => {
  const [stars] = crawlerMarks({ bosses: 9 })
  assert.equal(stars.icons, 1)
  assert.equal(stars.count, 9)
  assert.equal(stars.many, true)
  assert.equal(crawlerMarks({ bosses: 5 })[0].many, false)
})

const token = (id, disposition, extra = {}) => ({ id, actorUuid: `Actor.${id}`, name: id, img: `${id}.webp`, disposition, ...extra })

test('the GM\'s selected tokens are the enemies, leaving out the party', () => {
  const enemies = bossBattleEnemies({
    selected: [token('Boss', -1), token('Carl', 1), token('Gnoll', 0)],
    combatants: [token('Rat', -1)],
    party: ['Actor.Carl'],
  })
  assert.deepEqual(enemies.map((enemy) => enemy.name), ['Boss', 'Gnoll'])
})

test('with nothing selected, the combat\'s hostile combatants are the enemies', () => {
  const enemies = bossBattleEnemies({
    selected: [token('Carl', 1)],
    combatants: [token('Boss', -1), token('Donut', 1), token('Shopkeeper', 0), token('Boss', -1), token('Minion', -1, { actorUuid: 'Actor.Carl' })],
    party: ['Actor.Carl'],
  })
  assert.deepEqual(enemies.map((enemy) => enemy.name), ['Boss'])
})

test('a battle sent over the socket is trimmed to names and pictures', () => {
  const battle = cleanBattle({ crawlers: [{ name: 'Carl', img: 'carl.webp', secret: 1 }, 'junk'], enemies: Array.from({ length: 30 }, (_, i) => ({ name: `E${i}`, img: 7 })) })
  assert.deepEqual(battle.crawlers, [{ name: 'Carl', img: 'carl.webp' }])
  assert.equal(battle.enemies.length, 12)
  assert.deepEqual(battle.enemies[0], { name: 'E0', img: '' })
  assert.deepEqual(cleanBattle(null), { crawlers: [], enemies: [] })
})

test('a blank sound setting plays nothing', () => {
  assert.equal(soundSource(''), null)
  assert.equal(soundSource('   '), null)
  assert.equal(soundSource(undefined), null)
  assert.equal(soundSource(' sounds/boss.ogg '), 'sounds/boss.ogg')
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
