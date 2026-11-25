import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rankNumber, rankStep, rankSteps } from '../src/rules/rank-values.ts'
import { conditionCheck, damageRollFormula, healthPercent, linkedDamageEffects, multiplyDice } from '../src/rules/damage-effects.ts'
import { damageEffectData, defaultAnswers, skillItemData } from '../src/rules/skill-creator.ts'

test('Rank-scaled values: step tables, @rank formulas and plain values, rounded down', () => {
  const steps = '1: 15, 5: 25, 10: 50, 15: 75'
  assert.deepEqual(rankSteps(steps)?.map((step) => step.rank), [1, 5, 10, 15])
  assert.equal(rankNumber(steps, 1), 15)
  assert.equal(rankNumber(steps, 4), 15)
  assert.equal(rankNumber(steps, 5), 25)
  assert.equal(rankNumber(steps, 12), 50)
  assert.equal(rankNumber(steps, 20), 75)
  // Below the first step, the first step.
  assert.equal(rankNumber('3: 6, 10: 9', 1), 6)
  assert.equal(rankNumber('@rank', 7), 7)
  assert.equal(rankNumber('@rank*2', 7), 14)
  assert.equal(rankNumber('RANK / 2', 7), 3)
  assert.equal(rankNumber('×3', 1), 0, 'a bare operator is not a value')
  assert.equal(rankNumber('3', 9), 3)
  assert.equal(rankNumber('', 9, 1), 1)
  assert.equal(rankNumber('lots', 9, 1), 1)
  assert.equal(rankNumber('process.exit()', 9, 1), 1)
  // Steps can hold formulas, and any text (a cooldown).
  assert.equal(rankNumber('1: 2, 10: @rank', 12), 12)
  assert.equal(rankStep('1: 24 hours; 5: 12 hours; 10: 6 hours; 15: 3 hours', 6), '12 hours')
  assert.equal(rankStep('24 hours', 6), '24 hours')
  assert.equal(rankSteps('1 hour'), null)
})

test('multiplyDice wraps only the dice, then adds the rest', () => {
  assert.equal(multiplyDice('1d6+@strMod+2', 3), '(1d6)*3+@strMod+2')
  assert.equal(multiplyDice('1d6+1d4-1', 2), '(1d6+1d4)*2-1')
  assert.equal(multiplyDice('@strMod+2d8', 4), '(2d8)*4+@strMod')
  assert.equal(multiplyDice('(1d6)+(1d4)', 5), '((1d6)+(1d4))*5')
  assert.equal(multiplyDice('-1d4+3', 2), '(-1d4)*2+3')
  assert.equal(multiplyDice('5', 3), '5', 'no dice: unchanged')
  assert.equal(multiplyDice('1d6+2', 1), '1d6+2')
})

test('damageRollFormula: dice multiplier before modifiers, total multiplier around everything', () => {
  // A dice multiplier of 3 on 1d6+STR, with a Rank die and a buff added once.
  const strike = { formula: '1d6+STR', rankDice: '(1d4)', undoubled: '2', diceMultiplier: 3 }
  assert.equal(damageRollFormula(strike, { floor: 2 }), '(1d6+(1d4))*3+@strMod+2')
  // A Critical Hit doubles the base dice first; Rank dice stay single.
  assert.equal(damageRollFormula(strike, { floor: 2, tier: 'critical' }), '(2d6+(1d4))*3+@strMod+2')
  // A total multiplier of 2 doubles the total, the Amazing Hit's Floor included.
  const choke = { formula: '1d8+STR', undoubled: '1', totalMultiplier: 2 }
  assert.equal(damageRollFormula(choke, { floor: 3 }), '(1d8+@strMod+1)*2')
  assert.equal(damageRollFormula(choke, { floor: 3, tier: 'amazing' }), '(1d8+@strMod+1+3)*2')
  // No multipliers: as before.
  assert.equal(damageRollFormula({ formula: '1d6', rankDice: '(1d4)', undoubled: '1' }, { floor: 1 }), '1d6+(1d4)+1')
  assert.equal(damageRollFormula({ formula: '' }, { floor: 1 }), '')
})

test('healthPercent reads a crawler\'s health or a mob\'s Health Bar', () => {
  assert.equal(healthPercent({ health: { value: 25, pct: 15 }, healthBar: { value: 1, max: 10 } }), 15)
  assert.equal(healthPercent({ health: { value: 3, max: 10 }, healthBar: { value: 3, max: 10 } }), 30)
  assert.equal(healthPercent({ healthBar: { value: 1, max: 3 } }), 33)
  assert.equal(healthPercent({}), null)
})

test('conditionCheck: target health at or below a Rank-scaled threshold', () => {
  const condition = { type: 'targetHealthAtMost', value: '1: 15, 5: 25, 10: 50, 15: 75' }
  assert.equal(conditionCheck(condition, 1, [{ name: 'Goblin', health: 15 }]).met, true)
  assert.equal(conditionCheck(condition, 1, [{ name: 'Goblin', health: 16 }]).met, false)
  assert.equal(conditionCheck(condition, 5, [{ name: 'Goblin', health: 25 }]).met, true)
  assert.equal(conditionCheck(condition, 15, [{ name: 'Goblin', health: 75 }]).met, true)
  const none = conditionCheck(condition, 1, [])
  assert.equal(none.met, false)
  assert.equal(none.note?.key, 'Condition.NoTarget')
  const above = conditionCheck(condition, 1, [{ name: 'A', health: 5 }, { name: 'B', health: 50 }])
  assert.equal(above.met, false)
  assert.deepEqual(above.note, { key: 'Condition.HealthAbove', data: { name: 'B', health: 50, threshold: 15 } })
  assert.equal(conditionCheck(condition, 1, [{ name: 'Door', health: null }]).met, false)
  assert.equal(conditionCheck(null, 1, []).met, true, 'no condition is always met')
})

