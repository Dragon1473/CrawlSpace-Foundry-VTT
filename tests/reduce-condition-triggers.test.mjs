import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { extname } from 'node:path'

const itemModuleStubs = {
  '../effects/use-conditions': `
    export async function applyCastEffects() {}
    export function conditionRows() { return '' }
    export async function itemCardDetails() { return '' }
  `,
  '../loot/boxes': `
    export async function openLootBoxes() {}
  `,
  '../actors/item-value': `
    export async function recordUse() {}
  `,
  '../import/convert': `
    export function buildEffect() {}
    export function effectDuration() { return null }
    export function stableId() { return '' }
  `,
  '../data/items': `
    export const BUILD_EFFECT_FIELDS = []
  `,
  '../rules/hands': `
    export function isHandItem() { return false }
  `,
  '../effects/cooldowns': `
    export function itemCooldown() {}
    export async function withCooldowns(actor, cooldowns, action) {
      return action()
    }
  `,
  '../dice/rolls': `
    export function penaltyModifiers() { return [] }
    export async function rollAttack() {}
    export async function rollCheck() {}
    export async function rollDamage() {}
    export function speakerFor() {}
  `,
  '../tokens/animations': `
    export function playItemAnimation() {}
  `,
  '../actors/attacks': `
    export function attackWithRow() {}
    export function resolveAttack() {}
    export function rowForItem() {}
    export function withEffectBonuses() {}
  `,
  '../rules/damage-effects': `
    export function advancementPick() {}
  `,
}

const socketModuleStubs = {
  './apps/upkeep': `
    export function gmAllowsAutomation() {}
    export async function performUpkeep() {}
    export async function postUpkeepRequest() {}
    export function upkeepAutomated() {}
  `,
  './apps/builder': `
    export async function createBuiltCrawler() {}
  `,
  './effects/use-conditions': `
    export async function giveCondition() {}
    export function mayGive() { return false }
  `,
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
    context.parentURL?.endsWith('/src/socket.ts') &&
    Object.hasOwn(socketModuleStubs, specifier)
    ) {
    return nextResolve(
        'data:text/javascript,' +
        encodeURIComponent(socketModuleStubs[specifier]),
        context
    )
    }
    if (
    context.parentURL?.endsWith('/src/documents/item.ts') &&
    Object.hasOwn(itemModuleStubs, specifier)
    ) {
    return nextResolve(
        'data:text/javascript,' +
        encodeURIComponent(itemModuleStubs[specifier]),
        context
    )
    }
    // Stub the unrelated condition application module.
    if (
      specifier === './use-conditions' &&
      context.parentURL?.endsWith('/src/effects/triggers.ts')
    ) {
      return nextResolve(
        'data:text/javascript,export async function giveCondition() {}',
        context
      )
    }

    if (specifier.startsWith('.') && !extname(specifier)) {
      return nextResolve(specifier + '.ts', context)
    }

    return nextResolve(specifier, context)
  },
})

globalThis.game = {
  user: {
    isActiveGM: true,
  },
}

const {
  fireTriggers,
  consumableReductionEntries,
  prepareConsumableReductions,
  executeConsumableReductions,
  consumableRequest,
} = await import('../src/effects/triggers.ts')

const { wrapTriggered } =
  await import('../src/effects/trigger-events.ts')

