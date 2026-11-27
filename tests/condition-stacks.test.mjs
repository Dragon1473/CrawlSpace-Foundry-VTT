import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { extname } from 'node:path'

// Resolve extensionless TypeScript imports.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !extname(specifier)) {
      return nextResolve(specifier + '.ts', context)
    }

    return nextResolve(specifier, context)
  },
})

const {
  removeStack,
  reduceStatus,
  reduceConditionStacks,
} = await import('../src/effects/stacks.ts')

function createEffect(stacks = 1, statusId = 'poisoned') {
  return {
    id: statusId + '-test',
    name: statusId,
    statuses: new Set([statusId]),

    system: {
      stacks,
      maxStacks: 10,
    },

    deleted: false,
    updates: [],

    async update(changes) {
      this.updates.push(changes)

      if ('system.stacks' in changes) {
        this.system.stacks = changes['system.stacks']
      }

      return this
    },

    async delete() {
      this.deleted = true
      return this
    },
  }
}

function createActor(effects = []) {
  return {
    effects,

    async deleteEmbeddedDocuments(type, ids) {
      assert.equal(type, 'ActiveEffect')

      for (const effect of this.effects) {
        if (ids.includes(effect.id)) {
          await effect.delete()
        }
      }

      this.effects = this.effects.filter(
        (effect) => !ids.includes(effect.id)
      )
    },
  }
}

test('removing one stack preserves the remaining stacks', async () => {
  const effect = createEffect(3)

  await removeStack(effect)

  assert.equal(effect.system.stacks, 2)
  assert.equal(effect.deleted, false)
  assert.equal(effect.updates.length, 1)
})

test('removing the final stack deletes the condition', async () => {
  const effect = createEffect(1)

  await removeStack(effect)

  assert.equal(effect.deleted, true)
  assert.equal(effect.updates.length, 0)
})

test('reducing a non-stackable condition deletes it', async () => {
  const effect = createEffect(1, 'blinded')

  await removeStack(effect)

  assert.equal(effect.deleted, true)
})

test('reducing a condition that is not present does nothing', async () => {
  const unrelated = createEffect(3, 'blood-trail')
  const actor = createActor([unrelated])

  await reduceStatus(actor, 'poisoned')

  assert.equal(unrelated.system.stacks, 3)
  assert.equal(unrelated.deleted, false)
  assert.equal(unrelated.updates.length, 0)
})

test('removing multiple stacks updates the condition once', async () => {
  const effect = createEffect(5)

  await removeStack(effect, 2)

  assert.equal(effect.system.stacks, 3)
  assert.equal(effect.deleted, false)
  assert.equal(effect.updates.length, 1)
})

test('removing exactly the remaining stacks deletes the condition', async () => {
  const effect = createEffect(3)

  await removeStack(effect, 3)

  assert.equal(effect.deleted, true)
  assert.equal(effect.updates.length, 0)
})

test('removing more stacks than remain deletes the condition', async () => {
  const effect = createEffect(3)

  await removeStack(effect, 5)

  assert.equal(effect.deleted, true)
  assert.equal(effect.updates.length, 0)
})

test('removing zero stacks leaves the condition unchanged', async () => {
  const effect = createEffect(3)

  await removeStack(effect, 0)

  assert.equal(effect.system.stacks, 3)
  assert.equal(effect.deleted, false)
  assert.equal(effect.updates.length, 0)
})

test('negative stack reductions leave the condition unchanged', async () => {
  const effect = createEffect(3)

  await removeStack(effect, -2)

  assert.equal(effect.system.stacks, 3)
  assert.equal(effect.deleted, false)
  assert.equal(effect.updates.length, 0)
})

test('fractional stack reductions round down', async () => {
  const effect = createEffect(5)

  await removeStack(effect, 2.8)

  assert.equal(effect.system.stacks, 3)
  assert.equal(effect.deleted, false)
  assert.equal(effect.updates.length, 1)
})

test('invalid stack reductions leave the condition unchanged', async () => {
  const effect = createEffect(3)

  for (const amount of [NaN, Infinity, -Infinity, 'invalid']) {
    await removeStack(effect, amount)
  }

  assert.equal(effect.system.stacks, 3)
  assert.equal(effect.deleted, false)
  assert.equal(effect.updates.length, 0)
})

