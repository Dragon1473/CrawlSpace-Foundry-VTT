import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { extname } from 'node:path'

// Isolate item advancement from Foundry runtime dependencies.
const stubs = {
  '../effects/use-conditions': `
    export function applyCastEffects() {}
    export function conditionRows() {}
    export function itemCardDetails() {}
  `,
  '../loot/boxes': `
    export function openLootBoxes() {}
  `,
  '../data/items': `
    export const BUILD_EFFECT_FIELDS = []
  `,
  '../dice/rolls': `
    export function penaltyModifiers() { return [] }

    export async function rollAttack(actor, attack) {
      actor.lastAttack = attack
      actor.rollCount = (actor.rollCount ?? 0) + 1

      if (actor.cancelCast) return null

      if (attack.pay && !(await attack.pay())) return null

      return { effectSkills: [] }
    }

    export function rollCheck() {}
    export function rollDamage() {}
    export function speakerFor() {}
`,
  '../tokens/animations': `
    export function playItemAnimation() {}
  `,
  '../effects/killing-blows': `
    export function spellKillBonus() { return 0 }
`,
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
    (
        context.parentURL?.endsWith('/src/documents/item.ts') ||
        context.parentURL?.endsWith('/src/actors/attacks.ts')
    ) &&
    Object.hasOwn(stubs, specifier)
    ) {
      return {
        url: 'data:text/javascript,' +
          encodeURIComponent(stubs[specifier]),
        shortCircuit: true,
      }
    }

    if (specifier.startsWith('.') && !extname(specifier)) {
      return nextResolve(specifier + '.ts', context)
    }

    return nextResolve(specifier, context)
  },
})

// Minimal substitute for Foundry's base Item class.
globalThis.Item = class {}

globalThis.game = {
  i18n: {
    localize: (key) => key,
    format: (key) => key,
  },
}

const {
  CrawlItem,
  markForAdvancement,
  markAttackAdvancement,
} = await import('../src/documents/item.ts')

const { castInherent } =
  await import('../src/actors/inherent.ts')

function createActor() {
  const items = []
  const updates = []

  items.get = (id) =>
    items.find((item) => item.id === id)

  return {
    type: 'crawler',
    isOwner: true,
    items,
    updates,

    async updateEmbeddedDocuments(type, changes) {
      assert.equal(type, 'Item')

      for (const change of changes) {
        const item = items.get(change._id)

        assert.ok(
          item,
          `Cannot update nonexistent Item: ${change._id}`
        )

        updates.push(change)
        item.system.marked = change['system.marked']
      }
    },
  }
}

function createItem(actor, options = {}) {
  const {
    id = 'fireball-test',
    name = 'Fireball',
    type = 'spell',
    usage = 'learned',
    embedded = true,
    marked = false,
  } = options

  const item = {
    id,
    name,
    type,
    actor,
    system: {
      usage,
      marked,
    },
  }

  if (embedded) {
    actor.items.push(item)
  }

  return item
}

test('temporary inherent spells are not marked for advancement', async () => {
  const actor = createActor()

  const spell = createItem(actor, {
    usage: 'inherent',
    embedded: false,
  })

  await markAttackAdvancement(actor, [spell])

  assert.equal(actor.updates.length, 0)
  assert.equal(actor.items.length, 0)
  assert.equal(spell.system.marked, false)
})

test('learned spells retain normal advancement behavior', async () => {
  const actor = createActor()

  const spell = createItem(actor, {
    usage: 'learned',
  })

  await markForAdvancement([spell])

  assert.equal(actor.updates.length, 1)
  assert.equal(spell.system.marked, true)
})

test('embedded inherent spells retain existing advancement behavior', async () => {
  const actor = createActor()

  const spell = createItem(actor, {
    usage: 'inherent',
    embedded: true,
  })

  await markForAdvancement([spell])

  assert.equal(actor.updates.length, 1)
  assert.equal(spell.system.marked, true)
})

test('temporary spells do not compete with damage effect skills for advancement', async () => {
  const actor = createActor()

  const spell = createItem(actor, {
    usage: 'inherent',
    embedded: false,
  })

  const skill = createItem(actor, {
    id: 'damage-effect-test',
    name: 'Damage Effect',
    type: 'skill',
  })

  await markAttackAdvancement(
    actor,
    [spell],
    [skill.name],
  )

  assert.equal(actor.updates.length, 1)
  assert.equal(skill.system.marked, true)
  assert.equal(spell.system.marked, false)
  assert.equal(actor.updates[0]._id, skill.id)
})

function spellData() {
  return {
    _id: 'fireball-source',
    name: 'Fireball',
    type: 'spell',
    img: 'icons/svg/fire.svg',
    system: {
      usage: 'learned',
      stat: 'INT',
      isAttack: true,
      checkType: 'Attack',
      cooldown: '',
      manaCost: 5,
      marked: false,
      rank: {
        value: 1,
        override: null,
      },
      damage: {
        formula: '1d6+@intMod',
        types: ['Fire'],
      },
    },
  }
}