// Made-up skills in the shape of a conditional total multiplier and a Rank dice multiplier.
const squeeze = (rank, extra = {}) => ({
  name: 'Sleeper Hold',
  id: 'squeeze',
  rank,
  effect: { enabled: true, skills: ["Wrasslin'"], damageMode: 'multiplyTotal', multiplier: '1: 2, 10: 3, 15: 5', condition: { type: 'targetHealthAtMost', value: '1: 15, 5: 25, 10: 50, 15: 75' } },
  damage: { base: '', dice: '' },
  ...extra,
})
const heavyBlow = (rank, extra = {}) => ({
  name: 'Heavy Blow',
  id: 'blow',
  rank,
  effect: { enabled: true, skills: ['Pugilism'], damageMode: 'multiplyDice', multiplier: '@rank', condition: { type: '', value: '' } },
  damage: { base: '1d4', dice: '' },
  ...extra,
})

test('A met condition ticks the option; an unmet one makes it unavailable, with the reason', () => {
  const [met] = linkedDamageEffects([squeeze(1)], "Wrasslin'", [{ name: 'Goblin', health: 15 }])
  assert.equal(met.enabled, true)
  assert.equal(met.unavailable, undefined)
  assert.equal(met.totalMultiplier, 2)
  assert.equal(met.diceMultiplier, undefined)
  assert.equal(met.damage, '')
  assert.equal(met.itemId, 'squeeze')
  const [unmet] = linkedDamageEffects([squeeze(1)], 'wrasslin’', [{ name: 'Goblin', health: 50 }])
  assert.equal(unmet.enabled, false)
  assert.equal(unmet.unavailable?.key, 'Condition.HealthAbove')
  // Rank 10: 50% or less, ×3; Rank 15: 75%, ×5.
  assert.equal(linkedDamageEffects([squeeze(10)], "Wrasslin'", [{ name: 'G', health: 50 }])[0].totalMultiplier, 3)
  assert.equal(linkedDamageEffects([squeeze(15)], "Wrasslin'", [{ name: 'G', health: 75 }])[0].enabled, true)
  assert.equal(linkedDamageEffects([squeeze(1)], 'Pugilism', [{ name: 'G', health: 1 }]).length, 0)
})

test('A multiplying effect with no condition is offered unticked; a cooling one is unavailable', () => {
  const [strike] = linkedDamageEffects([heavyBlow(6)], 'Pugilism')
  assert.equal(strike.enabled, false)
  assert.equal(strike.unavailable, undefined)
  assert.equal(strike.diceMultiplier, 6)
  assert.equal(strike.damage, '', 'a multiplying effect adds no damage of its own')
  const [cooling] = linkedDamageEffects([heavyBlow(6, { cooldown: '4 hours' })], 'Pugilism')
  assert.deepEqual(cooling.unavailable, { key: 'OnCooldown', data: { remaining: '4 hours' } })
  assert.equal(cooling.enabled, false)
  // An adding effect keeps adding its damage.
  const [adds] = linkedDamageEffects([{ ...heavyBlow(2), effect: { enabled: true, skills: ['Pugilism'] } }], 'Pugilism')
  assert.equal(adds.damage, '1d4')
  assert.equal(adds.diceMultiplier, undefined)
})

test('Skill Creator: damage effect settings', () => {
  const answers = { ...defaultAnswers(), name: 'Big Squeeze', effect: true, effectSkills: "Wrasslin', Grapple Artist", effectMode: 'multiplyTotal', effectMultiplier: '1: 2, 10: 3', effectCondition: 'targetHealthAtMost', effectThreshold: '1: 15, 10: 30' }
  assert.deepEqual(damageEffectData(answers), {
    enabled: true,
    skills: ["Wrasslin'", 'Grapple Artist'],
    addRank: null,
    mode: '',
    damageMode: 'multiplyTotal',
    multiplier: '1: 2, 10: 3',
    condition: { type: 'targetHealthAtMost', value: '1: 15, 10: 30' },
  })
  const labels = { range: 'Melee', targets: 'Targets: Enemies', limitations: 'Limitations:', note: 'Made with the Skill Creator.' }
  assert.equal(skillItemData(answers, labels).system.damageEffect.damageMode, 'multiplyTotal')
  assert.equal(skillItemData(defaultAnswers(), labels).system.damageEffect, undefined, 'not a damage effect: left at its defaults')
  assert.deepEqual(damageEffectData({ ...answers, effectMode: 'add', effectCondition: '' }).condition, { type: '', value: '' })
  assert.equal(damageEffectData({ ...answers, effectMode: 'add' }).multiplier, '')
})
