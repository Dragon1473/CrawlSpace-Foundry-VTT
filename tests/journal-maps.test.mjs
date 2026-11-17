import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapSceneData } from '../src/rules/journal-maps.ts'

test('an image map becomes a scene the size of the image, with the image as its background', () => {
  const data = mapSceneData('Old Town', 'maps/old-town.webp', { width: 4096, height: 2731 })
  assert.equal(data.name, 'Old Town')
  // V14 keeps the map image on the scene's level.
  assert.equal(data.levels[0].background.src, 'maps/old-town.webp')
  assert.equal(data.levels[0]._id, 'defaultLevel0000')
  assert.equal(data.width, 4096)
  assert.equal(data.height, 2731)
  assert.equal(data.padding, 0)
  assert.equal(data.grid.size, 100)
})

test('odd image sizes round down, and tiny or missing sizes fall back to a usable scene', () => {
  const data = mapSceneData('X', 'x.png', { width: 1999.7, height: 1000.2 })
  assert.deepEqual([data.width, data.height], [1999, 1000])
  const fallback = mapSceneData('Y', 'y.png', { width: 0, height: NaN })
  assert.deepEqual([fallback.width, fallback.height], [4000, 3000])
})
