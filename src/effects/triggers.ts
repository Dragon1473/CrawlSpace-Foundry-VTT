/**
 * Triggered rules at the table: when a roll, an attack or damage sets off a rule's trigger, the active GM
 * carries it out. Apply condition puts a condition on the actor or on the other side of the roll, Note adds
 * its text to the chat card, and any other rule is given to the actor as a condition of its own (a cloak's
 * shield slots after a Critical Hit), timed by the source effect's Duration.
 */
import { debuffByName } from '../rules/debuffs'
import { giveCondition } from './use-conditions'
import { reduceConditionStacks } from './stacks'
import { defenseEvents, matchTriggers, rollEvents, TIER_OUTCOME, unwrapTriggered, type Timing, type TriggerEntry } from './trigger-events'

const CHANNEL = 'system.crawlspace'

export type TriggerContext = {
  timing: Timing
  /** The event has a second moment (a hit's damage landing later). */
  afterPhase: boolean
  /** Who was on the other side: the target of your roll, or the attacker. */
  other?: any
  /** The skills, spells and weapon behind the roll. */
  sources?: string[]
  /** The card the event came from: notes are added to it. */
  message?: any
}

const esc = (value: unknown) => foundry.utils.escapeHTML(String(value ?? ''))
const json = (value: unknown): any => {
  try {
    return typeof value === 'string' ? JSON.parse(value) : (value ?? {})
  } catch {
    return {}
  }
}

/** The effect a triggered rule lives on. */
function sourceEffect(actor: any, entry: TriggerEntry) {
  const item = entry.itemId ? actor.items.get(entry.itemId) : null
  return item?.effects.get(entry.effectId) ?? actor.effects.get(entry.effectId) ?? null
}

/** Collect condition reduction rules that execute when this consumable is used. */
export function consumableReductionEntries(item: any): TriggerEntry[] {
  if (item?.type !== 'consumable') return []

  const entries: TriggerEntry[] = []

  for (const effect of item.effects ?? []) {
    if (effect.disabled) continue

    const changes = effect.system?.changes ?? []

    for (const [index, change] of changes.entries()) {
      const triggered = unwrapTriggered(change)

      if (
        !triggered ||
        triggered.when !== 'onConsume' ||
        triggered.change.key !== 'reduceCondition' ||
        triggered.change.type !== 'crawlspace.special'
      ) continue

      entries.push({
        ...triggered,
        source: effect.name ?? item.name ?? '',
        effectId: effect.id ?? '',
        itemId: item.id ?? '',
        itemName: item.name ?? '',
        itemType: item.type,
        index,
      })
    }
  }

  return entries
}

type ConsumableReductionPlan =
  | { ok: true; entries: TriggerEntry[]; other: any | null }
  | { ok: false; reason: 'singleTarget' | 'needGM' }

/** Validate consumption targets before spending the item. */
export function prepareConsumableReductions(
  item: any,
  targets: any[],
  hasActiveGM: boolean
): ConsumableReductionPlan {
  const entries = consumableReductionEntries(item)

  const needsOther = entries.some(
    (entry) => json(entry.change.value)?.target === 'other'
  )

  if (!needsOther) {
    return { ok: true, entries, other: null }
  }

  if (targets.length !== 1) {
    return { ok: false, reason: 'singleTarget' }
  }

  const other = targets[0]

  if (other?.documentName !== 'Actor' || !other.uuid) {
    return { ok: false, reason: 'singleTarget' }
  }

  if (!other.isOwner && !hasActiveGM) {
    return { ok: false, reason: 'needGM' }
  }

  return { ok: true, entries, other }
}

/** Execute the reduction rules of a validated, spent consumable. */
export async function executeConsumableReductions(
  actor: any,
  plan: Extract<ConsumableReductionPlan, { ok: true }>
) {
  for (const entry of plan.entries) {
    await reduceTriggeredCondition(
      actor,
      entry,
      json(entry.change.value),
      {
        timing: 'before',
        afterPhase: false,
        other: plan.other,
      }
    )
  }
}

/** Ask the active GM to consume an item on an unowned target. */
export function requestConsumableUse(item: any, target: any) {
  if (!game.users.activeGM) {
    ui.notifications.warn(
      game.i18n.localize('CRAWLSPACE.Warn.NeedGM')
    )
    return
  }

  game.socket.emit(CHANNEL, {
    type: 'consume',
    itemUuid: item.uuid,
    targetUuid: target.uuid,
    userId: game.user.id,
  })
}

