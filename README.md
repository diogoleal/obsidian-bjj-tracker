# BJJ Tracker

An [Obsidian](https://obsidian.md) plugin to log your Brazilian Jiu-Jitsu **training sessions**, **positions & techniques**,
**drills** and **goals** as regular notes, and follow your progress on a stats dashboard.

The interface is available in **English** and **Portuguese** (picked automatically from Obsidian's language setting).

## Features

- **Training log** — date, type (Gi, No-Gi, open mat, competition…), duration, intensity, academy, instructor,
  rolls, submissions landed / times tapped, techniques worked, drills done, injuries and notes.
- **Position library** — category, perspective (top / bottom), proficiency level from 1 (*Aware*) to 5 (*Mastered*),
  video reference and related positions, with a note template for key details, common mistakes and follow-ups.
- **Drills** — sets × reps, time, weekly target and a history of every session.
- **Goals** — short / medium / long term, deadline, status and automatic progress tracking.
- **Dashboard** — current belt and stripes, sessions this week vs. your weekly goal, weekly streak, 26-week
  frequency heatmap, time per training type, active goals with progress bars, this week's drills, position
  repertoire by level, positions you haven't trained in a while, most-trained techniques and recent sessions.
- **Embeddable** — drop any part of the dashboard into a note (e.g. your daily note) with a `bjj` code block.

Everything is stored as plain Markdown with properties (frontmatter), so you can edit notes by hand, move them
anywhere in your vault, or query them with Dataview / Bases.

## Usage

Open the dashboard from the ribbon (swords icon) or the command palette. Available commands:

| Command | What it does |
|---|---|
| Open dashboard | Opens the stats dashboard in a new tab |
| Log training session | Form to log a session |
| New position / technique | Form to add a position to your library |
| New drill | Form to create a drill |
| New goal | Form to create a goal |
| Log drill session (today) | Pick a drill and log a session for today |
| Change position proficiency level | Uses the active note if it is a position |
| Complete goal | Uses the active note if it is a goal |

### Goal progress

| Metric | How progress is measured |
|---|---|
| Checklist | Ticked `- [x]` tasks in the goal note |
| Number of sessions | Training notes between `start` and `deadline` (automatic) |
| Mat hours | Sum of training `duration` between `start` and `deadline` (automatic) |
| Manual | The `progress` counter, incremented with the dashboard's **+1** button |

### Dashboard in a note

An empty block renders the whole dashboard; otherwise list the sections you want:

````markdown
```bjj
summary
goals
drills
```
````

Sections: `summary`, `heatmap`, `goals`, `drills`, `positions`, `techniques`, `recent`.

## Note format

The `bjj` property identifies the note type. Example training note:

```yaml
---
bjj: training
date: 2026-11-12
type: Gi
duration: 90
academy: My Academy
instructor: Professor X
intensity: 7
rolls: 5
submissions_given: 2
submissions_received: 1
techniques: ["[[Armbar from closed guard]]"]
drills: ["[[Hip escapes]]"]
injuries: ""
tags: [bjj/training]
---
```

| Type | Main properties |
|---|---|
| `training` | `date`, `type`, `duration`, `intensity`, `rolls`, `submissions_given`, `submissions_received`, `techniques`, `drills` |
| `position` | `category`, `perspective`, `level` (1–5), `video`, `related` |
| `drill` | `positions`, `sets`, `reps`, `time_min`, `weekly_target`, `sessions` (list of dates) |
| `goal` | `category`, `horizon`, `status` (`active` / `paused` / `done` / `abandoned`), `start`, `deadline`, `metric`, `target`, `progress` |

## Settings

Belt, stripes and last promotion date; default academy, instructor, training type and duration; weekly training
goal; folder names (default `BJJ/Training`, `BJJ/Positions`, `BJJ/Drills`, `BJJ/Goals`); whether to open notes
after creating them.

## Installation

Requires Obsidian 1.13 or later.

**Community plugins** (once published): Settings → Community plugins → Browse → search for "BJJ Tracker".

**Manual**: download `main.js`, `manifest.json` and `styles.css` from the
[latest release](https://github.com/diogoleal/obsidian-bjj-tracker/releases/latest) into
`<vault>/.obsidian/plugins/bjj-tracker/`, then enable the plugin.

**BRAT**: add `diogoleal/obsidian-bjj-tracker` as a beta plugin.

## Development

```bash
npm install
npm run dev                                   # rebuild on change
npm run lint                                  # Obsidian's official ESLint rules
npm run build                                 # type-check + lint + production build
VAULT=/path/to/vault npm run install-vault    # copy the build into a vault
```

### Releasing

```bash
npm version patch        # bumps package.json, manifest.json and versions.json
git push --follow-tags   # the Release workflow builds and attaches main.js, manifest.json, styles.css
```

## License

[MIT](LICENSE)
