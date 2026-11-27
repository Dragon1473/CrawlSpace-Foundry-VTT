
# CrawlSpace for Foundry VTT — DanKoz Development Fork

![Foundry VTT](https://img.shields.io/badge/Foundry_VTT-V14-blue)
![Experimental Release](https://img.shields.io/github/v/release/Dragon1473/CrawlSpace-Foundry-VTT?include_prereleases&label=Test%20Release)
![Tests](https://img.shields.io/badge/Tests-404%20Passing-brightgreen)
![License](https://img.shields.io/badge/License-MIT-green)
![Status](https://img.shields.io/badge/Status-Experimental-orange)

An unofficial development fork of [Mythaell's CrawlSpace for Foundry VTT](https://github.com/mythaell/CrawlSpace-Foundry-VTT).

## About This Fork

As a member of the Dungeon Crawler Carl tabletop RPG community and a tech enthusiast with some coding background, I created this fork as a way to support my group's (seemingly eternal) Game Master from a technical standpoint.

My goal is to explore enhancements, improve gameplay automation, resolve bugs, and expand the functionality available to Game Masters and players, ultimately allowing our GM to spend less time managing the technical aspects of the game and more time running it.

This project also serves as a hands-on software development learning experience, emphasizing test-driven development, regression testing, version control, and automated release management.

Where appropriate, improvements will be submitted to the original project for consideration and potential inclusion in future official releases.

## Current Test Release

| | |
|---|---|
| **Version** | v0.9.8.49.2 |
| **Upstream Baseline** | v0.9.8.49 |
| **Compatibility** | Foundry VTT V14 |
| **Status** | Experimental — live gameplay validation pending |

[View Experimental Releases](https://github.com/Dragon1473/CrawlSpace-Foundry-VTT/releases)

### Enhancements

| Enhancement | Description | Status |
|---|---|---|
| Inherent Attack Spells | Corrects attack resolution and advancement behavior for temporarily granted inherent spells. | Automated testing passed |
| Reduce Condition | Adds configurable condition stack reduction through Rule Elements, including consumable support and Self/Other targeting. | Automated testing passed |

### Quality Assurance

- 404 automated tests passing.
- 113 additional tests beyond the upstream baseline.
- TypeScript validation and production builds passing.
- Automated GitHub Actions release packaging.
- Live Foundry and multiplayer testing pending.

## Installing the Experimental Build

> [!WARNING]
> These builds are intended for testing and are not official CrawlSpace releases. Back up your Foundry data before installation. Testing in an isolated environment is recommended.

In Foundry's setup screen:

1. Open **Game Systems**.
2. Select **Install System**.
3. Enter the following manifest URL.
4. Click **Install**.

```
https://github.com/Dragon1473/CrawlSpace-Foundry-VTT/releases/download/v0.9.8.49.2/system.json
```

Experimental releases retain the original CrawlSpace system ID (`crawlspace`) for compatibility with existing worlds. They are not separate, side-by-side installations.

Version-specific manifests are used to prevent unintended updates between experimental releases. Installing a newer experimental build requires using its corresponding manifest URL.

### Official Upstream Release

Users looking for the official CrawlSpace distribution should use the original project's manifest:

```
https://github.com/mythaell/CrawlSpace-Foundry-VTT/releases/latest/download/system.json
```

## Development Approach

Enhancements are developed on independent feature branches, validated through automated testing, and combined into experimental release builds.

The goal is to keep individual contributions isolated and suitable for independent upstream review.

### Repository Structure

| Branch | Purpose |
|---|---|
| `fork-home` | Public-facing repository documentation |
| `main` | Clean upstream mirror |
| `development` | Development foundation |
| `fix/*` | Independent bug fixes |
| `feature/*` | Independent enhancements |
| `release/*` | Experimental release builds |

### Local Development

Requirements:

- Git
- Node.js 24 (the version used by this fork's release workflow)
- npm

```bash
npm ci
npm test
npm run typecheck
npm run build
```

See the upstream [Development documentation](https://github.com/mythaell/CrawlSpace-Foundry-VTT/wiki/Development) for information on building compendiums, linking the system into Foundry, and releasing.

## Reporting Issues

Please report issues specific to this fork through its [GitHub Issues page](https://github.com/Dragon1473/CrawlSpace-Foundry-VTT/issues).

When reporting a bug, please include:

- Foundry VTT version.
- CrawlSpace experimental build version.
- Steps to reproduce the issue.
- Expected and actual behavior.
- Relevant screenshots or browser console errors.

Issues affecting the official CrawlSpace system should be directed to the [upstream repository](https://github.com/mythaell/CrawlSpace-Foundry-VTT).

---

## About CrawlSpace

CrawlSpace is a game system for **Foundry Virtual Tabletop V14**. It covers:

- Health and shield slots.
- Ranked skills and spells.
- Typed damage with resistances.
- Stacking debuffs.
- Five-phase Mob/Crawler combat.

It also has the CrawlSpace app's party tools: crawler frames, upkeep and advancement, time and countdowns, grinding, awards, loot boxes, and a character builder.

**Documentation is available in the [official CrawlSpace wiki](https://github.com/mythaell/CrawlSpace-Foundry-VTT/wiki).**

### Content and Compendiums

The system ships with homebrew skills, spells and items, plus Actions and Interrupt Actions compendiums.

Published book content is not included. Import your own from the CrawlSpace app instead.

See [Importing from CrawlSpace](https://github.com/mythaell/CrawlSpace-Foundry-VTT/wiki/Importing-from-CrawlSpace).

## Core Features

### Crawler Sheet

- Health slots, shield slots, and mana.
- Enhanced stats.
- Skills and spells with rank caps, cooldowns, and advancement marks.
- An Attacks table built from weapons, unarmed skills, and attack spells.
- Hotlist, Actions, and Interrupt Actions.
- A paper doll for equipment.
- Pets, mounts, and minions.

### Mob, Boss, and NPC Sheets

- Stat budgets.
- Attacks with areas and on-hit debuffs.
- NPCs that borrow a mob's stat block.

### Combat

Foundry's combat tracker steps through:

1. Mob Declaration.
2. Crawler Reaction.
3. Mob Resolution.
4. Crawler Action.
5. Clean Up.

Mobs declare attacks; crawlers answer with Evade, Tank, Shield Block, or Blade Clap.

### Damage

Chat-card Apply, Heal, and Undo. Damage passes through shields, Shield Block, DR, resistances, and immunities.

### Effects

Active Effects edited through Rule Elements:

- Stat, rank, health, mana, and DR bonuses.
- Resistances and immunities.
- Advantage and disadvantage.
- Triggers on hits, misses, crits, and Clean Up.
- Auras, light, and raised minions.

### GM Tools

- Party membership and crawler frames.
- Party Upkeep (rests, safe-room, session and floor advancement, level up, stat points).
- Time & Timers with the floor-collapse countdown.
- Grinding.
- Crawler Awards.
- Loot boxes, auto-loot, and the item generator.
- Grid calibration from a printed map.

### Import

CrawlSpace character, party, and account exports. Importing again updates what was imported before.

### Macros

Drag items, attacks, and actions to the hotbar, or script with `game.crawlspace`.

## Acknowledgments

Full credit for the original CrawlSpace system belongs to **Mythaell** and the contributing CrawlSpace community.

This fork builds upon their work and is intended to support the continued development of the system.

### Community Contributors

Homebrew content in the system comes from the community. Thank you to:

- **TallJustin** (Crawler #7641; Discord: justinthegiant2): the Personal Space system and its tables (the Personal Space Upgrades and Personal Space Tables compendiums).
- **diffendice & Dungeon Anarchists**: the Homebrew Skill Flow Chart the Skill Creator follows.
- **Chorus of Sanctuary**: the 1000 Hobbies roll tables ([pointmongo.com](https://pointmongo.com)) in the Hobby Tables compendium.
- The community **"Earth Hobbies"** sheet: the Earth Hobbies (80) table.

Each homebrew addition can be turned off in the system settings (the Homebrew group).

## License

The code is under the [MIT License](LICENSE).

The Quantico fonts are under the SIL Open Font License ([assets/fonts/OFL.txt](assets/fonts/OFL.txt)).

This is an unofficial development fork and is not an official CrawlSpace distribution.
