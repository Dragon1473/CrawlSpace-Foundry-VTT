/** Pure time rules from CrawlSpace effectDurations.ts, partyTimers.ts and UpkeepPopup.ts. */
export const ROUND_SECONDS = 10
export const DAY_SECONDS = 108000

export type TimeParts = { days: number; hours: number; minutes: number; seconds: number }

/**
 * How many hours a day has on screen: the dungeon's thirty (default) or an Earth day of twenty-four (the `dayLength`
 * world setting, apps/time.ts). It only changes how time reads and how the day field of a time entry counts. Every
 * duration, cooldown, rest and timer keeps its length in seconds, and "1 day" in rules text stays a thirty-hour
 * dungeon day (DAY_SECONDS). "Once a day" uses do follow it: they reset at each new day of the clock (clockDay).
 */
export const DAY_LENGTHS = [30, 24] as const
let dayHours = 30
export const displayDayHours = () => dayHours
export function setDisplayDayHours(hours: unknown) {
  dayHours = Number(hours) === 24 ? 24 : 30
}

/**
 * Which day of the game clock this is, counting days of the dayLength setting. Days turn over whenever the time left
 * until `anchor` (the floor timer's end, game-day.ts) is a whole number of days; with anchor 0, at whole days of world
 * time. Never below 0, and it only grows as time passes.
 */
export function clockDay(seconds: number, hoursPerDay = dayHours, anchor = 0) {
  const length = hoursPerDay * 3600
  const phase = ((Math.floor(Number(anchor) || 0) % length) + length) % length
  return Math.floor((Math.max(0, Number(seconds) || 0) - phase) / length) + 1
}

/** Accept overflow in any field, then normalize, a day field counting the display day's hours. */
export function timePartsSeconds(parts: TimeParts, hoursPerDay = dayHours): number {
  if (Object.values(parts).some((value) => !Number.isSafeInteger(value) || value < 0)) throw new Error('Invalid time fields')
  const total = parts.days * hoursPerDay * 3600 + parts.hours * 3600 + parts.minutes * 60 + parts.seconds
  if (!Number.isSafeInteger(total)) throw new Error('Invalid time fields')
  return total
}

/** Break game seconds into normalized day/hour/minute/second fields (display days). */
export function timeParts(value: number, hoursPerDay = dayHours): TimeParts {
  const seconds = Math.max(0, Math.floor(value))
  return { days: Math.floor(seconds / (hoursPerDay * 3600)), hours: Math.floor(seconds / 3600) % hoursPerDay, minutes: Math.floor(seconds / 60) % 60, seconds: seconds % 60 }
}

/** Explicit quantities only; conditional prose stays manual. A dungeon day is thirty hours. */
export function durationSeconds(value: unknown): number | null {
  if (typeof value !== 'string' || value.length > 1000) return null
  const text = value.trim().toLowerCase().replace(/^(?:for |lasts |until (?:the )?end of (?:the )?)/, '').replace(/\.$/, '')
  if (text === 'next round') return ROUND_SECONDS
  if (text.includes(' or ')) {
    const parts = text.split(' or ').map(durationSeconds)
    return parts[0] !== null && parts.every((part) => part === parts[0]) ? parts[0] : null
  }
  const units: Record<string, number> = { d: DAY_SECONDS, day: DAY_SECONDS, days: DAY_SECONDS, h: 3600, hr: 3600, hrs: 3600, hour: 3600, hours: 3600, m: 60, min: 60, mins: 60, minute: 60, minutes: 60, s: 1, sec: 1, secs: 1, second: 1, seconds: 1, round: ROUND_SECONDS, rounds: ROUND_SECONDS }
  let seconds = 0
  let found = false
  const remainder = text.replace(/(\d+(?:\.\d+)?)\s*(days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s|rounds?)\b/g, (_match, amount: string, unit: string) => {
    seconds += Number(amount) * units[unit]
    found = true
    return ''
  }).replace(/\band\b|[\s,]/g, '')
  return found && !remainder && Number.isFinite(seconds) && seconds >= 0 && seconds <= 108000000 ? Math.floor(seconds) : null
}

/** Event durations use native ActiveEffect expiry events, scoped to the affected actors. */
export function durationEvent(value: unknown): string | null {
  const text = String(value ?? '').trim().toLowerCase().replace(/\.$/, '')
  const events: Record<string, string> = {
    'until end of combat': 'combatEnd',
    'until the end of combat': 'combatEnd',
    'until you enter a saferoom': 'safeRoom',
    'until you enter a safe room': 'safeRoom',
    'until you complete a long rest': 'longRest',
    'until you leave this floor': 'leaveFloor',
    'until you are healed at least 1 health slot': 'healed',
  }
  return events[text] ?? null
}

/** Rest lengths from UpkeepPopup.ts; hourly recovery accepts whole completed hours. */
export function restSeconds(kind: string, hours = 1): number {
  if (!['short', 'long', 'full', 'hourly'].includes(kind)) throw new Error('Invalid rest kind')
  if (kind === 'hourly' && (!Number.isSafeInteger(hours) || hours < 1)) throw new Error('Invalid completed hours')
  return ({ short: 7200, long: 28800, full: DAY_SECONDS } as Record<string, number>)[kind] ?? hours * 3600
}

/** Compact dd:hh:mm:ss display (display days), shared by cooldowns and the GM clock. */
export function formatTime(value: number, hoursPerDay = dayHours): string {
  const { days, hours, minutes, seconds } = timeParts(value, hoursPerDay)
  return [days, hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0')).join(':')
}

/**
 * Duration text for a number of seconds, which durationSeconds reads back to the same seconds: "1 day 2 hours" with
 * thirty-hour display days, and whole hours with twenty-four ("30 hours", since "1 day" in rules text means thirty).
 */
export function durationText(value: number, hoursPerDay = dayHours): string {
  const seconds = Math.max(0, Math.floor(value))
  const parts = hoursPerDay === 30 ? timeParts(seconds, 30) : { days: 0, hours: Math.floor(seconds / 3600), minutes: Math.floor(seconds / 60) % 60, seconds: seconds % 60 }
  const unit = (amount: number, one: string, many: string) => (amount ? `${amount} ${amount === 1 ? one : many}` : '')
  return [unit(parts.days, 'day', 'days'), unit(parts.hours, 'hour', 'hours'), unit(parts.minutes, 'minute', 'minutes'), unit(parts.seconds, 'second', 'seconds')]
    .filter(Boolean)
    .join(' ')
}
