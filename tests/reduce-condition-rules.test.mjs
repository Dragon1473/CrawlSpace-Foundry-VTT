import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { extname } from 'node:path'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !extname(specifier)) {
      return nextResolve(specifier + '.ts', context)
    }

    return nextResolve(specifier, context)
  },
})

globalThis.game = {
  i18n: {
    localize: (key) => key,
  },
  items: [],
  packs: [],
}

const {
  ruleById,
  ruleTypeOf,
  newChange,
  ruleTypeChoices,
  rulesContext,
} = await import('../src/effects/rules.ts')

const { unwrapTriggered } =
  await import('../src/effects/trigger-events.ts')

test('Apply Condition retains its existing default trigger and target', () => {
  const change = newChange('applyCondition')
  const triggered = unwrapTriggered(change)

  assert.ok(triggered)
  assert.equal(triggered.when, 'rollAmazing')
  assert.equal(triggered.change.key, 'applyCondition')

  const data = JSON.parse(triggered.change.value)

  assert.equal(data.stacks, 1)
  assert.equal(data.target, 'other')
})

test('Reduce Condition is a recognized special rule', () => {
  const rule = ruleById('reduceCondition')

  assert.equal(rule.id, 'reduceCondition')

  assert.deepEqual(
    rule.fields.map(({ name, kind }) => ({ name, kind })),
    [
      { name: 'condition', kind: 'debuff' },
      { name: 'stacks', kind: 'number' },
      { name: 'target', kind: 'applyTarget' },
    ]
  )
})

test('Reduce Condition correctly serializes and reads its values', () => {
  const rule = ruleById('reduceCondition')

  const values = {
    condition: 'Poisoned',
    stacks: 2,
    target: 'other',
  }

  const change = rule.write(values)

  assert.equal(change.key, 'reduceCondition')
  assert.equal(change.type, 'crawlspace.special')
  assert.equal(ruleTypeOf(change).id, 'reduceCondition')
  assert.deepEqual(JSON.parse(change.value), values)
  assert.deepEqual(rule.read(change), values)
})

test('new Reduce Condition rules default to self on consumption', () => {
  const change = newChange('reduceCondition')
  const triggered = unwrapTriggered(change)

  assert.ok(triggered)
  assert.equal(triggered.when, 'onConsume')
  assert.equal(triggered.change.key, 'reduceCondition')

  const data = JSON.parse(triggered.change.value)

  assert.equal(data.stacks, 1)
  assert.equal(data.target, 'self')
  assert.ok(data.condition)
})

test('Reduce Condition appears in the Special rule category', () => {
  const categories = ruleTypeChoices()

  const special = categories.find(
    (category) =>
      category.label === 'CRAWLSPACE.Rules.Category.special'
  )

  assert.ok(special)

  assert.ok(
    special.rules.some(
      (rule) => rule.value === 'reduceCondition'
    )
  )
})

test('Reduce Condition exposes the consumption trigger but not Always', () => {
  const change = newChange('reduceCondition')

  const [context] = rulesContext({
    system: {
      changes: [change],
    },
  })

  const when = context.fields.find(
    (field) => field.name === 'when'
  )

  const options = when.groups.flatMap(
    (group) => group.options.map((option) => option.value)
  )

  assert.ok(options.includes('onConsume'))
  assert.ok(options.includes('rollAnySuccess'))
  assert.ok(!options.includes('always'))
})