test('actor-level reduction removes the requested number of stacks', async () => {
  const poisoned = createEffect(5)
  const actor = createActor([poisoned])

  await reduceConditionStacks(actor, 'poisoned', 2)

  assert.equal(poisoned.system.stacks, 3)
  assert.equal(poisoned.deleted, false)
  assert.equal(poisoned.updates.length, 1)
})

test('actor-level reduction deletes an exhausted condition', async () => {
  const poisoned = createEffect(2)
  const actor = createActor([poisoned])

  await reduceConditionStacks(actor, 'poisoned', 2)

  assert.equal(poisoned.deleted, true)
})

test('actor-level reduction leaves unrelated conditions unchanged', async () => {
  const poisoned = createEffect(3)
  const fatigued = createEffect(4, 'fatigued')
  const actor = createActor([poisoned, fatigued])

  await reduceConditionStacks(actor, 'poisoned', 1)

  assert.equal(poisoned.system.stacks, 2)
  assert.equal(fatigued.system.stacks, 4)
  assert.equal(fatigued.updates.length, 0)
  assert.equal(fatigued.deleted, false)
})

test('actor-level reduction ignores missing conditions', async () => {
  const actor = createActor()

  await reduceConditionStacks(actor, 'poisoned', 3)

  assert.equal(actor.effects.length, 0)
})

test('actor-level reduction spans multiple matching effects', async () => {
  const first = createEffect(2)
  const second = createEffect(4)

  first.id = 'poisoned-first'
  second.id = 'poisoned-second'

  const actor = createActor([first, second])

  await reduceConditionStacks(actor, 'poisoned', 3)

  assert.equal(first.deleted, true)
  assert.equal(second.deleted, false)
  assert.equal(second.system.stacks, 3)
})

test('actor-level reduction defaults to one stack', async () => {
  const poisoned = createEffect(3)
  const actor = createActor([poisoned])

  await reduceConditionStacks(actor, 'poisoned')

  assert.equal(poisoned.system.stacks, 2)
})

test('actor-level reduction ignores invalid amounts', async () => {
  const poisoned = createEffect(3)
  const actor = createActor([poisoned])

  for (const amount of [0, -1, NaN, Infinity]) {
    await reduceConditionStacks(actor, 'poisoned', amount)
  }

  assert.equal(poisoned.system.stacks, 3)
  assert.equal(poisoned.updates.length, 0)
  assert.equal(poisoned.deleted, false)
})

test('legacy reduceStatus removes one stack by default', async () => {
  const poisoned = createEffect(3)
  const actor = createActor([poisoned])

  await reduceStatus(actor, 'poisoned')

  assert.equal(poisoned.system.stacks, 2)
  assert.equal(poisoned.deleted, false)
})

test('legacy reduceStatus can still remove all matching effects', async () => {
  const poisoned = createEffect(3)
  const fatigued = createEffect(2, 'fatigued')
  const actor = createActor([poisoned, fatigued])

  await reduceStatus(actor, 'poisoned', true)

  assert.equal(poisoned.deleted, true)
  assert.equal(fatigued.deleted, false)
  assert.equal(actor.effects.length, 1)
})

test('actor-level reduction removes non-stackable conditions', async () => {
  const blinded = createEffect(1, 'blinded')
  const actor = createActor([blinded])

  await reduceConditionStacks(actor, 'blinded', 1)

  assert.equal(blinded.deleted, true)
})
test('actor-level reduction skips disabled conditions', async () => {
  const disabled = createEffect(3, 'poisoned')
  const active = createEffect(3, 'poisoned')

  disabled.disabled = true

  const actor = createActor([disabled, active])

  await reduceConditionStacks(actor, 'poisoned', 2)

  assert.equal(disabled.system.stacks, 3)
  assert.equal(active.system.stacks, 1)
})

test('actor-level reduction skips expired conditions', async () => {
  const expired = createEffect(3, 'poisoned')
  const active = createEffect(3, 'poisoned')

  expired.duration = { expired: true }

  const actor = createActor([expired, active])

  await reduceConditionStacks(actor, 'poisoned', 2)

  assert.equal(expired.system.stacks, 3)
  assert.equal(active.system.stacks, 1)
})