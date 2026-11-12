import { App, TFile } from "obsidian";
import { NOTE_KIND, NoteKind } from "./constants";
import { t } from "./i18n";
import type { BjjSettings } from "./settings";
import { Moment, moment } from "./time";

export const DATE_FMT = "YYYY-MM-DD";

export interface Training {
	file: TFile;
	date: Moment;
	type: string;
	duration: number; // minutes
	intensity: number;
	rolls: number;
	subsGiven: number;
	subsReceived: number;
	techniques: string[]; // note names (without [[ ]])
	drills: string[];
}

export interface Position {
	file: TFile;
	name: string;
	category: string;
	perspective: string;
	level: number;
}

export interface Drill {
	file: TFile;
	name: string;
	positions: string[];
	weeklyTarget: number;
	sessions: Moment[]; // newest first
}

export interface Goal {
	file: TFile;
	title: string;
	category: string;
	horizon: string;
	status: string;
	metric: string;
	target: number;
	start: Moment | null;
	deadline: Moment | null;
	manualProgress: number;
}

export interface GoalProgress {
	current: number;
	target: number;
	pct: number; // 0..1
	label: string;
}

const num = (v: unknown, fallback = 0): number => {
	const n = Number(v);
	return Number.isFinite(n) ? n : fallback;
};

/** Frontmatter scalar → string; objects/arrays fall back instead of "[object Object]". */
const str = (v: unknown, fallback = ""): string =>
	typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : fallback;

const asArray = (v: unknown): unknown[] =>
	Array.isArray(v) ? v : v === undefined || v === null || v === "" ? [] : [v];

/** "[[Note|alias]]" → "Note" */
export function linkName(v: unknown): string {
	const s = str(v).trim();
	const m = s.match(/^\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]$/);
	return (m ? m[1] : s).trim();
}

export const toLink = (name: string) => `[[${name}]]`;

const parseDate = (v: unknown): Moment | null => {
	if (!v) return null;
	const raw = v instanceof Date ? v.toISOString() : str(v);
	if (!raw) return null;
	const m = moment(raw, [DATE_FMT, moment.ISO_8601], true);
	return m.isValid() ? m : null;
};

export class BjjData {
	constructor(private app: App, private settings: () => BjjSettings) {}

	private notesOf(kind: NoteKind): { file: TFile; fm: Record<string, unknown> }[] {
		const out: { file: TFile; fm: Record<string, unknown> }[] = [];
		for (const file of this.app.vault.getMarkdownFiles()) {
			const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (fm && fm.bjj === kind) out.push({ file, fm });
		}
		return out;
	}

	trainings(): Training[] {
		return this.notesOf(NOTE_KIND.training)
			.map(({ file, fm }) => ({
				file,
				date: (parseDate(fm.date) ?? moment(file.stat.ctime)).clone().startOf("day"),
				type: str(fm.type, "Other"),
				duration: num(fm.duration),
				intensity: num(fm.intensity),
				rolls: num(fm.rolls),
				subsGiven: num(fm.submissions_given),
				subsReceived: num(fm.submissions_received),
				techniques: asArray(fm.techniques).map(linkName).filter(Boolean),
				drills: asArray(fm.drills).map(linkName).filter(Boolean),
			}))
			.sort((a, b) => b.date.valueOf() - a.date.valueOf());
	}

	positions(): Position[] {
		return this.notesOf(NOTE_KIND.position)
			.map(({ file, fm }) => ({
				file,
				name: file.basename,
				category: str(fm.category, "Other"),
				perspective: str(fm.perspective),
				level: Math.min(5, Math.max(1, num(fm.level, 1))),
			}))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	drills(): Drill[] {
		return this.notesOf(NOTE_KIND.drill)
			.map(({ file, fm }) => ({
				file,
				name: file.basename,
				positions: asArray(fm.positions).map(linkName).filter(Boolean),
				weeklyTarget: num(fm.weekly_target),
				sessions: asArray(fm.sessions)
					.map(parseDate)
					.filter((m): m is Moment => !!m)
					.sort((a, b) => b.valueOf() - a.valueOf()),
			}))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	goals(): Goal[] {
		return this.notesOf(NOTE_KIND.goal)
			.map(({ file, fm }) => ({
				file,
				title: file.basename,
				category: str(fm.category, "Other"),
				horizon: str(fm.horizon),
				status: str(fm.status, "active"),
				metric: str(fm.metric, "checklist"),
				target: num(fm.target),
				start: parseDate(fm.start),
				deadline: parseDate(fm.deadline),
				manualProgress: num(fm.progress),
			}))
			.sort((a, b) => (a.deadline?.valueOf() ?? Infinity) - (b.deadline?.valueOf() ?? Infinity));
	}

	goalProgress(goal: Goal, trainings = this.trainings()): GoalProgress {
		const inPeriod = (tr: Training) =>
			(!goal.start || !tr.date.isBefore(goal.start, "day")) &&
			(!goal.deadline || !tr.date.isAfter(goal.deadline, "day"));

		let current = 0;
		let target = goal.target;
		let unit = "";

		switch (goal.metric) {
			case "sessions":
				current = trainings.filter(inPeriod).length;
				unit = t("dash.unitSessions");
				break;
			case "hours":
				current =
					Math.round((trainings.filter(inPeriod).reduce((s, tr) => s + tr.duration, 0) / 60) * 10) / 10;
				unit = t("dash.unitHours");
				break;
			case "manual":
				current = goal.manualProgress;
				break;
			default: {
				const tasks = (this.app.metadataCache.getFileCache(goal.file)?.listItems ?? []).filter(
					(li) => li.task !== undefined
				);
				target = tasks.length;
				current = tasks.filter((li) => li.task !== " ").length;
				unit = t("dash.unitTasks");
			}
		}

		const pct = goal.status === "done" ? 1 : target > 0 ? Math.min(1, current / target) : 0;
		return { current, target, pct, label: `${current}/${target}${unit}` };
	}

	/** Consecutive weeks (up to the current one) meeting the weekly training goal. */
	weekStreak(trainings = this.trainings()): number {
		const goal = this.settings().weeklyGoal;
		const perWeek = new Map<string, number>();
		for (const tr of trainings) {
			const k = tr.date.format("GGGG-[W]WW");
			perWeek.set(k, (perWeek.get(k) ?? 0) + 1);
		}
		const week = moment().startOf("isoWeek");
		const met = (m: Moment) => (perWeek.get(m.format("GGGG-[W]WW")) ?? 0) >= goal;
		// the current week is still in progress: only count it once it is met
		if (!met(week)) week.subtract(1, "week");
		let streak = 0;
		while (met(week)) {
			streak++;
			week.subtract(1, "week");
		}
		return streak;
	}

	/** How many times each technique appears in training notes. */
	topTechniques(trainings = this.trainings(), limit = 8): [string, number][] {
		const count = new Map<string, number>();
		for (const tr of trainings) for (const n of tr.techniques) count.set(n, (count.get(n) ?? 0) + 1);
		return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
	}
}
