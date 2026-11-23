import test from 'node:test'
import assert from 'node:assert/strict'
import { addGrantedSkills, missingGrantedSkills, registerGrantedSkills, withoutGrantedSkills } from '../src/actors/granted-skills.ts'

const source = { _id: 'pack-skill', name: 'Climbing', type: 'skill', system: { stat: 'STR', description: 'Compendium description', rank: { value: 5, override: 8 }, upgrades: { rank5: 'Climb faster' } }, effects: [{ name: 'Rank benefit' }] }
const pack = (collection, data) => ({ collection, documentName: 'Item', getIndex: async () => [data], getDocument: async () => data })
globalThis.game = {
  packs: [pack('crawlspace.homebrew-skills', { ...source, system: { ...source.system, description: 'Homebrew description' } }), pack('crawlspace-content.skills', source)],
  items: { fromCompendium: (data) => structuredClone(data) },
  user: { id: 'gm' },
  users: { activeGM: { id: 'gm' } },
  actors: [],
}

function actor(base = {}, enhanced = {}) {
  return {
    documentName: 'Actor', uuid: 'Actor.test', type: 'crawler', isOwner: true,
    system: { bonuses: { baseSkillRanks: base, skillRanks: enhanced } }, items: [],
    allApplicableEffects: () => [{ active: true, system: { changes: [{ type: 'crawlspace.skillRank', key: 'Climbing, Custom Skill' }] } }],
    async createEmbeddedDocuments(type, data) { assert.equal(type, 'Item'); this.items.push(...data) },
  }
}

test('base and enhanced bonuses add a full compendium skill without baking in its ranks', async () => {
  const targets = [actor({ climbing: 2 }), actor({}, { climbing: 3 })]
  await Promise.all(targets.map(addGrantedSkills))
  for (const target of targets) {
    assert.equal(target.items.length, 1)
    const skill = target.items[0]
    assert.equal(skill.system.description, 'Compendium description', 'official compendium wins')
    assert.equal(skill.system.stat, 'STR')
    assert.deepEqual(skill.system.upgrades, source.system.upgrades)
    assert.deepEqual(skill.effects, source.effects)
    assert.equal(skill.system.rank.value, 0)
    assert.equal(skill.system.rank.override, null)
    assert.equal(skill._id, undefined)
    await addGrantedSkills(target)
    assert.equal(target.items.length, 1)
  }
  assert.equal(source.system.rank.value, 5, 'source is unchanged')
})

test('existing skills, inactive bonuses and nonpositive totals do not create skills', () => {
  const target = actor({ climbing: 2, cancelled: 2, zero: 0 }, { climbing: 3, cancelled: -2, penalty: -1 })
  target.items.push({ name: ' CLIMBING ', type: 'skill' })
  assert.deepEqual(missingGrantedSkills(target), [])
  assert.deepEqual(missingGrantedSkills(actor()), [], 'inactive equipment has no prepared bonus')
})

test('a custom skill falls back to a blank entry when no compendium matches', async () => {
  const target = actor({}, { 'custom skill': 1 })
  await addGrantedSkills(target)
  assert.equal(target.items[0].name, 'Custom Skill')
  assert.equal(target.items[0].type, 'skill')
  assert.equal(target.items[0].system.rank.value, 0)
})

test('a bonus removed while the compendium loads does not add its skill', async () => {
  const target = actor({}, { climbing: 2 })
  const adding = addGrantedSkills(target)
  target.system.bonuses.skillRanks = {}
  await adding
  assert.equal(target.items.length, 0)
})

test('item and effect updates are coalesced and only the elected client creates skills', async () => {
  const hooks = new Map()
  globalThis.Hooks = { on: (name, callback) => hooks.set(name, callback) }
  registerGrantedSkills()
  const target = actor({}, { climbing: 2 })
  let creates = 0
  const original = target.createEmbeddedDocuments
  target.createEmbeddedDocuments = async function (...args) {
    creates++
    await original.apply(this, args)
    hooks.get('createItem')({ actor: this })
  }
  hooks.get('updateItem')({ actor: target })
  hooks.get('updateActiveEffect')({ parent: { actor: target } })
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(creates, 1)
  game.user.id = 'other-owner'
  hooks.get('updateItem')({ actor: actor({}, { climbing: 2 }) })
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(creates, 1)
  game.user.id = 'gm'
})

test('a re-import swapping all items does not add a granted skill the import brings back', async () => {
  const hooks = new Map()
  globalThis.Hooks = { on: (name, callback) => hooks.set(name, callback) }
  registerGrantedSkills()
  const target = actor({}, { climbing: 2 })
  target.items.push({ name: 'Climbing', type: 'skill', system: { rank: { value: 3 } } })
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20))
  await withoutGrantedSkills(target, async () => {
    target.items = []
    hooks.get('deleteItem')({ actor: target })
    await settle()
    target.items.push({ name: 'Climbing', type: 'skill', system: { rank: { value: 3 } } })
    hooks.get('createItem')({ actor: target })
  })
  await settle()
  assert.deepEqual(target.items.map((item) => item.system.rank.value), [3])

  // A skill the import doesn't bring back is still added once the swap ends.
  await withoutGrantedSkills(target, async () => {
    target.items = []
    hooks.get('deleteItem')({ actor: target })
    await settle()
    assert.equal(target.items.length, 0)
  })
  await settle()
  assert.deepEqual(target.items.map((item) => item.system.rank.value), [0])
})
