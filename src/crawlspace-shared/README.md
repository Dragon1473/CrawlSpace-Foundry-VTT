# CrawlSpace shared rules (vendored)

Pure modules copied from CrawlSpace's `src/` (same folder layout, so their relative imports still work).
They run the loot generator, sealed loot boxes, minion rules and character builder exactly as the app does.

Local changes, all for the "everything rounds down" rule:

- `shared/effectValues.ts`, `shared/inventoryItems.ts`: percent bonuses use `Math.floor` instead of `Math.round`.
- `shared/manaRestore.ts`: percent mana restore uses `Math.floor` instead of `Math.ceil`.
- `shared/minions.ts`: `raisedHealth` uses `Math.floor` (still at least 1).

When updating from CrawlSpace, copy the files again and reapply these changes.

The character builder modules (`characterBuilder*.ts`, `characterSheet*.ts` and what they import) came over unchanged,
except `shared/characterBuilder.ts`, whose `builderBackgroundOptions` and `builderCombatOptions` offer only what this game's
compendia and items hold: backgrounds no longer start from the app's built-in `bookBackgrounds` list, and a
`bookCombat` choice is kept only when its skill or spell (and effect) is there. So a world without the game compendium
doesn't show book choices whose skills it can't supply. Also `shared/characterSheetModel.ts`, whose two type imports from React components now point at `./actions` and a
local `RichTextValue` type.

The race and class build rules (`shared/raceClassRules.ts`, `shared/raceClassGrants.ts`, and `shared/adventureModels.ts`
for its row helper) came over unchanged.