/** Execute a player's consumable request on the active GM's client. */
export async function consumableRequest(request: {
  itemUuid: string
  targetUuid: string
  userId: string
}) {
  if (!game.user.isActiveGM) return

  if (
    typeof request.itemUuid !== 'string' ||
    typeof request.targetUuid !== 'string' ||
    typeof request.userId !== 'string' ||
    !request.itemUuid ||
    !request.targetUuid ||
    !request.userId
  ) return

  const user = game.users.get(request.userId)

  // Only active, known players should submit relayed requests.
  if (!user || !user.active || user.isGM) return

  const item: any = await fromUuid(request.itemUuid)
  const target: any = await fromUuid(request.targetUuid)

  if (item?.documentName !== 'Item') return
  if (item.type !== 'consumable') return
  if (target?.documentName !== 'Actor') return

  // The explosive attack pathway does not support this operation.
  if (item.system?.consumableType === 'explosives') return
  if (item.system?.broken) return

  const actor = item.actor

  // Verify that the item actually belongs to the player's actor.
  if (!actor || actor.items?.get(item.id) !== item) return
  if (!actor.testUserPermission(user, 'OWNER')) return

  const quantity = Number(item.system?.quantity)

  if (!Number.isFinite(quantity) || quantity <= 0) return

  // Rebuild the plan using the actual item's current configuration.
  const plan = prepareConsumableReductions(
    item,
    [target],
    true
  )

  // Only items with an Other-targeted reduction require this relay.
  if (!plan.ok || plan.other !== target) return

  // Execute the complete item-use operation as the GM.
  return item.use({ consumableTarget: target })
}

/**
 * Carry out the actor's rules for these events. Runs on the active GM, who may write to every actor; other
 * clients send it there.
 */
export async function fireTriggers(actor: any, events: string[], context: TriggerContext) {
  // Consumption rules execute only through the dedicated item-use pathway.
  events = events.filter((event) => event !== 'onConsume')
  if (!actor || !events.length) return
  const entries = matchTriggers(actor.system?.triggers ?? [], events, context)
  if (!entries.length) return
  if (!game.user.isActiveGM) {
    if (!game.users.activeGM) return
    game.socket.emit(CHANNEL, {
      type: 'trigger',
      actorUuid: actor.uuid,
      events,
      timing: context.timing,
      afterPhase: context.afterPhase,
      otherUuid: context.other?.uuid ?? '',
      sources: context.sources ?? [],
      messageId: context.message?.id ?? '',
    })
    return
  }
  const notes: string[] = []
  for (const entry of entries) {
    try {
      const data = json(entry.change.value)
      if (entry.change.key === 'note') {
        if (String(data.text ?? '').trim()) notes.push(`<p><i class="fa-solid fa-note-sticky"></i> <strong>${esc(entry.source)}:</strong> ${esc(data.text)}</p>`)
      } else if (entry.change.key === 'applyCondition') await applyTriggeredCondition(actor, entry, data, context)
      else if (entry.change.key === 'reduceCondition') await reduceTriggeredCondition(actor, entry, data, context)
      else await grantTriggeredRule(actor, entry)
    } catch (error) {
      console.error('CrawlSpace | trigger', entry, error)
    }
  }
  if (!notes.length) return
  const html = `<div class="crawl-trigger-notes">${notes.join('')}</div>`
  if (context.message && game.messages.get(context.message.id)) await context.message.update({ flavor: `${context.message.flavor ?? ''}${html}` })
  else await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: html })
}

/** Apply condition: a standard condition by name, or a dropped effect (by UUID), on the actor or the other side. */
async function applyTriggeredCondition(actor: any, entry: TriggerEntry, data: any, context: TriggerContext) {
  const target = data.target === 'other' ? context.other : actor
  const name = String(data.condition ?? '').trim()
  if (!target || !name) return
  const stacks = Math.max(1, Math.floor(Number(data.stacks) || 1))
  const debuff = debuffByName(name)
  if (debuff) return target.addDebuff(debuff.id, stacks)
  const effect: any = await fromUuid(name)
  if (effect?.documentName === 'ActiveEffect') return giveCondition(effect, target)
  console.warn(`CrawlSpace | ${entry.source}: no condition named "${name}"`)
}

