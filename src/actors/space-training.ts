/**
 * Training rooms in a Personal Space (rules/personal-space.ts): the Train action. Once a day (the crawler's grinding
 * day) per room, a crawler in the space picks up to the room's number of skills it trains; each gets the room's hours
 * in its grinding log (flags.crawlspace.grinding), up to its Rank. A full log makes the advancement check right away,
 * as grinding does. With the world setting `spaceTrainingLevels` on (the default) they also count toward the crawler's
 * level like grinding hours: the room's hours for each skill trained, and a level gained when they reach the crawler's
 * level (1d2 for the party's single lowest-level crawler). Off: they fill skill logs only.
 */
import { canTrain, trainingOf, trainSkill, type TrainableSkill } from '../rules/personal-space'
import { grindingOnDay, isUniqueLowestCrawler, normalizeGrinding } from '../rules/grinding'
import { gameDay } from '../game-day'
import { rankCap } from '../effects/rank-cap'
import { penaltyModifiers, rollD20 } from '../dice/rolls'
import { currentSpace } from './personal-space'

const TRAINED = 'spaceTrained'

const t = (key: string, data?: Record<string, unknown>) =>
  data ? game.i18n.format(`CRAWLSPACE.Space.${key}`, data) : game.i18n.localize(`CRAWLSPACE.Space.${key}`)
const g = (key: string, data?: Record<string, unknown>) =>
  data ? game.i18n.format(`CRAWLSPACE.Grinding.${key}`, data) : game.i18n.localize(`CRAWLSPACE.Grinding.${key}`)
const esc = (value: unknown) => foundry.utils.escapeHTML(String(value))

/** A skill or spell as a training room sees it. A combat skill attacks, fights unarmed or deals damage. */
export function trainable(item: any): TrainableSkill {
  const system = item.system ?? {}
  const combat = !!(system.isAttack || system.isUnarmed || String(system.damage?.formula ?? '').trim() || system.damageEffect?.enabled)
  return { name: item.name, type: item.type === 'spell' ? 'spell' : 'skill', rank: Math.floor(Number(system.rank?.base) || 0), combat }
}

/** The space's training rooms (installed, with hours). */
export const trainingRooms = (space: any) =>
  (space?.items ?? []).filter((item: any) => item.type === 'spaceUpgrade' && item.system.installed && trainingOf(item.system.training).hours > 0)

/** The rooms this crawler already used today (their grinding day, which is the game clock's day). */
function usedToday(crawler: any, day: number): Record<string, boolean> {
  const saved = crawler.getFlag('crawlspace', TRAINED)
  return saved && Number(saved.day) === day ? { ...(saved.uses ?? {}) } : {}
}

async function pickRoom(rooms: any[], crawler: any) {
  if (rooms.length === 1) return rooms[0]
  const id = await foundry.applications.api.DialogV2.wait({
    window: { title: t('TrainTitle', { name: crawler.name }) },
    classes: ['crawlspace'],
    content: `<p>${esc(t('TrainRoom'))}</p>`,
    buttons: rooms.map((room: any) => ({ action: room.id, label: room.name })),
    rejectClose: false,
  })
  return rooms.find((room: any) => room.id === id) ?? null
}

