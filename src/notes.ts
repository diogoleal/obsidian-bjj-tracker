import { App, Notice, TFile, normalizePath } from "obsidian";
import { moment } from "./time";
import { NOTE_KIND } from "./constants";
import { DATE_FMT, toLink } from "./data";
import { L, t } from "./i18n";
import { BjjSettings, folderFor } from "./settings";

export interface NewTraining {
	date: string;
	type: string;
	duration: number;
	academy: string;
	instructor: string;
	intensity: number;
	rolls: number;
	subsGiven: number;
	subsReceived: number;
	techniques: string[];
	drills: string[];
	injuries: string;
	notes: string;
}

export interface NewPosition {
	name: string;
	category: string;
	perspective: string;
	level: number;
	video: string;
	related: string[];
	details: string;
}

export interface NewDrill {
	name: string;
	positions: string[];
	sets: number;
	reps: number;
	time: number;
	weeklyTarget: number;
	description: string;
}

export interface NewGoal {
	title: string;
	category: string;
	horizon: string;
	deadline: string;
	metric: string;
	target: number;
	why: string;
	steps: string[];
}

export function sanitizeFileName(name: string): string {
	return name.replace(/[\\/:*?"<>|#^[\]]/g, "-").replace(/\s+/g, " ").trim() || "Untitled";
}

const bullets = (items: string[], fallback = "- ") =>
	items.length ? items.map((i) => `- ${i}`).join("\n") : fallback;

type Frontmatter = Record<string, unknown>;

const today = () => moment().format(DATE_FMT);

export class NoteFactory {
	constructor(private app: App, private settings: () => BjjSettings) {}

	private async ensureFolder(path: string) {
		let cur = "";
		for (const part of normalizePath(path).split("/")) {
			cur = cur ? `${cur}/${part}` : part;
			if (!this.app.vault.getAbstractFileByPath(cur)) await this.app.vault.createFolder(cur);
		}
	}

	private async create(
		folder: string,
		baseName: string,
		frontmatter: Record<string, unknown>,
		body: string
	): Promise<TFile> {
		await this.ensureFolder(folder);
		const base = sanitizeFileName(baseName);
		let path = normalizePath(`${folder}/${base}.md`);
		for (let i = 2; this.app.vault.getAbstractFileByPath(path); i++) {
			path = normalizePath(`${folder}/${base} (${i}).md`);
		}
		const file = await this.app.vault.create(path, body);
		// processFrontMatter takes care of safe YAML serialization
		await this.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
			Object.assign(fm, frontmatter);
		});
		if (this.settings().openAfterCreate) {
			await this.app.workspace.getLeaf(false).openFile(file);
		}
		return file;
	}

	findByName(name: string): TFile | null {
		return this.app.metadataCache.getFirstLinkpathDest(name, "");
	}

	async createTraining(tr: NewTraining): Promise<TFile> {
		const fm = {
			bjj: NOTE_KIND.training,
			date: tr.date,
			type: tr.type,
			duration: tr.duration,
			academy: tr.academy,
			instructor: tr.instructor,
			intensity: tr.intensity,
			rolls: tr.rolls,
			submissions_given: tr.subsGiven,
			submissions_received: tr.subsReceived,
			techniques: tr.techniques.map(toLink),
			drills: tr.drills.map(toLink),
			injuries: tr.injuries,
			tags: ["bjj/training"],
		};
		const title = t("note.trainingTitle", {
			date: moment(tr.date, DATE_FMT).format(t("date.long")),
			type: tr.type,
		});
		const body = [
			`# ${title}`,
			"",
			`## ${t("note.classTechniques")}`,
			bullets(tr.techniques.map(toLink)),
			"",
			`## ${t("note.drills")}`,
			bullets(tr.drills.map(toLink)),
			"",
			`## ${t("note.rolls")}`,
			`- ${t("note.partner")}`,
			`- ${t("note.whatWorked")}`,
			`- ${t("note.whereStuck")}`,
			"",
			`## ${t("note.toImprove")}`,
			"- ",
			"",
			`## ${t("note.notes")}`,
			tr.notes || "",
			"",
		].join("\n");

		const file = await this.create(folderFor(this.settings(), "trainingFolder"), `${tr.date} - ${tr.type}`, fm, body);

		for (const d of tr.drills) {
			const df = this.findByName(d);
			if (df) await this.logDrillSession(df, tr.date, false);
		}
		return file;
	}

	async createPosition(p: NewPosition): Promise<TFile> {
		const fm = {
			bjj: NOTE_KIND.position,
			category: p.category,
			perspective: p.perspective,
			level: p.level,
			video: p.video,
			related: p.related.map(toLink),
			created: today(),
			tags: ["bjj/position"],
		};
		const body = [
			`# ${p.name}`,
			"",
			`> **${p.category}** · ${p.perspective} · ${t("note.level")} ${p.level} — ${L.level(p.level)}`,
			"",
			`## ${t("note.keyDetails")}`,
			p.details || "- ",
			"",
			`## ${t("note.stepByStep")}`,
			"1. ",
			"",
			`## ${t("note.commonMistakes")}`,
			"- ",
			"",
			`## ${t("note.followUps")}`,
			"- ",
			"",
			`## ${t("note.counters")}`,
			"- ",
			"",
			`## ${t("note.relatedPositions")}`,
			bullets(p.related.map(toLink)),
			"",
			`## ${t("note.references")}`,
			p.video ? `- ${p.video}` : "- ",
			"",
		].join("\n");
		return this.create(folderFor(this.settings(), "positionsFolder"), p.name, fm, body);
	}

	async createDrill(d: NewDrill): Promise<TFile> {
		const fm = {
			bjj: NOTE_KIND.drill,
			positions: d.positions.map(toLink),
			sets: d.sets,
			reps: d.reps,
			time_min: d.time,
			weekly_target: d.weeklyTarget,
			sessions: [] as string[],
			tags: ["bjj/drill"],
		};
		const volume = t("note.volumeValue", { sets: d.sets, reps: d.reps }) + (d.time ? ` · ${d.time} min` : "");
		const body = [
			`# ${d.name}`,
			"",
			`**${t("note.volume")}:** ${volume}`,
			`**${t("note.weeklyTarget")}:** ${t("note.timesPerWeek", { n: d.weeklyTarget })}`,
			"",
			`## ${t("note.positionsTrained")}`,
			bullets(d.positions.map(toLink)),
			"",
			`## ${t("note.howTo")}`,
			d.description || "- ",
			"",
			`## ${t("note.attention")}`,
			"- ",
			"",
			`## ${t("note.variations")}`,
			"- ",
			"",
		].join("\n");
		return this.create(folderFor(this.settings(), "drillsFolder"), d.name, fm, body);
	}

	async createGoal(g: NewGoal): Promise<TFile> {
		const fm = {
			bjj: NOTE_KIND.goal,
			category: g.category,
			horizon: g.horizon,
			status: "active",
			start: today(),
			deadline: g.deadline,
			metric: g.metric,
			target: g.metric === "checklist" ? 0 : g.target,
			progress: 0,
			tags: ["bjj/goal"],
		};
		const steps = g.steps.length ? g.steps : [""];
		const body = [
			`# ${g.title}`,
			"",
			`## ${t("note.whyMatters")}`,
			g.why || "",
			"",
			`## ${t("note.steps")}`,
			steps.map((s) => `- [ ] ${s}`).join("\n"),
			"",
			`## ${t("note.howMeasure")}`,
			"- ",
			"",
			`## ${t("note.progressLog")}`,
			`- ${today()}: ${t("note.goalCreated")}`,
			"",
		].join("\n");
		return this.create(folderFor(this.settings(), "goalsFolder"), g.title, fm, body);
	}

	async logDrillSession(file: TFile, date = today(), notify = true) {
		await this.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
			const sessions = Array.isArray(fm.sessions) ? (fm.sessions as unknown[]) : [];
			fm.sessions = [...sessions, date];
		});
		if (notify) new Notice(t("drill.logged", { name: file.basename, date }));
	}

	async setPositionLevel(file: TFile, level: number) {
		await this.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
			fm.level = level;
			fm.updated = today();
		});
		new Notice(t("position.levelChanged", { name: file.basename, level, label: L.level(level) }));
	}

	async incrementGoal(file: TFile, delta = 1) {
		await this.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
			fm.progress = (Number(fm.progress) || 0) + delta;
		});
	}

	async setGoalStatus(file: TFile, status: string) {
		await this.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
			fm.status = status;
			if (status === "done") fm.completed = today();
		});
		new Notice(t("goal.statusChanged", { name: file.basename, status: L.status(status) }));
	}
}
