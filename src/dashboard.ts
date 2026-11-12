import { ItemView, TFile, WorkspaceLeaf, debounce, setIcon } from "obsidian";
import { moment } from "./time";
import { BELT_COLORS, LEVELS, VIEW_TYPE_DASHBOARD } from "./constants";
import { DATE_FMT, Position, Training } from "./data";
import { L, daysAgo, t } from "./i18n";
import type BjjPlugin from "./main";
import { DrillModal, GoalModal, PositionModal, TrainingModal } from "./modals";

export const SECTIONS = ["summary", "heatmap", "goals", "drills", "positions", "techniques", "recent"] as const;
export type Section = (typeof SECTIONS)[number];

/** Portuguese aliases accepted in the ```bjj``` code block. */
export const SECTION_ALIASES: Record<string, Section> = {
	resumo: "summary",
	metas: "goals",
	posicoes: "positions",
	posições: "positions",
	tecnicas: "techniques",
	técnicas: "techniques",
	recentes: "recent",
};

const hours = (min: number) => {
	const h = Math.floor(min / 60);
	const m = Math.round(min % 60);
	return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
};

/** Renders the dashboard (or some sections of it) into `root`. Used by the view and the ```bjj``` block. */
export function renderDashboard(plugin: BjjPlugin, root: HTMLElement, sections: readonly Section[] = SECTIONS) {
	const { app, store, settings } = plugin;
	root.empty();
	root.addClass("bjj-dashboard");

	const trainings = store.trainings();
	const today = moment().startOf("day");

	const link = (parent: HTMLElement, f: TFile, text = f.basename) => {
		const a = parent.createEl("a", { text, cls: "bjj-link", href: "#" });
		a.onclick = (e) => {
			e.preventDefault();
			void app.workspace.getLeaf(false).openFile(f);
		};
		return a;
	};
	const section = (title: string, icon: string) => {
		const s = root.createDiv({ cls: "bjj-section" });
		const h = s.createDiv({ cls: "bjj-section-title" });
		setIcon(h.createSpan(), icon);
		h.createSpan({ text: title });
		return s;
	};
	const empty = (parent: HTMLElement, text: string) => parent.createDiv({ cls: "bjj-empty", text });
	const bar = (parent: HTMLElement, pct: number, cls = "") => {
		const b = parent.createDiv({ cls: `bjj-bar ${cls}` });
		b.createDiv({ cls: "bjj-bar-fill" }).setCssStyles({ width: `${Math.round(Math.min(1, pct) * 100)}%` });
		return b;
	};

	/* ---- Summary ---- */
	if (sections.includes("summary")) {
		const header = root.createDiv({ cls: "bjj-header" });
		const belt = header.createDiv({ cls: "bjj-belt" });
		belt.setCssProps({ "--belt-color": BELT_COLORS[settings.belt] ?? "#ccc" });
		const tab = belt.createDiv({ cls: `bjj-belt-bar ${settings.belt === "black" ? "is-black" : ""}` });
		for (let i = 0; i < settings.stripes; i++) tab.createDiv({ cls: "bjj-stripe" });

		const info = header.createDiv({ cls: "bjj-belt-info" });
		const beltName = t("dash.beltName", { belt: L.belt(settings.belt) });
		info.createDiv({
			cls: "bjj-belt-name",
			text: settings.stripes ? `${beltName} · ${t("dash.stripes", { n: settings.stripes })}` : beltName,
		});
		if (settings.promotionDate) {
			const since = moment(settings.promotionDate, DATE_FMT);
			const count = trainings.filter((tr) => !tr.date.isBefore(since)).length;
			info.createDiv({ cls: "bjj-muted", text: t("dash.sinceRank", { duration: since.fromNow(true), n: count }) });
		}

		const actions = header.createDiv({ cls: "bjj-actions" });
		const btn = (text: string, icon: string, fn: () => void, cta = false) => {
			const b = actions.createEl("button", { cls: cta ? "mod-cta" : "" });
			setIcon(b.createSpan({ cls: "bjj-btn-icon" }), icon);
			b.createSpan({ text });
			b.onclick = fn;
		};
		btn(t("dash.btnTraining"), "plus", () => new TrainingModal(plugin).open(), true);
		btn(t("dash.btnPosition"), "map-pin", () => new PositionModal(plugin).open());
		btn(t("dash.btnDrill"), "repeat", () => new DrillModal(plugin).open());
		btn(t("dash.btnGoal"), "target", () => new GoalModal(plugin).open());

		const week = trainings.filter((tr) => tr.date.isSame(today, "isoWeek"));
		const month = trainings.filter((tr) => tr.date.isSame(today, "month"));
		const year = trainings.filter((tr) => tr.date.isSame(today, "year"));
		const minutes = (ts: Training[]) => ts.reduce((s, tr) => s + tr.duration, 0);
		const streak = store.weekStreak(trainings);

		const cards = root.createDiv({ cls: "bjj-cards" });
		const card = (label: string, value: string, sub = "") => {
			const c = cards.createDiv({ cls: "bjj-card" });
			c.createDiv({ cls: "bjj-card-value", text: value });
			c.createDiv({ cls: "bjj-card-label", text: label });
			if (sub) c.createDiv({ cls: "bjj-card-sub", text: sub });
			return c;
		};
		const weekCard = card(t("dash.thisWeek"), `${week.length}/${settings.weeklyGoal}`, hours(minutes(week)));
		bar(weekCard, week.length / settings.weeklyGoal, "is-small");
		card(t("dash.thisMonth"), String(month.length), hours(minutes(month)));
		card(t("dash.thisYear"), String(year.length), hours(minutes(year)));
		card(t("dash.total"), String(trainings.length), hours(minutes(trainings)));
		card(t("dash.streak"), t("dash.weeks", { n: streak }), t("dash.perWeek", { n: settings.weeklyGoal }));
		card(
			t("dash.rollsMonth"),
			String(month.reduce((s, tr) => s + tr.rolls, 0)),
			t("dash.subsSummary", {
				given: month.reduce((s, tr) => s + tr.subsGiven, 0),
				received: month.reduce((s, tr) => s + tr.subsReceived, 0),
			})
		);
	}

	/* ---- Heatmap ---- */
	if (sections.includes("heatmap")) {
		const s = section(t("dash.frequency"), "calendar-days");
		const perDay = new Map<string, number>();
		for (const tr of trainings) {
			const k = tr.date.format(DATE_FMT);
			perDay.set(k, (perDay.get(k) ?? 0) + Math.max(tr.duration, 1));
		}
		const grid = s.createDiv({ cls: "bjj-heatmap" });
		const start = today.clone().startOf("isoWeek").subtract(25, "weeks");
		for (let w = 0; w < 26; w++) {
			const col = grid.createDiv({ cls: "bjj-heat-col" });
			for (let d = 0; d < 7; d++) {
				const day = start.clone().add(w, "weeks").add(d, "days");
				const min = perDay.get(day.format(DATE_FMT)) ?? 0;
				const lvl = min === 0 ? 0 : min < 60 ? 1 : min < 90 ? 2 : min < 150 ? 3 : 4;
				const cell = col.createDiv({ cls: `bjj-heat-cell lvl-${lvl}` });
				if (day.isAfter(today)) cell.addClass("is-future");
				cell.setAttr("aria-label", `${day.format(t("date.long"))}${min ? ` · ${hours(min)}` : ""}`);
			}
		}
		const perType = new Map<string, number>();
		for (const tr of trainings.filter((x) => x.date.isAfter(today.clone().subtract(90, "days"))))
			perType.set(tr.type, (perType.get(tr.type) ?? 0) + tr.duration);
		if (perType.size) {
			const total = [...perType.values()].reduce((a, b) => a + b, 0) || 1;
			const types = s.createDiv({ cls: "bjj-types" });
			types.createDiv({ cls: "bjj-muted", text: t("dash.timeByType") });
			[...perType.entries()]
				.sort((a, b) => b[1] - a[1])
				.forEach(([type, min]) => {
					const row = types.createDiv({ cls: "bjj-row" });
					row.createSpan({ cls: "bjj-row-label", text: type });
					bar(row, min / total);
					row.createSpan({ cls: "bjj-row-value", text: hours(min) });
				});
		}
	}

	/* ---- Goals ---- */
	if (sections.includes("goals")) {
		const s = section(t("dash.activeGoals"), "target");
		const all = store.goals();
		const active = all.filter((g) => g.status === "active");
		if (!active.length) empty(s, t("dash.noGoals"));
		for (const g of active) {
			const p = store.goalProgress(g, trainings);
			const row = s.createDiv({ cls: "bjj-goal" });
			const top = row.createDiv({ cls: "bjj-goal-top" });
			link(top, g.file, g.title);
			if (g.horizon) top.createSpan({ cls: "bjj-badge", text: g.horizon });
			top.createSpan({ cls: "bjj-badge is-muted", text: g.category });
			if (g.deadline) {
				const days = g.deadline.diff(today, "days");
				top.createSpan({
					cls: `bjj-deadline ${days < 0 ? "is-late" : days <= 14 ? "is-soon" : ""}`,
					text: days < 0 ? t("dash.late", { n: -days }) : days === 0 ? t("dash.dueToday") : t("dash.daysLeft", { n: days }),
				});
			}
			const bottom = row.createDiv({ cls: "bjj-goal-bottom" });
			bar(bottom, p.pct, p.pct >= 1 ? "is-done" : "");
			bottom.createSpan({ cls: "bjj-row-value", text: `${p.label} · ${Math.round(p.pct * 100)}%` });
			const acts = bottom.createDiv({ cls: "bjj-mini-actions" });
			if (g.metric === "manual") {
				acts.createEl("button", { text: "+1", attr: { "aria-label": t("dash.addOne") } }).onclick = () =>
					plugin.notes.incrementGoal(g.file, 1);
			}
			const done = acts.createEl("button", { attr: { "aria-label": t("dash.markDone") } });
			setIcon(done, "check");
			done.onclick = () => plugin.notes.setGoalStatus(g.file, "done");
		}
		const completed = all.filter((g) => g.status === "done").length;
		if (completed) s.createDiv({ cls: "bjj-muted", text: t("dash.completedGoals", { n: completed }) });
	}

	/* ---- Drills ---- */
	if (sections.includes("drills")) {
		const s = section(t("dash.weekDrills"), "repeat");
		const drills = store.drills();
		if (!drills.length) empty(s, t("dash.noDrills"));
		for (const d of drills) {
			const done = d.sessions.filter((e) => e.isSame(today, "isoWeek")).length;
			const target = d.weeklyTarget || 1;
			const row = s.createDiv({ cls: "bjj-row" });
			link(row.createSpan({ cls: "bjj-row-label" }), d.file, d.name);
			bar(row, done / target, done >= target ? "is-done" : "");
			const last = d.sessions[0] ? ` · ${t("dash.lastDone", { when: daysAgo(d.sessions[0].valueOf()) })}` : "";
			row.createSpan({ cls: "bjj-row-value", text: `${done}/${d.weeklyTarget || "–"}${last}` });
			const b = row.createEl("button", { cls: "bjj-icon-btn", attr: { "aria-label": t("dash.logToday") } });
			setIcon(b, "check");
			b.onclick = () => plugin.notes.logDrillSession(d.file);
		}
	}

	/* ---- Positions ---- */
	if (sections.includes("positions")) {
		const s = section(t("dash.repertoire"), "map-pin");
		const positions = store.positions();
		if (!positions.length) {
			empty(s, t("dash.noPositions"));
		} else {
			const levels = s.createDiv({ cls: "bjj-levels" });
			for (const n of LEVELS) {
				const c = levels.createDiv({ cls: `bjj-level lvl-${n}` });
				c.createDiv({ cls: "bjj-card-value", text: String(positions.filter((p) => p.level === n).length) });
				c.createDiv({ cls: "bjj-card-label", text: `${n} · ${L.level(n)}` });
			}
			const byCategory = new Map<string, Position[]>();
			for (const p of positions) byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p]);
			const cats = s.createDiv({ cls: "bjj-categories" });
			[...byCategory.entries()]
				.sort((a, b) => b[1].length - a[1].length)
				.forEach(([cat, ps]) => {
					const det = cats.createEl("details", { cls: "bjj-category" });
					det.createEl("summary", { text: `${cat} (${ps.length})` });
					const ul = det.createEl("ul");
					ps.sort((a, b) => b.level - a.level).forEach((p) => {
						const li = ul.createEl("li");
						link(li, p.file, p.name);
						li.createSpan({ cls: `bjj-dots lvl-${p.level}`, text: " " + "●".repeat(p.level) + "○".repeat(5 - p.level) });
					});
				});

			// Review: positions that have gone the longest without showing up in training
			const lastSeen = new Map<string, number>();
			for (const tr of trainings)
				for (const n of tr.techniques) if (!lastSeen.has(n)) lastSeen.set(n, tr.date.valueOf());
			const review = positions
				.filter((p) => p.level < 5)
				.sort((a, b) => (lastSeen.get(a.name) ?? 0) - (lastSeen.get(b.name) ?? 0))
				.slice(0, 5);
			if (review.length) {
				const r = s.createDiv({ cls: "bjj-review" });
				r.createDiv({ cls: "bjj-muted", text: t("dash.toReview") });
				const ul = r.createEl("ul");
				for (const p of review) {
					const li = ul.createEl("li");
					link(li, p.file, p.name);
					const seen = lastSeen.get(p.name);
					li.createSpan({ cls: "bjj-muted", text: seen ? ` — ${daysAgo(seen)}` : t("dash.neverTrained") });
				}
			}
		}
	}

	/* ---- Most trained techniques ---- */
	if (sections.includes("techniques")) {
		const top = store.topTechniques(trainings);
		if (top.length) {
			const s = section(t("dash.topTechniques"), "flame");
			const max = top[0][1];
			for (const [name, count] of top) {
				const row = s.createDiv({ cls: "bjj-row" });
				const label = row.createSpan({ cls: "bjj-row-label" });
				const f = plugin.notes.findByName(name);
				if (f) link(label, f, name);
				else label.setText(name);
				bar(row, count / max);
				row.createSpan({ cls: "bjj-row-value", text: `${count}x` });
			}
		}
	}

	/* ---- Recent ---- */
	if (sections.includes("recent")) {
		const s = section(t("dash.recent"), "history");
		if (!trainings.length) {
			empty(s, t("dash.noTraining"));
		} else {
			const table = s.createEl("table", { cls: "bjj-table" });
			const head = table.createEl("thead").createEl("tr");
			(["dash.colDate", "dash.colType", "dash.colDuration", "dash.colIntensity", "dash.colTechniques"] as const).forEach(
				(k) => head.createEl("th", { text: t(k) })
			);
			const tbody = table.createEl("tbody");
			for (const tr of trainings.slice(0, 10)) {
				const row = tbody.createEl("tr");
				link(row.createEl("td"), tr.file, tr.date.format(t("dash.dateFormat")));
				row.createEl("td", { text: tr.type });
				row.createEl("td", { text: tr.duration ? hours(tr.duration) : "–" });
				row.createEl("td", { text: tr.intensity ? String(tr.intensity) : "–" });
				row.createEl("td", { text: tr.techniques.join(", ") || "–", cls: "bjj-muted" });
			}
		}
	}
}

export class DashboardView extends ItemView {
	constructor(leaf: WorkspaceLeaf, private plugin: BjjPlugin) {
		super(leaf);
	}
	getViewType() {
		return VIEW_TYPE_DASHBOARD;
	}
	getDisplayText() {
		return t("plugin.dashboard");
	}
	getIcon() {
		return "swords";
	}

	refresh = debounce(() => this.render(), 400, true);

	async onOpen() {
		this.render();
		this.registerEvent(this.app.metadataCache.on("changed", () => this.refresh()));
		this.registerEvent(this.app.vault.on("delete", () => this.refresh()));
		this.registerEvent(this.app.vault.on("rename", () => this.refresh()));
	}

	render() {
		renderDashboard(this.plugin, this.contentEl);
	}
}
