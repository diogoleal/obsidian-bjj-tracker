# Changelog

## 1.0.2

### Fixed
- Resolved the remaining community directory review warnings: `moment` (used through Obsidian's API) is now a
  direct dev dependency, so its types resolve in any install layout instead of falling back to `any`.
- Replaced the deprecated `builtin-modules` package with Node's built-in `node:module`.

### Changed
- Release assets now come with GitHub build provenance attestations.
- Release notes are taken from this changelog.

No functional changes: the plugin bundle is identical to 1.0.1.

## 1.0.1

Requires Obsidian 1.13 or later (older versions keep receiving 1.0.0).

### Changed
- Settings use Obsidian's declarative settings API, so they appear in the settings search.
- Removed the deprecated slider tooltip (Obsidian shows the slider value natively).

### Fixed
- Embedded `bjj` blocks now re-render when settings change.
- Note properties holding objects or lists no longer render as `[object Object]`.
- Stricter typing of frontmatter and saved settings; command pickers handle async actions explicitly.
- Obsidian's official ESLint rules (`eslint-plugin-obsidianmd`) now run on every build and release.

## 1.0.0

First release.

- Log training sessions: date, type, duration, intensity, academy, instructor, rolls, submissions, techniques,
  drills, injuries and notes.
- Position library with categories, perspective and proficiency levels from 1 (Aware) to 5 (Mastered).
- Drills with sets × reps, time, weekly target and session history.
- Goals with horizon, deadline, status and automatic progress (checklist, sessions, mat hours or manual).
- Stats dashboard: belt and stripes, weekly goal and streak, 26-week heatmap, goals, drills, positions,
  techniques and recent sessions.
- Embeddable `bjj` code block to place any dashboard section in a note.
- English and Portuguese (Brazil) interface.
