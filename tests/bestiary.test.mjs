import { test } from 'node:test'
import assert from 'node:assert/strict'
import { actorCategory, actorLink, actorSignature, booksIn, filterEntries, mergeEntries, statBlockOf } from '../src/rules/bestiary.ts'

const entry = (source, id, name, extra = {}) => ({ key: `${source}:${id}`, source, id: String(id), name, category: 'Mob', ...extra })
const filters = (extra = {}) => ({ search: '', category: 'main', view: 'all', book: '', ...extra })

test('mobs, bosses, GM crawlers and NPCs are bestiary entries; followers and crawlers are not', () => {
  assert.equal(actorCategory({ type: 'mob', system: { kind: 'mob' } }), 'Mob')
  assert.equal(actorCategory({ type: 'mob', system: { kind: 'boss' } }), 'Boss')
  assert.equal(actorCategory({ type: 'mob', system: { kind: 'mob', crawler: true } }), 'Crawler')
  assert.equal(actorCategory({ type: 'npc', system: {} }), 'NPC')
  assert.equal(actorCategory({ type: 'mob', system: { master: 'Actor.x' } }), null, 'a pet or hired mob')
  assert.equal(actorCategory({ type: 'mob', system: { minion: { temporary: true } } }), null, 'a raised minion')
  for (const type of ['crawler', 'minion', 'companion']) assert.equal(actorCategory({ type, system: {} }), null)
})

test('a world actor keeps its link to the module entry it was made from', () => {
  assert.deepEqual(actorLink({ flags: { crawlspace: { bestiary: { source: 'crawlspace-bestiary', id: 42 } } } }), { source: 'crawlspace-bestiary', id: '42' })
  assert.equal(actorLink({ flags: {} }), null)
  assert.equal(actorLink({ flags: { crawlspace: { bestiary: { source: 'x', id: '' } } } }), null)
})

test('a module entry takes over the world actor made from it, with that actor’s portrait', () => {
  const homebrew = [entry('world', 'Actor.a', 'Goblin', { actorUuid: 'Actor.a' }), entry('world', 'Actor.b', 'My Ogre', { actorUuid: 'Actor.b' })]
  const modules = [entry('crawlspace-bestiary', 7, 'Goblin', { img: 'book.webp', pixelArt: true }), entry('crawlspace-bestiary', 8, 'Rat', { img: 'rat.webp' })]
  const actors = [
    { uuid: 'Actor.a', img: 'mine.webp', link: { source: 'crawlspace-bestiary', id: '7' } },
    { uuid: 'Actor.b', img: 'ogre.webp', link: null },
  ]
  const merged = mergeEntries(homebrew, modules, actors)
  assert.deepEqual(merged.homebrew.map((e) => e.name), ['My Ogre'])
  assert.equal(merged.modules[0].actorUuid, 'Actor.a')
  assert.equal(merged.modules[0].img, 'mine.webp')
  assert.equal(merged.modules[0].pixelArt, false, 'a new portrait is not pixel art')
  assert.equal(merged.modules[1].actorUuid, undefined)
})

test('a mob imported from the game compendium shows once, as its book entry, until it’s changed', () => {
  const stat = 'Compendium.crawlspace-content.mobs.Actor.gob'
  const homebrew = [entry('world', 'Actor.a', 'Goblin', { actorUuid: 'Actor.a' }), entry('world', 'Actor.b', 'Goblin', { actorUuid: 'Actor.b' })]
  const modules = [entry('crawlspace-bestiary', 7, 'Goblin', { img: 'book.webp', statUuid: stat }), entry('crawlspace-bestiary', 9, 'Goblin Chief', { statUuid: 'Compendium.x.y.Actor.chief' })]
  const unchanged = mergeEntries(homebrew.slice(0, 1), modules, [{ uuid: 'Actor.a', name: 'Goblin', img: 'icon.webp', link: null, sourceUuid: stat, changed: false }])
  assert.deepEqual(unchanged.homebrew, [], 'not listed twice')
  assert.equal(unchanged.modules[0].actorUuid, 'Actor.a')
  assert.equal('statUuid' in unchanged.modules[0], false)

  const changed = mergeEntries(homebrew.slice(0, 1), modules, [{ uuid: 'Actor.a', name: 'Goblin', link: null, sourceUuid: stat, changed: true }])
  assert.equal(changed.homebrew.length, 1, 'the changed version is listed')
  assert.equal(changed.homebrew[0].basedOn, 'Goblin')
  assert.equal(changed.modules[0].actorUuid, undefined, 'and the original is the book’s again')
  assert.equal(changed.modules[0].img, 'book.webp')

  const twice = mergeEntries(homebrew, modules, [
    { uuid: 'Actor.a', name: 'Goblin', link: null, sourceUuid: stat, changed: false },
    { uuid: 'Actor.b', name: 'Goblin', link: null, sourceUuid: stat, changed: false },
  ])
  assert.deepEqual(twice.homebrew, [], 'two untouched imports are still the one mob')
})

test('a bestiary-made actor that’s been edited splits off from its entry too', () => {
  const homebrew = [entry('world', 'Actor.a', 'Goblin', { actorUuid: 'Actor.a' })]
  const modules = [entry('crawlspace-bestiary', 7, 'Goblin')]
  const merged = mergeEntries(homebrew, modules, [{ uuid: 'Actor.a', name: 'Goblin', link: { source: 'crawlspace-bestiary', id: '7' }, changed: true }])
  assert.equal(merged.homebrew[0].basedOn, 'Goblin')
  assert.equal(merged.modules[0].actorUuid, undefined)
})