function createEffect(statusId = 'poisoned', stacks = 3) {
  return {
    id: statusId + '-test',
    statuses: new Set([statusId]),
    system: {
      stacks,
      maxStacks: 10,
    },
    deleted: false,

    async update(changes) {
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

function createActor(effects = [], triggers = []) {
  effects.get = (id) =>
    effects.find((effect) => effect.id === id)

  return {
    items: new Map(),
    effects,
    system: {
      triggers,
    },
    createdEffects: [],

    async createEmbeddedDocuments(type, data) {
      assert.equal(type, 'ActiveEffect')
      this.createdEffects.push(...data)
      return data
    },
  }
}

function createTrigger(data = {}, options = {}) {
  return {
    when: 'rollAnySuccess',
    timing: 'before',
    source: 'First Aid',
    itemId: 'first-aid-test',
    itemName: 'First Aid',
    itemType: 'skill',
    effectId: 'effect-test',
    index: 0,

    change: {
      key: 'reduceCondition',
      type: 'crawlspace.special',
      value: JSON.stringify({
        condition: 'Poisoned',
        stacks: 1,
        target: 'self',
        ...data,
      }),
    },

    ...options,
  }
}

const context = (other, extra = {}) => ({
  timing: 'before',
  afterPhase: false,
  sources: ['First Aid'],
  other,
  ...extra,
})

test('triggered Reduce Condition removes stacks from self', async () => {
  const poisoned = createEffect('poisoned', 3)

  const actor = createActor(
    [poisoned],
    [createTrigger({ stacks: 2 })]
  )

  await fireTriggers(
    actor,
    ['rollAnySuccess'],
    context()
  )

  assert.equal(poisoned.system.stacks, 1)
  assert.equal(poisoned.deleted, false)
  assert.equal(actor.createdEffects.length, 0)
})

test('triggered Reduce Condition removes stacks from the other actor', async () => {
  const ownPoison = createEffect('poisoned', 3)
  const otherPoison = createEffect('poisoned', 4)

  const actor = createActor(
    [ownPoison],
    [createTrigger({ stacks: 2, target: 'other' })]
  )

  const other = createActor([otherPoison])

  await fireTriggers(
    actor,
    ['rollAnySuccess'],
    context(other)
  )

  assert.equal(ownPoison.system.stacks, 3)
  assert.equal(otherPoison.system.stacks, 2)
  assert.equal(actor.createdEffects.length, 0)
})

test('triggered Reduce Condition deletes an exhausted condition', async () => {
  const poisoned = createEffect('poisoned', 2)

  const actor = createActor(
    [poisoned],
    [createTrigger({ stacks: 2 })]
  )

  await fireTriggers(
    actor,
    ['rollAnySuccess'],
    context()
  )

  assert.equal(poisoned.deleted, true)
  assert.equal(actor.createdEffects.length, 0)
})

test('Reduce Condition does nothing when its condition is absent', async () => {
  const fatigued = createEffect('fatigued', 3)

  const actor = createActor(
    [fatigued],
    [createTrigger()]
  )

  await fireTriggers(
    actor,
    ['rollAnySuccess'],
    context()
  )

  assert.equal(fatigued.system.stacks, 3)
  assert.equal(fatigued.deleted, false)
  assert.equal(actor.createdEffects.length, 0)
})

test('Reduce Condition does not fall back to self when other is missing', async () => {
  const poisoned = createEffect('poisoned', 3)

  const actor = createActor(
    [poisoned],
    [createTrigger({ target: 'other' })]
  )

  await fireTriggers(
    actor,
    ['rollAnySuccess'],
    context()
  )

  assert.equal(poisoned.system.stacks, 3)
  assert.equal(poisoned.deleted, false)
  assert.equal(actor.createdEffects.length, 0)
})

test('Reduce Condition ignores invalid stack amounts', async () => {
  const poisoned = createEffect('poisoned', 3)

  const actor = createActor(
    [poisoned],
    [
      createTrigger({ stacks: 0 }),
      createTrigger({ stacks: -2 }),
      createTrigger({ stacks: 'invalid' }),
    ]
  )

  await fireTriggers(
    actor,
    ['rollAnySuccess'],
    context()
  )

  assert.equal(poisoned.system.stacks, 3)
  assert.equal(poisoned.deleted, false)
  assert.equal(actor.createdEffects.length, 0)
})

test('Reduce Condition does not execute on an unrelated event', async () => {
  const poisoned = createEffect('poisoned', 3)

  const actor = createActor(
    [poisoned],
    [createTrigger()]
  )

  await fireTriggers(
    actor,
    ['rollAnyFail'],
    context()
  )

  assert.equal(poisoned.system.stacks, 3)
  assert.equal(actor.createdEffects.length, 0)
})

test('Reduce Condition does not execute for an unrelated skill', async () => {
  const poisoned = createEffect('poisoned', 3)

  const actor = createActor(
    [poisoned],
    [createTrigger()]
  )

  await fireTriggers(
    actor,
    ['rollAnySuccess'],
    context(undefined, {
      sources: ['Swimming'],
    })
  )

  assert.equal(poisoned.system.stacks, 3)
  assert.equal(actor.createdEffects.length, 0)
})

test('Reduce Condition respects configured trigger timing', async () => {
  const poisoned = createEffect('poisoned', 3)

  const actor = createActor(
    [poisoned],
    [createTrigger({}, { timing: 'after' })]
  )

  await fireTriggers(
    actor,
    ['rollAnySuccess'],
    context(undefined, {
      timing: 'before',
      afterPhase: true,
    })
  )

  assert.equal(poisoned.system.stacks, 3)
  assert.equal(actor.createdEffects.length, 0)
})

test('Reduce Condition resolves case-insensitive condition names', async () => {
  const poisoned = createEffect('poisoned', 3)

  const actor = createActor(
    [poisoned],
    [createTrigger({ condition: '  POISONED  ' })]
  )

  await fireTriggers(
    actor,
    ['rollAnySuccess'],
    context()
  )

  assert.equal(poisoned.system.stacks, 2)
  assert.equal(actor.createdEffects.length, 0)
})

test('Reduce Condition ignores an empty condition name', async () => {
  const poisoned = createEffect('poisoned', 3)

  const actor = createActor(
    [poisoned],
    [createTrigger({ condition: '' })]
  )

  await fireTriggers(
    actor,
    ['rollAnySuccess'],
    context()
  )

  assert.equal(poisoned.system.stacks, 3)
  assert.equal(actor.createdEffects.length, 0)
})

test('Reduce Condition defaults to one stack when no count is supplied', async () => {
  const poisoned = createEffect('poisoned', 3)

  const actor = createActor(
    [poisoned],
    [createTrigger({ stacks: undefined })]
  )

  await fireTriggers(
    actor,
    ['rollAnySuccess'],
    context()
  )

  assert.equal(poisoned.system.stacks, 2)
  assert.equal(actor.createdEffects.length, 0)
})

function createConsumptionChange(data = {}, when = 'onConsume') {
  return wrapTriggered(
    createTrigger(data).change,
    when
  )
}

function createItemEffect(changes = [], options = {}) {
  return {
    id: 'antidote-effect',
    name: 'Antidote Effect',
    disabled: false,
    transfer: false,

    system: {
      changes,
    },

    ...options,
  }
}

function createConsumable(effects = [], options = {}) {
  return {
    id: 'antidote-test',
    name: 'Antidote',
    type: 'consumable',
    effects,

    system: {
      quantity: 5,
    },

    ...options,
  }
}

test('collects Reduce Condition rules from a consumable', () => {
  const change = createConsumptionChange({
    condition: 'Poisoned',
    stacks: 2,
  })

  const item = createConsumable([
    createItemEffect([change]),
  ])

  const entries = consumableReductionEntries(item)

  assert.equal(entries.length, 1)
  assert.equal(entries[0].when, 'onConsume')
  assert.equal(entries[0].change.key, 'reduceCondition')

  assert.deepEqual(
    JSON.parse(entries[0].change.value),
    {
      condition: 'Poisoned',
      stacks: 2,
      target: 'self',
    }
  )
})

test('collects multiple consumption rules on the same item', () => {
  const item = createConsumable([
    createItemEffect([
      createConsumptionChange({ condition: 'Poisoned' }),
      createConsumptionChange({ condition: 'Fatigued' }),
    ]),
  ])

  const entries = consumableReductionEntries(item)

  assert.equal(entries.length, 2)
})

test('ignores disabled consumable effects', () => {
  const item = createConsumable([
    createItemEffect(
      [createConsumptionChange()],
      { disabled: true }
    ),
  ])

  assert.equal(consumableReductionEntries(item).length, 0)
})

test('ignores Reduce Condition rules with other triggers', () => {
  const item = createConsumable([
    createItemEffect([
      createConsumptionChange({}, 'rollAnySuccess'),
    ]),
  ])

  assert.equal(consumableReductionEntries(item).length, 0)
})

test('ignores unrelated rules on consumption', () => {
  const change = wrapTriggered(
    {
      key: 'note',
      type: 'crawlspace.special',
      value: JSON.stringify({ text: 'A note' }),
    },
    'onConsume'
  )

  const item = createConsumable([
    createItemEffect([change]),
  ])

  assert.equal(consumableReductionEntries(item).length, 0)
})

test('collects consumption rules regardless of transfer setting', () => {
  const item = createConsumable([
    createItemEffect(
      [createConsumptionChange()],
      { transfer: true }
    ),
    createItemEffect(
      [createConsumptionChange()],
      { id: 'second-effect', transfer: false }
    ),
  ])

  assert.equal(consumableReductionEntries(item).length, 2)
})

test('does not collect consumption rules from non-consumables', () => {
  const item = createConsumable(
    [createItemEffect([createConsumptionChange()])],
    { type: 'equipment' }
  )

  assert.equal(consumableReductionEntries(item).length, 0)
})

test('ignores unwrapped passive Reduce Condition rules', () => {
  const item = createConsumable([
    createItemEffect([
      createTrigger().change,
    ]),
  ])

  assert.equal(consumableReductionEntries(item).length, 0)
})

test('ignores consumption rules with an incorrect change type', () => {
  const change = wrapTriggered(
    {
      ...createTrigger().change,
      type: 'add',
    },
    'onConsume'
  )

  const item = createConsumable([
    createItemEffect([change]),
  ])

  assert.equal(consumableReductionEntries(item).length, 0)
})

function createReductionConsumable(target = 'self') {
  return createConsumable([
    createItemEffect([
      createConsumptionChange({ target }),
    ]),
  ])
}

function createTargetActor(isOwner = true) {
  return {
    documentName: 'Actor',
    uuid: 'Actor.target-test',
    name: 'Target Crawler',
    isOwner,
  }
}

test('consumables without reduction rules require no target validation', () => {
  const item = createConsumable()

  const plan = prepareConsumableReductions(item, [], false)

  assert.equal(plan.ok, true)
  assert.equal(plan.entries.length, 0)
  assert.equal(plan.other, null)
})

test('self-targeted consumption requires no selected target or GM', () => {
  const item = createReductionConsumable('self')

  const plan = prepareConsumableReductions(item, [], false)

  assert.equal(plan.ok, true)
  assert.equal(plan.entries.length, 1)
  assert.equal(plan.other, null)
})

test('self-targeted consumption ignores selected targets', () => {
  const item = createReductionConsumable('self')
  const target = createTargetActor(false)

  const plan = prepareConsumableReductions(
    item,
    [target],
    false
  )

  assert.equal(plan.ok, true)
  assert.equal(plan.other, null)
})

test('other-targeted consumption requires a selected target', () => {
  const item = createReductionConsumable('other')

  const plan = prepareConsumableReductions(item, [], true)

  assert.equal(plan.ok, false)
  assert.equal(plan.reason, 'singleTarget')
})

test('other-targeted consumption rejects multiple targets', () => {
  const item = createReductionConsumable('other')

  const plan = prepareConsumableReductions(
    item,
    [createTargetActor(), createTargetActor()],
    true
  )

  assert.equal(plan.ok, false)
  assert.equal(plan.reason, 'singleTarget')
})

test('other-targeted consumption accepts an owned actor', () => {
  const item = createReductionConsumable('other')
  const target = createTargetActor(true)

  const plan = prepareConsumableReductions(
    item,
    [target],
    false
  )

  assert.equal(plan.ok, true)
  assert.equal(plan.other, target)
  assert.equal(plan.entries.length, 1)
})

test('other-targeted consumption accepts an unowned actor when a GM is available', () => {
  const item = createReductionConsumable('other')
  const target = createTargetActor(false)

  const plan = prepareConsumableReductions(
    item,
    [target],
    true
  )

  assert.equal(plan.ok, true)
  assert.equal(plan.other, target)
})

test('other-targeted consumption rejects an unowned actor without a GM', () => {
  const item = createReductionConsumable('other')
  const target = createTargetActor(false)

  const plan = prepareConsumableReductions(
    item,
    [target],
    false
  )

  assert.equal(plan.ok, false)
  assert.equal(plan.reason, 'needGM')
})

test('mixed self and other consumption rules require a valid other target', () => {
  const item = createConsumable([
    createItemEffect([
      createConsumptionChange({ target: 'self' }),
      createConsumptionChange({ target: 'other' }),
    ]),
  ])

  const invalidPlan = prepareConsumableReductions(
    item,
    [],
    false
  )

  assert.equal(invalidPlan.ok, false)

  const target = createTargetActor(true)

  const validPlan = prepareConsumableReductions(
    item,
    [target],
    false
  )

  assert.equal(validPlan.ok, true)
  assert.equal(validPlan.entries.length, 2)
})

test('other-targeted consumption rejects a missing actor', () => {
  const item = createReductionConsumable('other')

  const plan = prepareConsumableReductions(
    item,
    [null],
    true
  )

  assert.equal(plan.ok, false)
  assert.equal(plan.reason, 'singleTarget')
})

test('other-targeted consumption rejects non-Actor documents', () => {
  const item = createReductionConsumable('other')

  const target = {
    ...createTargetActor(),
    documentName: 'Item',
  }

  const plan = prepareConsumableReductions(
    item,
    [target],
    true
  )

  assert.equal(plan.ok, false)
  assert.equal(plan.reason, 'singleTarget')
})

test('other-targeted consumption rejects actors without a UUID', () => {
  const item = createReductionConsumable('other')

  const target = {
    ...createTargetActor(),
    uuid: '',
  }

  const plan = prepareConsumableReductions(
    item,
    [target],
    true
  )

  assert.equal(plan.ok, false)
  assert.equal(plan.reason, 'singleTarget')
})

test('consumption execution reduces conditions on self', async () => {
  const poisoned = createEffect('poisoned', 3)
  const actor = createActor([poisoned])
  const item = createReductionConsumable('self')

  const plan = prepareConsumableReductions(item, [], false)

  assert.equal(plan.ok, true)

  await executeConsumableReductions(actor, plan)

  assert.equal(poisoned.system.stacks, 2)
  assert.equal(poisoned.deleted, false)
  assert.equal(actor.createdEffects.length, 0)
})

test('consumption execution reduces conditions on the selected actor', async () => {
  const ownPoison = createEffect('poisoned', 3)
  const otherPoison = createEffect('poisoned', 4)

  const actor = createActor([ownPoison])

  const other = Object.assign(
    createActor([otherPoison]),
    createTargetActor(true)
  )

  const item = createReductionConsumable('other')

  const plan = prepareConsumableReductions(
    item,
    [other],
    false
  )

  assert.equal(plan.ok, true)

  await executeConsumableReductions(actor, plan)

  assert.equal(ownPoison.system.stacks, 3)
  assert.equal(otherPoison.system.stacks, 3)
  assert.equal(actor.createdEffects.length, 0)
  assert.equal(other.createdEffects.length, 0)
})

test('consumption execution handles mixed self and other rules', async () => {
  const poisoned = createEffect('poisoned', 3)
  const fatigued = createEffect('fatigued', 4)

  const actor = createActor([poisoned])

  const other = Object.assign(
    createActor([fatigued]),
    createTargetActor(true)
  )

  const item = createConsumable([
    createItemEffect([
      createConsumptionChange({
        condition: 'Poisoned',
        stacks: 2,
        target: 'self',
      }),
      createConsumptionChange({
        condition: 'Fatigued',
        stacks: 3,
        target: 'other',
      }),
    ]),
  ])

  const plan = prepareConsumableReductions(
    item,
    [other],
    false
  )

  assert.equal(plan.ok, true)

  await executeConsumableReductions(actor, plan)

  assert.equal(poisoned.system.stacks, 1)
  assert.equal(fatigued.system.stacks, 1)
  assert.equal(actor.createdEffects.length, 0)
  assert.equal(other.createdEffects.length, 0)
})

test('consumption execution ignores items without reduction rules', async () => {
  const poisoned = createEffect('poisoned', 3)
  const actor = createActor([poisoned])
  const item = createConsumable()

  const plan = prepareConsumableReductions(item, [], false)

  assert.equal(plan.ok, true)

  await executeConsumableReductions(actor, plan)

  assert.equal(poisoned.system.stacks, 3)
  assert.equal(poisoned.deleted, false)
  assert.equal(actor.createdEffects.length, 0)
})

test('ordinary trigger engine cannot execute consumption rules', async () => {
  const poisoned = createEffect('poisoned', 3)

  const actor = createActor(
    [poisoned],
    [
      createTrigger(
        {},
        {
          when: 'onConsume',
          itemType: 'consumable',
          itemName: 'Antidote',
        }
      ),
    ]
  )

  await fireTriggers(
    actor,
    ['onConsume'],
    context(undefined, {
      sources: ['Antidote'],
    })
  )

  assert.equal(poisoned.system.stacks, 3)
  assert.equal(poisoned.deleted, false)
  assert.equal(actor.createdEffects.length, 0)
})

test('ordinary events still execute when supplied alongside onConsume', async () => {
  const poisoned = createEffect('poisoned', 3)

  const actor = createActor(
    [poisoned],
    [
      createTrigger(),
      createTrigger(
        {},
        {
          when: 'onConsume',
          itemType: 'consumable',
          itemName: 'Antidote',
        }
      ),
    ]
  )

  await fireTriggers(
    actor,
    ['rollAnySuccess', 'onConsume'],
    context(undefined, {
      sources: ['First Aid', 'Antidote'],
    })
  )

  assert.equal(poisoned.system.stacks, 2)
  assert.equal(poisoned.deleted, false)
  assert.equal(actor.createdEffects.length, 0)
})

globalThis.Item = class {}

const { CrawlItem } =
  await import('../src/documents/item.ts')

function createUsableConsumable(
  effects = [],
  options = {}
) {
  const actor = Object.assign(
    createActor([createEffect('poisoned', 3)]),
    {
      documentName: 'Actor',
      uuid: 'Actor.consumer-test',
      name: 'Consumer',
      isOwner: true,
    }
  )

  actor.system.mana = {
    value: 5,
    max: 10,
  }

  actor.update = async function (changes) {
    if ('system.mana.value' in changes) {
      this.system.mana.value =
        changes['system.mana.value']
    }

    return this
  }

  for (const effect of effects) {
    effect.toObject = function () {
      return {
        _id: this.id,
        name: this.name,
        statuses: [],
        duration: {},
        transfer: this.transfer,
        disabled: this.disabled,
        system: structuredClone(this.system),
      }
    }
  }

  const item = Object.assign(
    new CrawlItem(),
    createConsumable(effects),
    {
      actor,
      uuid: 'Actor.consumer-test.Item.antidote-test',
    }
  )

  item.system.quantity = options.quantity ?? 5

  item.update = async function (changes) {
    if ('system.quantity' in changes) {
      this.system.quantity =
        changes['system.quantity']
    }

    return this
  }

  item.toMessage = async () => ({
    id: 'chat-message-test',
  })

  const warnings = []

  game.user = {
    isActiveGM: false,
    isGM: false,
    id: 'player-test',
    targets: new Set(
      (options.targets ?? []).map(
        (actor) => ({ actor })
      )
    ),
  }

  game.users = {
    activeGM: null,
  }

  game.i18n = {
    localize: (key) => key,
    format: (key) => key,
  }

  globalThis.ui = {
    notifications: {
      warn: (message) => warnings.push(message),
      error: (message) => warnings.push(message),
    },
  }

  return {
    item,
    actor,
    poisoned: actor.effects[0],
    warnings,
  }
}

test('using an antidote spends one item and removes one stack', async () => {
  const { item, actor, poisoned } =
    createUsableConsumable([
      createItemEffect([
        createConsumptionChange(),
      ]),
    ])

  await item.use()

  assert.equal(item.system.quantity, 4)
  assert.equal(poisoned.system.stacks, 2)
  assert.equal(actor.createdEffects.length, 0)
})

test('using an antidote on another owned actor reduces their condition', async () => {
  const otherPoison = createEffect('poisoned', 4)

  const other = Object.assign(
    createActor([otherPoison]),
    createTargetActor(true)
  )

  const { item, actor, poisoned } =
    createUsableConsumable(
      [
        createItemEffect([
          createConsumptionChange({
            target: 'other',
          }),
        ]),
      ],
      { targets: [other] }
    )

  await item.use()

  assert.equal(item.system.quantity, 4)
  assert.equal(poisoned.system.stacks, 3)
  assert.equal(otherPoison.system.stacks, 3)
  assert.equal(actor.createdEffects.length, 0)
})

test('an other-targeted antidote is not spent without a target', async () => {
  const { item, poisoned, warnings } =
    createUsableConsumable([
      createItemEffect([
        createConsumptionChange({
          target: 'other',
        }),
      ]),
    ])

  await item.use()

  assert.equal(item.system.quantity, 5)
  assert.equal(poisoned.system.stacks, 3)
  assert.ok(warnings.length > 0)
})

test('an other-targeted antidote is not spent with multiple targets', async () => {
  const { item, poisoned, warnings } =
    createUsableConsumable(
      [
        createItemEffect([
          createConsumptionChange({
            target: 'other',
          }),
        ]),
      ],
      {
        targets: [
          createTargetActor(true),
          createTargetActor(true),
        ],
      }
    )

  await item.use()

  assert.equal(item.system.quantity, 5)
  assert.equal(poisoned.system.stacks, 3)
  assert.ok(warnings.length > 0)
})

test('an antidote is not spent on an unowned target without a GM', async () => {
  const { item, poisoned, warnings } =
    createUsableConsumable(
      [
        createItemEffect([
          createConsumptionChange({
            target: 'other',
          }),
        ]),
      ],
      { targets: [createTargetActor(false)] }
    )

  await item.use()

  assert.equal(item.system.quantity, 5)
  assert.equal(poisoned.system.stacks, 3)
  assert.ok(warnings.length > 0)
})

test('an empty antidote cannot reduce conditions', async () => {
  const { item, actor, poisoned, warnings } =
    createUsableConsumable(
      [
        createItemEffect([
          createConsumptionChange(),
        ]),
      ],
      { quantity: 0 }
    )

  await item.use()

  assert.equal(item.system.quantity, 0)
  assert.equal(poisoned.system.stacks, 3)
  assert.equal(actor.createdEffects.length, 0)
  assert.ok(warnings.length > 0)
})

test('consumption removes its one-time rule but preserves other effect changes', async () => {
  const statBonus = {
    key: 'system.attributes.str.bonus',
    type: 'add',
    value: 2,
    phase: 'initial',
  }

  const { item, actor, poisoned } =
    createUsableConsumable([
      createItemEffect([
        createConsumptionChange(),
        statBonus,
      ]),
    ])

  await item.use()

  assert.equal(item.system.quantity, 4)
  assert.equal(poisoned.system.stacks, 2)
  assert.equal(actor.createdEffects.length, 1)

  assert.deepEqual(
    actor.createdEffects[0].system.changes,
    [statBonus]
  )
})

test('ordinary mana potions retain their existing behavior', async () => {
  const { item, actor, poisoned } =
    createUsableConsumable()

  item.system.manaRestore = '100%'

  await item.use()

  assert.equal(item.system.quantity, 4)
  assert.equal(actor.system.mana.value, 10)
  assert.equal(poisoned.system.stacks, 3)
  assert.equal(actor.createdEffects.length, 0)
})

test('consumption works with a transferring reduction effect', async () => {
  const { item, actor, poisoned } =
    createUsableConsumable([
      createItemEffect(
        [createConsumptionChange()],
        { transfer: true }
      ),
    ])

  await item.use()

  assert.equal(item.system.quantity, 4)
  assert.equal(poisoned.system.stacks, 2)
  assert.equal(actor.createdEffects.length, 0)
})

test('consumption does not reduce conditions if spending fails', async () => {
  const { item, actor, poisoned } =
    createUsableConsumable([
      createItemEffect([
        createConsumptionChange(),
      ]),
    ])

  item.spendOne = async () => false

  await item.use()

  assert.equal(item.system.quantity, 5)
  assert.equal(poisoned.system.stacks, 3)
  assert.equal(actor.createdEffects.length, 0)
})

test('using the final antidote still executes its reduction', async () => {
  const { item, actor, poisoned } =
    createUsableConsumable(
      [
        createItemEffect([
          createConsumptionChange(),
        ]),
      ],
      { quantity: 1 }
    )

  await item.use()

  assert.equal(item.system.quantity, 0)
  assert.equal(poisoned.system.stacks, 2)
  assert.equal(actor.createdEffects.length, 0)

  await item.use()

  assert.equal(item.system.quantity, 0)
  assert.equal(poisoned.system.stacks, 2)
})

test('consumption preserves the original item rule configuration', async () => {
  const change = createConsumptionChange()

  const effect = createItemEffect([change])

  const { item } = createUsableConsumable([effect])

  const original = structuredClone(effect.system.changes)

  await item.use()

  assert.deepEqual(effect.system.changes, original)
})

function createGMConsumptionRequest(options = {}) {
  const otherPoison = createEffect('poisoned', 4)

  const other = Object.assign(
    createActor([otherPoison]),
    createTargetActor(true)
  )

  const fixture = createUsableConsumable(
    [
      createItemEffect([
        createConsumptionChange({
          target: options.target ?? 'other',
        }),
      ]),
    ],
    { quantity: options.quantity ?? 5 }
  )

  const { item, actor } = fixture

  item.documentName = 'Item'

  actor.items.set(item.id, item)

  const player = {
    id: 'player-test',
    isGM: false,
    active: true,
  }

  actor.testUserPermission = (user, permission) =>
    user === player &&
    permission === 'OWNER' &&
    (options.ownsItem ?? true)

  const gm = {
    id: 'gm-test',
    isGM: true,
    isActiveGM: true,
    targets: new Set(),
  }

  game.user = gm

  game.users = {
    activeGM: gm,
    get: (id) => {
      if (id === player.id) return player
      if (id === gm.id) return gm
      return undefined
    },
  }

  const documents = new Map([
    [item.uuid, item],
    [actor.uuid, actor],
    [other.uuid, other],
  ])

  globalThis.fromUuid = async (uuid) =>
    documents.get(uuid)

  const request = {
    type: 'consume',
    itemUuid: item.uuid,
    targetUuid: other.uuid,
    userId: player.id,
  }

  return {
    ...fixture,
    other,
    otherPoison,
    player,
    gm,
    request,
    documents,
  }
}

test('GM executes consumption for an authorized player', async () => {
  const {
    item,
    poisoned,
    otherPoison,
    actor,
    request,
  } = createGMConsumptionRequest()

  await consumableRequest(request)

  assert.equal(item.system.quantity, 4)
  assert.equal(poisoned.system.stacks, 3)
  assert.equal(otherPoison.system.stacks, 3)
  assert.equal(actor.createdEffects.length, 0)
})

test('GM can execute the final available consumable', async () => {
  const {
    item,
    otherPoison,
    request,
  } = createGMConsumptionRequest({
    quantity: 1,
  })

  await consumableRequest(request)

  assert.equal(item.system.quantity, 0)
  assert.equal(otherPoison.system.stacks, 3)

  await consumableRequest(request)

  assert.equal(item.system.quantity, 0)
  assert.equal(otherPoison.system.stacks, 3)
})

test('GM rejects consumption from a player without item ownership', async () => {
  const {
    item,
    otherPoison,
    request,
  } = createGMConsumptionRequest({
    ownsItem: false,
  })

  await consumableRequest(request)

  assert.equal(item.system.quantity, 5)
  assert.equal(otherPoison.system.stacks, 4)
})

test('GM rejects consumption from an unknown user', async () => {
  const {
    item,
    otherPoison,
    request,
  } = createGMConsumptionRequest()

  request.userId = 'unknown-player'

  await consumableRequest(request)

  assert.equal(item.system.quantity, 5)
  assert.equal(otherPoison.system.stacks, 4)
})

test('consumption requests are ignored by non-active-GM clients', async () => {
  const {
    item,
    otherPoison,
    request,
  } = createGMConsumptionRequest()

  game.user.isActiveGM = false

  await consumableRequest(request)

  assert.equal(item.system.quantity, 5)
  assert.equal(otherPoison.system.stacks, 4)
})

test('GM rejects consumption requests for missing items', async () => {
  const {
    item,
    otherPoison,
    request,
    documents,
  } = createGMConsumptionRequest()

  documents.delete(item.uuid)

  await consumableRequest(request)

  assert.equal(item.system.quantity, 5)
  assert.equal(otherPoison.system.stacks, 4)
})

test('GM rejects consumption requests for missing targets', async () => {
  const {
    item,
    other,
    otherPoison,
    request,
    documents,
  } = createGMConsumptionRequest()

  documents.delete(other.uuid)

  await consumableRequest(request)

  assert.equal(item.system.quantity, 5)
  assert.equal(otherPoison.system.stacks, 4)
})

test('GM rejects consumption requests for non-consumable items', async () => {
  const {
    item,
    otherPoison,
    request,
  } = createGMConsumptionRequest()

  item.type = 'equipment'

  await consumableRequest(request)

  assert.equal(item.system.quantity, 5)
  assert.equal(otherPoison.system.stacks, 4)
})

test('GM rejects consumption requests for self-only reduction items', async () => {
  const {
    item,
    poisoned,
    otherPoison,
    request,
  } = createGMConsumptionRequest({
    target: 'self',
  })

  await consumableRequest(request)

  assert.equal(item.system.quantity, 5)
  assert.equal(poisoned.system.stacks, 3)
  assert.equal(otherPoison.system.stacks, 4)
})

test('GM rejects consumption requests from inactive players', async () => {
  const {
    item,
    player,
    otherPoison,
    request,
  } = createGMConsumptionRequest()

  player.active = false

  await consumableRequest(request)

  assert.equal(item.system.quantity, 5)
  assert.equal(otherPoison.system.stacks, 4)
})

test('GM rejects consumption requests for detached inventory items', async () => {
  const {
    item,
    actor,
    otherPoison,
    request,
  } = createGMConsumptionRequest()

  actor.items.delete(item.id)

  await consumableRequest(request)

  assert.equal(item.system.quantity, 5)
  assert.equal(otherPoison.system.stacks, 4)
})

test('GM rejects consumption requests for broken items', async () => {
  const {
    item,
    otherPoison,
    request,
  } = createGMConsumptionRequest()

  item.system.broken = true

  await consumableRequest(request)

  assert.equal(item.system.quantity, 5)
  assert.equal(otherPoison.system.stacks, 4)
})

test('GM ignores player-supplied reduction values', async () => {
  const {
    item,
    otherPoison,
    request,
  } = createGMConsumptionRequest()

  request.condition = 'Poisoned'
  request.stacks = 999

  await consumableRequest(request)

  assert.equal(item.system.quantity, 4)
  assert.equal(otherPoison.system.stacks, 3)
})

test('players cannot directly override consumable targets', async () => {
  const {
    item,
    poisoned,
  } = createUsableConsumable([
    createItemEffect([
      createConsumptionChange({ target: 'other' }),
    ]),
  ])

  const otherPoison = createEffect('poisoned', 4)

  const other = Object.assign(
    createActor([otherPoison]),
    createTargetActor(true)
  )

  await item.use({ consumableTarget: other })

  assert.equal(item.system.quantity, 5)
  assert.equal(poisoned.system.stacks, 3)
  assert.equal(otherPoison.system.stacks, 4)
})
test('using an antidote on an unowned actor sends a GM request', async () => {
  const otherPoison = createEffect('poisoned', 4)

  const other = Object.assign(
    createActor([otherPoison]),
    createTargetActor(false)
  )

  const { item, actor, poisoned } =
    createUsableConsumable(
      [
        createItemEffect([
          createConsumptionChange({ target: 'other' }),
        ]),
      ],
      { targets: [other] }
    )

  game.users.activeGM = {
    id: 'gm-test',
    isGM: true,
  }

  const emitted = []

  game.socket = {
    emit(channel, request) {
      emitted.push({ channel, request })
    },
  }

  await item.use()

  assert.equal(emitted.length, 1)

  assert.deepEqual(emitted[0], {
    channel: 'system.crawlspace',
    request: {
      type: 'consume',
      itemUuid: item.uuid,
      targetUuid: other.uuid,
      userId: 'player-test',
    },
  })

  // The player must not spend or execute the item locally.
  assert.equal(item.system.quantity, 5)
  assert.equal(poisoned.system.stacks, 3)
  assert.equal(otherPoison.system.stacks, 4)
  assert.equal(actor.createdEffects.length, 0)
})

test('owned targets execute locally without sending a GM request', async () => {
  const otherPoison = createEffect('poisoned', 4)

  const other = Object.assign(
    createActor([otherPoison]),
    createTargetActor(true)
  )

  const { item } = createUsableConsumable(
    [
      createItemEffect([
        createConsumptionChange({ target: 'other' }),
      ]),
    ],
    { targets: [other] }
  )

  game.users.activeGM = {
    id: 'gm-test',
    isGM: true,
  }

  const emitted = []

  game.socket = {
    emit(channel, request) {
      emitted.push({ channel, request })
    },
  }

  await item.use()

  assert.equal(emitted.length, 0)
  assert.equal(item.system.quantity, 4)
  assert.equal(otherPoison.system.stacks, 3)
})

test('empty consumables do not send GM requests', async () => {
  const { item, warnings } =
    createUsableConsumable(
      [
        createItemEffect([
          createConsumptionChange({ target: 'other' }),
        ]),
      ],
      {
        quantity: 0,
        targets: [createTargetActor(false)],
      }
    )

  game.users.activeGM = {
    id: 'gm-test',
    isGM: true,
  }

  const emitted = []

  game.socket = {
    emit(channel, request) {
      emitted.push({ channel, request })
    },
  }

  await item.use()

  assert.equal(emitted.length, 0)
  assert.equal(item.system.quantity, 0)
  assert.ok(warnings.length > 0)
})

const { registerSocket } =
  await import('../src/socket.ts')

function createSocketHarness() {
  const listeners = new Map()
  const emitted = []

  game.socket = {
    on(channel, callback) {
      listeners.set(channel, callback)
    },

    emit(channel, request) {
      emitted.push({ channel, request })
    },
  }

  registerSocket()

  return {
    emitted,

    async dispatch(request) {
      const listener = listeners.get(
        'system.crawlspace'
      )

      assert.equal(typeof listener, 'function')

      return listener(request)
    },
  }
}

test('player consumption request executes through the actual GM socket dispatcher', async () => {
  const {
    item,
    actor,
    poisoned,
    other,
    otherPoison,
    player,
    gm,
  } = createGMConsumptionRequest()

  const socket = createSocketHarness()

  // Simulate the requesting player's client.
  game.user = {
    ...player,
    isActiveGM: false,
    targets: new Set([{ actor: other }]),
  }

  other.isOwner = false

  await item.use()

  assert.equal(socket.emitted.length, 1)
  assert.equal(item.system.quantity, 5)
  assert.equal(otherPoison.system.stacks, 4)

  // Simulate delivery to the active GM's client.
  game.user = gm
  other.isOwner = true

  await socket.dispatch(
    socket.emitted[0].request
  )

  assert.equal(item.system.quantity, 4)
  assert.equal(poisoned.system.stacks, 3)
  assert.equal(otherPoison.system.stacks, 3)
  assert.equal(actor.createdEffects.length, 0)

  // The GM must not relay the request again.
  assert.equal(socket.emitted.length, 1)
})

test('socket dispatcher ignores consumption on non-active-GM clients', async () => {
  const {
    item,
    otherPoison,
    request,
  } = createGMConsumptionRequest()

  const socket = createSocketHarness()

  game.user.isActiveGM = false

  await socket.dispatch(request)

  assert.equal(item.system.quantity, 5)
  assert.equal(otherPoison.system.stacks, 4)
})

test('queued GM requests cannot consume the final item twice', async () => {
  const {
    item,
    otherPoison,
    request,
  } = createGMConsumptionRequest({
    quantity: 1,
  })

  const socket = createSocketHarness()

  await Promise.all([
    socket.dispatch(request),
    socket.dispatch(request),
  ])

  assert.equal(item.system.quantity, 0)
  assert.equal(otherPoison.system.stacks, 3)
})

test('consumption does not execute when inventory quantity remains unchanged', async () => {
  const { item, poisoned, actor } =
    createUsableConsumable([
      createItemEffect([createConsumptionChange()]),
    ])

  item.update = async () => item

  await item.use()

  assert.equal(item.system.quantity, 5)
  assert.equal(poisoned.system.stacks, 3)
  assert.equal(actor.createdEffects.length, 0)
})

test('overlapping local consumption cannot spend the final item twice', async () => {
  const { item, poisoned } =
    createUsableConsumable(
      [
        createItemEffect([createConsumptionChange()]),
      ],
      { quantity: 1 }
    )

  const originalUpdate = item.update.bind(item)

  item.update = async (changes) => {
    await Promise.resolve()
    return originalUpdate(changes)
  }

  await Promise.all([
    item.use(),
    item.use(),
  ])

  assert.equal(item.system.quantity, 0)
  assert.equal(poisoned.system.stacks, 2)
})

test('consumable lock resets after an execution error', async () => {
  const { item, poisoned } =
    createUsableConsumable([
      createItemEffect([createConsumptionChange()]),
    ])

  const originalUpdate = item.update.bind(item)

  item.update = async () => {
    throw new Error('Simulated update failure')
  }

  await assert.rejects(
    item.use(),
    /Simulated update failure/
  )

  item.update = originalUpdate

  await item.use()

  assert.equal(item.system.quantity, 4)
  assert.equal(poisoned.system.stacks, 2)
})