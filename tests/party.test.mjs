import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickParty } from '../src/rules/party.ts'

const crawler = (name, hasPlayerOwner, inParty) => ({ name, hasPlayerOwner, flags: inParty === undefined ? {} : { crawlspace: { inParty } } })
const names = (list) => list.map((actor) => actor.name)

test('once the GM adds crawlers to the party, only those are in it', () => {
  const party = pickParty([crawler('Carl', true, true), crawler('Donut', true), crawler('Mordecai', false, true), crawler('Katia', false)])
  assert.deepEqual(names(party), ['Carl', 'Mordecai'])
})

test('until anyone is added, the party is the player-owned crawlers, or every crawler when none is', () => {
  assert.deepEqual(names(pickParty([crawler('Carl', true), crawler('Katia', false)])), ['Carl'])
  assert.deepEqual(names(pickParty([crawler('Carl', false), crawler('Katia', false)])), ['Carl', 'Katia'])
})

test('a crawler the GM removed stays out, even while the party is still guessed', () => {
  assert.deepEqual(names(pickParty([crawler('Carl', true), crawler('Donut', true, false)])), ['Carl'])
  assert.deepEqual(names(pickParty([crawler('Carl', false), crawler('Katia', false, false)])), ['Carl'])
})

test('a mob marked as a crawler counts as a crawler', async () => {
  const { isCrawler } = await import('../src/rules/party.ts')
  assert.equal(isCrawler({ type: 'crawler' }), true)
  assert.equal(isCrawler({ type: 'mob', system: { crawler: true } }), true)
  assert.equal(isCrawler({ type: 'mob', system: { crawler: false } }), false)
  assert.equal(isCrawler({ type: 'companion', system: { crawler: true } }), false)
  assert.equal(isCrawler(null), false)
})

test("a crawler mob joins the players' party only when the GM adds it, never by guess", () => {
  const mob = (name, inParty) => ({ ...crawler(name, false, inParty), type: 'mob', system: { crawler: true } })
  assert.deepEqual(names(pickParty([crawler('Carl', false), mob('Mordecai')])), ['Carl'])
  assert.deepEqual(names(pickParty([crawler('Carl', true), mob('Mordecai', true)])), ['Mordecai'])
  assert.deepEqual(names(pickParty([crawler('Carl', true, true), mob('Mordecai', true)])), ['Carl', 'Mordecai'])
})
