import { test } from 'node:test'
import assert from 'node:assert/strict'
import { standardDebuffNamed } from '../src/rules/debuffs.ts'

test('a condition named for a standard debuff is that debuff, with or without a Rank suffix', () => {
  assert.equal(standardDebuffNamed('Poisoned')?.id, 'poisoned')
  assert.equal(standardDebuffNamed('poisoned (Rank 5)')?.id, 'poisoned')
  assert.equal(standardDebuffNamed('Burned (Ranks 10–14)')?.id, 'burned')
  assert.equal(standardDebuffNamed('Venom Rush'), undefined)
})
