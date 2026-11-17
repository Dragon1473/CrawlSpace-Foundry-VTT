import { test } from 'node:test'
import assert from 'node:assert/strict'
import { migrateMaster } from '../src/rules/follower-master.ts'

test('the old companion.master and minion.caster links move onto master', () => {
  assert.equal(migrateMaster({ companion: { master: 'Actor.carl' } }).master, 'Actor.carl')
  assert.equal(migrateMaster({ minion: { caster: 'Actor.katia' } }).master, 'Actor.katia')
})

test('a partial update without a link leaves master alone, so editing a pet keeps its crawler', () => {
  assert.equal('master' in migrateMaster({ companion: { occupants: '' }, level: 3 }), false)
  assert.equal('master' in migrateMaster({ minion: { temporary: false, condition: '' } }), false)
  assert.equal(migrateMaster({ master: 'Actor.carl', companion: {} }).master, 'Actor.carl')
  assert.equal(migrateMaster({ master: '' }).master, '')
})