test('an import is unchanged when only its ids, portrait, token, flags or damage taken differ', () => {
  const source = {
    _id: 'src',
    name: 'Goblin',
    img: 'a.webp',
    system: { level: 2, slotsLost: 0, attacks: [{ name: 'Shiv', damage: '1d6' }] },
    items: [
      { _id: 'i1', name: 'Club', system: { damage: '1d4' } },
      { _id: 'i2', name: 'Rags', system: {} },
    ],
    effects: [],
    prototypeToken: { texture: { src: 'a.webp' } },
    flags: {},
    _stats: { createdTime: 1 },
  }
  const copy = structuredClone(source)
  Object.assign(copy, { _id: 'new', img: 'b.webp', prototypeToken: { texture: { src: 'c.webp' } }, flags: { crawlspace: { bestiary: { id: 7 } } }, _stats: { createdTime: 2 } })
  copy.system.slotsLost = 2
  copy.items = [{ ...copy.items[1], _id: 'x' }, { ...copy.items[0], _id: 'y' }]
  assert.equal(actorSignature(copy), actorSignature(source))
  copy.system.level = 3
  assert.notEqual(actorSignature(copy), actorSignature(source), 'a sheet change')
  copy.system.level = 2
  copy.items[0].system = { note: 'new' }
  assert.notEqual(actorSignature(copy), actorSignature(source), 'an item change')
  copy.items[0].system = {}
  copy.name = 'Goblin Boss'
  assert.notEqual(actorSignature(copy), actorSignature(source), 'renamed')
})

test('an actor linked to a module that isn’t installed stays homebrew', () => {
  const homebrew = [entry('world', 'Actor.a', 'Goblin', { actorUuid: 'Actor.a' })]
  const merged = mergeEntries(homebrew, [], [{ uuid: 'Actor.a', link: { source: 'gone', id: '1' } }])
  assert.equal(merged.homebrew.length, 1)
})

test('the toggle shows all, homebrew (world and compendium) or one module’s mobs', () => {
  const all = [entry('world', 'a', 'Ogre'), entry('pack', 'b', 'Hag'), entry('crawlspace-bestiary', 1, 'Goblin')]
  const names = (view) => filterEntries(all, filters({ view })).map((e) => e.name)
  assert.deepEqual(names('all'), ['Goblin', 'Hag', 'Ogre'])
  assert.deepEqual(names('homebrew'), ['Hag', 'Ogre'])
  assert.deepEqual(names('crawlspace-bestiary'), ['Goblin'])
})

test('category, book and search filters', () => {
  const all = [
    entry('m', 1, 'Goblin', { book: 'Core', sections: [{ label: 'x', text: 'A small green thief' }] }),
    entry('m', 2, 'Zev', { category: 'NPC', book: 'Core' }),
    entry('m', 3, 'Grull', { category: 'Boss', book: 'Toolkit' }),
  ]
  const names = (extra) => filterEntries(all, filters(extra)).map((e) => e.name)
  assert.deepEqual(names({}), ['Goblin', 'Grull'], 'main hides NPCs')
  assert.deepEqual(names({ category: 'all' }), ['Goblin', 'Grull', 'Zev'])
  assert.deepEqual(names({ category: 'Boss' }), ['Grull'])
  assert.deepEqual(names({ book: 'Toolkit' }), ['Grull'])
  assert.deepEqual(names({ search: 'green THIEF' }), ['Goblin'])
  assert.deepEqual(booksIn(all, 'all'), ['Core', 'Toolkit'])
  assert.deepEqual(booksIn(all, 'homebrew'), [])
})

test('a mob’s stat block rounds down and shows its attacks to hit as a bonus', () => {
  const system = {
    level: 3,
    floor: 2,
    size: '4',
    type: 'Humanoid',
    tags: 'goblin, sneaky',
    health: { max: 4, perSlot: 6.5 },
    evade: { total: 13.7 },
    dr: { total: 2 },
    move: { total: 25 },
    surpriseTotal: 12,
    attributes: { str: { total: 12, mod: 1 }, dex: { total: 15.5, mod: 2 }, con: { total: null, mod: 0 }, int: { total: 8, mod: -1 }, cha: { total: 9, mod: -1 } },
    attacks: [{ name: 'Shiv', toHit: 15, damage: '1d6+@str', damageTypes: ['Piercing'] }],
    abilities: [{ name: 'Sneak', description: 'Hides.' }],
    traits: { immunities: [], resistances: ['Poison'], vulnerabilities: [] },
  }
  const block = statBlockOf('mob', system, (formula) => formula.replace('@str', '1'))
  assert.equal(block.health.perSlot, 6)
  assert.equal(block.evade, 13)
  assert.deepEqual(block.tags, ['goblin', 'sneaky'])
  assert.deepEqual(block.stats.map((s) => [s.code, s.total, s.mod]), [
    ['STR', 12, 1],
    ['DEX', 15, 2],
    ['CON', null, 0],
    ['INT', 8, -1],
    ['CHA', 9, -1],
  ])
  assert.deepEqual(block.attacks, [{ name: 'Shiv', toHit: 5, damage: '1d6+1', types: 'Piercing' }])
  assert.deepEqual(block.traits, [{ key: 'resistances', values: ['Poison'] }])
})

test('an NPC’s stat block has its stats but no mob numbers', () => {
  const block = statBlockOf('npc', { floor: 1, attributes: { str: { total: 10, mod: 0 } } })
  assert.equal(block.kind, 'npc')
  assert.equal(block.health, undefined)
  assert.equal(block.stats[0].total, 10)
})
