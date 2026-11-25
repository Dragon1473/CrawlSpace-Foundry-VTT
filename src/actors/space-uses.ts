/**
 * Once-a-day amenities in a Personal Space (rules/personal-space.ts useOf): the Use button on an upgrade's row. A crawler
 * in the space uses each one once a day of the game clock (game-day.ts: the dayLength setting, in step with the floor timer).
 * - A meal: +statBonus to a stat the eater picks and/or extra Health Bar slots at their next Short Rest, for its hours.
 *   Meals don't stack: a new one replaces the last (flags.crawlspace.spaceMeal).
 * - A wash: Advantage on the named checks for its hours (flags.crawlspace.spaceWash).
 */
import { useOf } from '../rules/personal-space'
import { gameDay } from '../game-day'
import { extraSlotsHealth } from '../rules/personal-space'
import { HEALTH_MAX, STATS, STAT_KEYS } from '../config'
import { currentSpace, membersOf } from './personal-space'

const USED = 'spaceUsed'

const t = (key: string, data?: Record<string, unknown>) =>
  data ? game.i18n.format(`CRAWLSPACE.Space.${key}`, data) : game.i18n.localize(`CRAWLSPACE.Space.${key}`)
const esc = (value: unknown) => foundry.utils.escapeHTML(String(value))

const today = () => gameDay()

/** Whether this upgrade has a Use. */
export const usable = (item: any) => item?.type === 'spaceUpgrade' && item.system.installed && !!useOf(item.system.use).kind

function usedToday(crawler: any): Record<string, boolean> {
  const saved = crawler.getFlag('crawlspace', USED)
  return saved && Number(saved.day) === today() ? { ...(saved.uses ?? {}) } : {}
}

/** The crawlers this user controls who are in the space now. */
export const usersHere = (space: any) =>
  membersOf(space)
    .map((member) => fromUuidSync(member.uuid))
    .filter((crawler: any) => crawler?.isOwner && currentSpace(crawler) === space)

async function pick(title: string, label: string, choices: { value: string; label: string }[]) {
  if (choices.length === 1) return choices[0].value
  return foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ['crawlspace'],
    content: `<p>${esc(label)}</p>`,
    buttons: choices.map((choice) => ({ action: choice.value, label: choice.label })),
    rejectClose: false,
  })
}

/** The Use button: who uses it (if more than one of yours is here), the stat for a meal, then its effect. */
export async function useUpgrade(space: any, upgrade: any) {
  const use = useOf(upgrade.system.use)
  if (!usable(upgrade)) return
  const here = usersHere(space)
  if (!here.length) return ui.notifications.warn(t('UseNobody'))
  const crawlerId = await pick(upgrade.name, t('UseWho'), here.map((crawler: any) => ({ value: crawler.id, label: crawler.name })))
  const crawler = here.find((entry: any) => entry.id === crawlerId)
  if (!crawler) return
  const used = usedToday(crawler)
  if (used[upgrade.id]) return ui.notifications.warn(t('UseUsed', { name: crawler.name, upgrade: upgrade.name }))
  const seconds = Math.max(1, use.hours) * 3600
  const base = { img: upgrade.img, origin: upgrade.uuid, duration: { value: seconds, units: 'seconds' }, transfer: false, disabled: false }
  const lines: string[] = []
  if (use.kind === 'meal') {
    let stat = ''
    if (use.statBonus) {
      stat = (await pick(upgrade.name, t('UsePickStat'), STAT_KEYS.map((key) => ({ value: key, label: STATS[key].label })))) ?? ''
      if (!stat) return
    }
    const old = crawler.effects.filter((effect: any) => effect.getFlag('crawlspace', 'spaceMeal'))
    if (old.length) await crawler.deleteEmbeddedDocuments('ActiveEffect', old.map((effect: any) => effect.id))
    await crawler.createEmbeddedDocuments('ActiveEffect', [
      {
        ...base,
        name: upgrade.name,
        system: {
          changes: stat ? [{ key: `system.attributes.${stat}.bonus`, type: 'add', value: String(use.statBonus), phase: 'initial' }] : [],
          conditionType: 'buff',
          durationText: t('Hours', { hours: use.hours }),
        },
        flags: { crawlspace: { spaceMeal: true, mealSlots: use.restSlots } },
      },
    ])
    lines.push(t('UseMeal', { name: crawler.name, upgrade: upgrade.name }))
    if (stat) lines.push(t('UseMealStat', { bonus: use.statBonus, stat: STATS[stat as keyof typeof STATS].label, hours: use.hours }))
    if (use.restSlots) lines.push(t('UseMealSlots', { slots: use.restSlots, hours: use.hours }))
  } else {
    const old = crawler.effects.filter((effect: any) => effect.getFlag('crawlspace', 'spaceWash'))
    if (old.length) await crawler.deleteEmbeddedDocuments('ActiveEffect', old.map((effect: any) => effect.id))
    await crawler.createEmbeddedDocuments('ActiveEffect', [
      {
        ...base,
        name: upgrade.name,
        system: {
          changes: use.advantage ? [{ key: `checkMode:${use.advantage}`, type: 'crawlspace.rollMode', value: 'advantage', phase: 'initial' }] : [],
          conditionType: 'buff',
          durationText: t('Hours', { hours: use.hours }),
        },
        flags: { crawlspace: { spaceWash: true } },
      },
    ])
    lines.push(t('UseWash', { name: crawler.name, upgrade: upgrade.name, checks: use.advantage, hours: use.hours }))
  }
  // '==' replaces the flag: a merge would carry yesterday's uses into today.
  await crawler.update({ [`flags.crawlspace.==${USED}`]: { day: today(), uses: { ...used, [upgrade.id]: true } } })
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: crawler }),
    content: `<div class="crawlspace chat-card"><h3>${esc(upgrade.name)}</h3>${lines.map((line) => `<p>${esc(line)}</p>`).join('')}</div>`,
  })
}

/** A Short Rest anywhere: a meal's extra Health Bar slots, used up. Returns lines for the rest's card. */
export async function mealSlotsAtRest(actor: any) {
  const meals = actor.effects.filter((effect: any) => effect.getFlag('crawlspace', 'spaceMeal') && Number(effect.getFlag('crawlspace', 'mealSlots')) > 0)
  const lines: string[] = []
  for (const meal of meals) {
    const slots = Math.floor(Number(meal.getFlag('crawlspace', 'mealSlots')) || 0)
    await actor.update({ 'system.health.value': extraSlotsHealth(actor.system.health.value, slots, HEALTH_MAX) })
    // The slots are spent; a meal that gave nothing else is done.
    if (meal.system?.changes?.length) await meal.setFlag('crawlspace', 'mealSlots', 0)
    else await meal.delete()
    lines.push(t('MealSlots', { slots, name: meal.name }))
  }
  return lines
}