// Simulate Foundry's preparation of a spell document.
class TestSpell extends CrawlItem {
  constructor(data, { parent }) {
    super()

    Object.assign(this, {
      ...data,
      id: data._id,
      actor: parent,
    })

    this.system.rank.total =
      this.system.rank.override ?? this.system.rank.value

    this.system.rank.mod =
      parent.system.statMod(this.system.stat)
  }
}

globalThis.CONFIG = {
  Item: { documentClass: TestSpell },
}

globalThis.CONST = {
  ACTIVE_EFFECT_SHOW_ICON: { NEVER: 0 },
}

globalThis.ui = {
  notifications: {
    warn() {},
  },
}

let nextId = 0

globalThis.foundry = {
  utils: {
    deepClone: structuredClone,
    randomID: () => `temporary-${++nextId}`,

    // Merge the spell data and its granted Rank.
    mergeObject(base, patch) {
      return {
        ...base,
        ...patch,
        system: {
          ...base.system,
          ...patch.system,
          rank: {
            ...base.system.rank,
            ...patch.system.rank,
          },
        },
      }
    },
  },
}

Object.assign(game, {
  user: { targets: new Set() },
  time: { worldTime: 1000 },
  packs: [],
  items: [{
    name: 'Fireball',
    type: 'spell',
    toObject: spellData,
  }],
})

function createCastingActor() {
  const actor = createActor()

  Object.assign(actor, {
    uuid: 'Actor.casting-test',
    name: 'Test Crawler',
    statuses: new Set(),
    effects: [],
    rollCount: 0,

    system: {
      attacks: [],
      mana: { value: 10 },
      statMod: (stat) => stat === 'INT' ? 3 : 1,

      specials: [{
        type: 'inherentSpell',
        target: 'Fireball',
        value: '1',
        cooldown: '5 minutes',
        itemId: 'scroll-test',
        effectId: 'grant-test',
        source: 'Scroll of Fireball',
      }],
    },

    async update(changes) {
      if ('system.mana.value' in changes) {
        this.system.mana.value =
          changes['system.mana.value']
      }
    },

    async createEmbeddedDocuments(type, documents) {
      assert.equal(type, 'ActiveEffect')

      const effects = documents.map((data) => ({
        ...data,
        id: `effect-${++nextId}`,

        getFlag(scope, key) {
          return this.flags?.[scope]?.[key]
        },
      }))

      this.effects.push(...effects)
      return effects
    },

    async deleteEmbeddedDocuments(type, ids) {
      assert.equal(type, 'ActiveEffect')

      this.effects = this.effects.filter(
        (effect) => !ids.includes(effect.id)
      )
    },
  })

  return actor
}

test('granted inherent attack spells retain their stats and consume no mana', async () => {
  const actor = createCastingActor()

  const result = await castInherent(actor, 'Fireball', 1)

  assert.ok(result)
  assert.equal(actor.lastAttack.toHit, 4)
  assert.equal(actor.lastAttack.modifiers[1].stat, 'int')
  assert.equal(actor.lastAttack.damage.formula, '1d6+@intMod')
  assert.deepEqual(actor.lastAttack.damage.types, ['Fire'])
  assert.equal(actor.lastAttack.damage.magic, true)

  assert.equal(actor.system.mana.value, 10)
  assert.equal(actor.items.length, 0)
  assert.equal(actor.updates.length, 0)
})

test('granted inherent spells start a cooldown and cannot immediately recast', async () => {
  const actor = createCastingActor()

  assert.ok(await castInherent(actor, 'Fireball', 1))

  assert.equal(actor.effects.length, 1)
  assert.equal(
    actor.effects[0].getFlag('crawlspace', 'cooldownEnd'),
    game.time.worldTime + 300
  )

  const result = await castInherent(actor, 'Fireball', 1)

  assert.equal(result, null)
  assert.equal(actor.rollCount, 1)
  assert.equal(actor.effects.length, 1)
})

test('cancelled inherent spell casts do not start a cooldown', async () => {
  const actor = createCastingActor()
  actor.cancelCast = true

  const result = await castInherent(actor, 'Fireball', 1)

  assert.equal(result, null)
  assert.equal(actor.effects.length, 0)
  assert.equal(actor.system.mana.value, 10)
  assert.equal(actor.updates.length, 0)
})

test('learned attack spells still consume mana and mark advancement', async () => {
  const actor = createCastingActor()

  const spell = new TestSpell(spellData(), {
    parent: actor,
  })

  actor.items.push(spell)

  const result = await spell.use()

  assert.ok(result)
  assert.equal(actor.lastAttack.toHit, 4)
  assert.equal(actor.system.mana.value, 5)
  assert.equal(spell.system.marked, true)
  assert.equal(actor.updates.length, 1)
})