/** The Train action: pick a room (if more than one is free today) and skills, then fill their logs. */
export async function trainIn(space: any, crawler: any) {
  if (!crawler?.isOwner) return
  if (currentSpace(crawler) !== space) return ui.notifications.warn(t('TrainNotHere', { name: crawler.name }))
  const state = grindingOnDay(normalizeGrinding(crawler.getFlag('crawlspace', 'grinding')), gameDay())
  const used = usedToday(crawler, state.day)
  const skills = crawler.items.filter((item: any) => ['skill', 'spell'].includes(item.type) && item.name.trim())
  const rooms = trainingRooms(space).filter((room: any) => !used[room.id] && skills.some((item: any) => canTrain(trainingOf(room.system.training), trainable(item))))
  if (!rooms.length) return ui.notifications.info(t('TrainNone', { name: crawler.name }))
  const room = await pickRoom(rooms, crawler)
  if (!room) return
  const training = trainingOf(room.system.training)
  const countsForLevel = !!game.settings.get('crawlspace', 'spaceTrainingLevels')
  // The GM may train any skill; a player only the ones the room trains.
  const offered = skills
    .map((item: any) => {
      const allowed = canTrain(training, trainable(item))
      const checked = state.attempted[item.id] === state.day
      const required = Math.max(1, Math.floor(Number(item.system.rank?.base) || 0))
      const progress = state.skillHours[item.id] ?? 0
      const notes = [!allowed && t('TrainNotEligible'), checked && t('TrainChecked'), progress >= required && t('TrainFull')].filter(Boolean)
      return { item, allowed, disabled: checked || (!allowed && !game.user.isGM), label: `${item.name} (${progress}/${required})${notes.length ? ` — ${notes.join(', ')}` : ''}` }
    })
    .filter((entry: any) => entry.allowed || game.user.isGM)
    .sort((a: any, b: any) => Number(b.allowed) - Number(a.allowed) || a.item.name.localeCompare(b.item.name))
  let picked: any[] | null = null
  while (!picked) {
    const answer = await foundry.applications.api.DialogV2.prompt({
      window: { title: `${t('TrainTitle', { name: crawler.name })}: ${room.name}` },
      position: { width: 480 },
      classes: ['crawlspace', 'space-train-dialog'],
      content: `<p>${esc(t('TrainPick', { slots: training.slots, hours: training.hours }))}</p><div class="space-train-skills">${offered
        .map((entry: any) => `<label class="checkbox"><input type="checkbox" name="skill" value="${entry.item.id}" ${entry.disabled ? 'disabled' : ''}> ${esc(entry.label)}</label>`)
        .join('')}</div><p class="hint">${esc(t(countsForLevel ? 'TrainLevelNote' : 'TrainSkillsOnly'))}</p>`,
      ok: { label: t('Train'), callback: (_event: Event, button: any) => [...button.form.querySelectorAll('input[name=skill]:checked')].map((input: any) => input.value) },
      rejectClose: false,
    })
    if (!answer) return
    if (!answer.length) ui.notifications.warn(t('TrainPickOne'))
    else if (answer.length > training.slots) ui.notifications.warn(t('TrainTooMany', { slots: training.slots }))
    else picked = answer.map((id: string) => crawler.items.get(id)).filter(Boolean)
  }
  const lines: string[] = []
  const updates: any[] = []
  let trained = 0
  for (const item of picked) {
    const rank = Math.floor(Number(item.system.rank?.base) || 0)
    const result = trainSkill(state, item.id, rank, training.hours)
    if (result.blocked) continue
    state.skillHours[item.id] = result.progress
    if (countsForLevel) state.levelHours += training.hours
    trained++
    lines.push(t('TrainLine', { skill: item.name, hours: result.added, progress: result.progress, required: result.required }))
    if (!result.ready || rank >= rankCap(crawler, item.name)) continue
    // A full log: the advancement check, as grinding makes it.
    const roll = await rollD20(crawler, { label: item.name, kind: 'check', modifiers: [...penaltyModifiers(crawler)], fast: true })
    if (!roll) continue
    const passed = roll.roll.total >= rank
    if (passed) updates.push({ _id: item.id, 'system.rank.value': item.system.rank.value + 1 })
    state.skillHours[item.id] -= result.required
    state.attempted[item.id] = state.day
    lines.push(g('CheckResult', { name: item.name, total: roll.roll.total, rank, result: g(passed ? 'Advanced' : 'NotAdvanced') }))
  }
  // The training hours count toward the crawler's level, as grinding hours do.
  let level = Math.floor(Number(crawler.system.details?.level) || 0)
  if (trained && countsForLevel) lines.push(t('TrainLevelHours', { hours: training.hours * trained, banked: state.levelHours, level }))
  if (trained && countsForLevel && level > 0 && state.levelHours >= level) {
    const others = game.actors.filter((actor: any) => actor.type === 'crawler' && actor !== crawler).map((actor: any) => Number(actor.system.details?.level) || 0)
    const gained = isUniqueLowestCrawler(level, others) ? (await Roll.create('1d2').evaluate()).total : 1
    level += gained
    state.levelHours = 0
    lines.push(g('LevelResult', { gained, level }))
  }
  await crawler.update({
    'flags.crawlspace.grinding': state,
    // '==' replaces the flag: a merge would carry yesterday's rooms into today.
    [`flags.crawlspace.==${TRAINED}`]: { day: state.day, uses: { ...used, [room.id]: true } },
    'system.details.level': level,
  })
  if (updates.length) await crawler.updateEmbeddedDocuments('Item', updates)
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: crawler }),
    content: `<div class="crawlspace chat-card"><h3>${esc(t('TrainCard', { name: crawler.name, room: room.name }))}</h3><ul>${lines.map((line) => `<li>${esc(line)}</li>`).join('')}</ul></div>`,
  })
}
