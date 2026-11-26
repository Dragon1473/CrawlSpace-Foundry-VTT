import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { extname } from 'node:path'

// Isolate attack resolution from Foundry-specific runtime modules.
const stubs = {
  './item-value': `
    export function recordUse() {}
  `,
  '../effects/use-conditions': `
    export function applyCastEffects() {}
    export function itemCardDetails() {}
  `,
  '../documents/item': `
    export function markAttackAdvancement() {}
  `,
  '../dice/rolls': `
    export function penaltyModifiers() { return [] }
    export function rollAttack() {}
    export function rollDamage() {}
  `,
  '../effects/killing-blows': `
    export function spellKillBonus() { return 0 }
  `,
}

// Resolve TypeScript imports and substitute runtime dependencies.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      context.parentURL?.endsWith('/src/actors/attacks.ts') &&
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

globalThis.game = {
  user: { targets: new Set() },
  i18n: {
    localize: (key) => key,
    format: (key) => key,
  },
}

const { resolveAttack, rowForItem } =
  await import('../src/actors/attacks.ts')


function createSpell() {
  return {
    id: 'fireball-test',
    name: 'Fireball',
    type: 'spell',
    img: 'icons/svg/fire.svg',

    system: {
      usage: 'inherent',
      stat: 'INT',
      rank: {
        total: 1,
        mod: 3,
      },
      damage: {
        formula: '1d6+@intMod',
        types: ['Fire'],
      },
    },

    checkModifiers() {
      return [
        { label: 'Rank of Fireball', value: 1 },
        { label: 'Intelligence', value: 3, stat: 'int' },
      ]
    },

    async payMana() {
      return true
    },
  }
}

function createActor(ownedItems = []) {
  const items = [...ownedItems]

  items.get = (id) =>
    items.find((item) => item.id === id)

  return {
    items,
    system: {
      attacks: [],
      specials: [],
      statMod: (stat) => stat === 'INT' ? 3 : 1,
    },
  }
}

test('an embedded attack spell uses its stat and rank', () => {
  const spell = createSpell()
  const actor = createActor([spell])

  const attack = resolveAttack(actor, rowForItem(spell))

  assert.equal(attack.toHit, 4)
  assert.equal(attack.modifiers[1].stat, 'int')
  assert.equal(attack.damage.formula, '1d6+@intMod')
  assert.deepEqual(attack.damage.types, ['Fire'])
  assert.equal(attack.damage.magic, true)
})

test('a temporary inherent attack spell retains its stat and rank', () => {
  const spell = createSpell()

  // The temporary spell is not in the actor's inventory.
  const actor = createActor()

  const attack = resolveAttack(
    actor,
    rowForItem(spell),
    spell,
  )

  assert.equal(attack.toHit, 4)
  assert.equal(attack.modifiers[1].stat, 'int')
  assert.equal(attack.damage.formula, '1d6+@intMod')
  assert.deepEqual(attack.damage.types, ['Fire'])
  assert.equal(attack.damage.magic, true)
  assert.equal(attack.item, spell)
  assert.equal(actor.items.length, 0)
})