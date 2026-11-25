/**
 * Today's number on the game clock, for "once a day" uses (grinding, Personal Space training rooms, meals, showers and
 * the crafting boost). Days are the dayLength setting's length and turn over when the floor-collapse timer's countdown
 * reaches a whole number of days (8 days left, then 7, ...). Without a floor timer, they turn over at whole days of
 * world time.
 */
import { clockDay, displayDayHours } from './rules/time'

export function gameDay(): number {
  const timers: any[] = game.settings.get('crawlspace', 'timers') ?? []
  const floor = timers.find((timer) => timer?.floor)
  // A running timer ends at `end`; a paused one would end `remaining` seconds from now.
  const anchor = floor ? (floor.end ?? game.time.worldTime + (Number(floor.remaining) || 0)) : 0
  return clockDay(game.time.worldTime, displayDayHours(), anchor)
}