/** Reduce a standard condition on the actor or the other side of the roll. */
async function reduceTriggeredCondition(actor: any, entry: TriggerEntry, data: any, context: TriggerContext) {
  const target = data.target === 'other' ? context.other : actor
  const name = String(data.condition ?? '').trim()
  if (!target || !name) return
  const debuff = debuffByName(name)
  if (!debuff) {
    console.warn(`CrawlSpace | ${entry.source}: no condition named "${name}"`)
    return
  }
  const stacks = Number(data.stacks ?? 1)
  return reduceConditionStacks(target, debuff.id, stacks)
}

/** Any other rule: the actor gets it as a condition of its own. Firing again refreshes it. */
async function grantTriggeredRule(actor: any, entry: TriggerEntry) {
  const effect = sourceEffect(actor, entry)
  const key = `${entry.itemId}.${entry.effectId}.${entry.index}`
  const old = actor.effects.filter((existing: any) => existing.flags?.crawlspace?.triggeredFrom === key)
  if (old.length) await actor.deleteEmbeddedDocuments('ActiveEffect', old.map((existing: any) => existing.id))
  await actor.createEmbeddedDocuments('ActiveEffect', [
    {
      name: entry.source,
      img: effect?.img ?? 'icons/svg/aura.svg',
      origin: effect?.uuid,
      system: { changes: [{ ...entry.change, phase: 'initial' }], conditionType: 'buff', durationText: effect?.system?.durationText ?? '' },
      flags: { crawlspace: { triggeredFrom: key } },
    },
  ])
}

/** An attack or check card: the roller's result triggers, and each target's defense triggers. */
async function fromCard(message: any) {
  const flags = message.flags?.crawlspace
  if (!flags) return
  const actor = ChatMessage.getSpeakerActor(message.speaker)
  if (flags.kind === 'attack') {
    for (const row of flags.targets ?? []) {
      const target: any = await fromUuid(row.uuid)
      const afterPhase = !!row.success
      if (actor) await fireTriggers(actor, rollEvents(row.outcome), { timing: 'before', afterPhase, other: target, sources: flags.sources, message })
      if (target) await fireTriggers(target, defenseEvents(row.outcome), { timing: 'before', afterPhase, other: actor, message })
    }
  } else if (flags.kind === 'check' && flags.outcome && actor) {
    await fireTriggers(actor, rollEvents(flags.outcome), { timing: 'before', afterPhase: false, sources: flags.sources, message })
  }
}

/** Damage from a hit landed: the "after" half of the hit's triggers, for both sides. */
export async function afterHit(target: any, options: { tier?: string; attacker?: string; sources?: string[] }) {
  const outcome = options.tier ? TIER_OUTCOME[options.tier] : null
  if (!outcome) return
  const attacker: any = options.attacker ? await fromUuid(options.attacker) : null
  await fireTriggers(target, defenseEvents(outcome), { timing: 'after', afterPhase: true, other: attacker })
  if (attacker) await fireTriggers(attacker, rollEvents(outcome), { timing: 'after', afterPhase: true, other: target, sources: options.sources })
}

/** Damaged, healed, dying or Clean Up: one moment, so every timing fires. */
export const fireEvent = (actor: any, event: string) => fireTriggers(actor, [event], { timing: 'before', afterPhase: false })

/** A player's client asked the GM to carry out triggers it can't write. */
export async function triggerRequest(request: any) {
  const actor: any = await fromUuid(request.actorUuid)
  if (actor?.documentName !== 'Actor') return
  const other = request.otherUuid ? await fromUuid(request.otherUuid) : undefined
  const message = request.messageId ? game.messages.get(request.messageId) : undefined
  await fireTriggers(actor, Array.isArray(request.events) ? request.events.map(String) : [], {
    timing: request.timing === 'after' ? 'after' : 'before',
    afterPhase: !!request.afterPhase,
    other,
    sources: Array.isArray(request.sources) ? request.sources.map(String) : [],
    message,
  })
}

export function registerTriggers() {
  Hooks.on('createChatMessage', (message: any) => {
    if (game.user.isActiveGM) void fromCard(message).catch((error) => console.error('CrawlSpace | triggers', error))
  })
}
