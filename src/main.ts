import { MarkdownRenderChild, Notice, Plugin, TFile, debounce } from "obsidian";
import { NOTE_KIND, VIEW_TYPE_DASHBOARD } from "./constants";
import { BjjData } from "./data";
import { DashboardView, SECTIONS, SECTION_ALIASES, Section, renderDashboard } from "./dashboard";
import { t } from "./i18n";
import { DrillModal, FileSuggestModal, GoalModal, LevelModal, PositionModal, TrainingModal } from "./modals";
import { NoteFactory } from "./notes";
import { BjjSettingTab, BjjSettings, defaultSettings } from "./settings";

export default class BjjPlugin extends Plugin {
	settings!: BjjSettings;
	store!: BjjData;
	notes!: NoteFactory;

	async onload() {
		await this.loadSettings();
		this.store = new BjjData(this.app, () => this.settings);
		this.notes = new NoteFactory(this.app, () => this.settings);

		this.registerView(VIEW_TYPE_DASHBOARD, (leaf) => new DashboardView(leaf, this));

		this.addRibbonIcon("swords", t("plugin.dashboard"), () => this.openDashboard());
		this.addRibbonIcon("plus-circle", t("ribbon.logTraining"), () => new TrainingModal(this).open());

		this.addCommand({ id: "open-dashboard", name: t("cmd.openDashboard"), callback: () => this.openDashboard() });
		this.addCommand({ id: "log-training", name: t("cmd.logTraining"), callback: () => new TrainingModal(this).open() });
		this.addCommand({ id: "new-position", name: t("cmd.newPosition"), callback: () => new PositionModal(this).open() });
		this.addCommand({ id: "new-drill", name: t("cmd.newDrill"), callback: () => new DrillModal(this).open() });
		this.addCommand({ id: "new-goal", name: t("cmd.newGoal"), callback: () => new GoalModal(this).open() });

		this.addCommand({
			id: "log-drill-session",
			name: t("cmd.logDrill"),
			callback: () => {
				const files = this.store.drills().map((d) => d.file);
				if (!files.length) return void new Notice(t("cmd.noDrills"));
				new FileSuggestModal(this.app, files, t("cmd.whichDrill"), (f) => this.notes.logDrillSession(f)).open();
			},
		});

		this.addCommand({
			id: "set-position-level",
			name: t("cmd.positionLevel"),
			callback: () => {
				const pickLevel = (f: TFile) => new LevelModal(this.app, (n) => this.notes.setPositionLevel(f, n)).open();
				const active = this.app.workspace.getActiveFile();
				if (active && this.kindOf(active) === NOTE_KIND.position) return pickLevel(active);
				const files = this.store.positions().map((p) => p.file);
				if (!files.length) return void new Notice(t("cmd.noPositions"));
				new FileSuggestModal(this.app, files, t("cmd.whichPosition"), pickLevel).open();
			},
		});

		this.addCommand({
			id: "complete-goal",
			name: t("cmd.completeGoal"),
			callback: () => {
				const active = this.app.workspace.getActiveFile();
				if (active && this.kindOf(active) === NOTE_KIND.goal) return void this.notes.setGoalStatus(active, "done");
				const files = this.store.goals().filter((g) => g.status === "active").map((g) => g.file);
				if (!files.length) return void new Notice(t("cmd.noActiveGoals"));
				new FileSuggestModal(this.app, files, t("cmd.whichGoal"), (f) => this.notes.setGoalStatus(f, "done")).open();
			},
		});

		/*
		 * Embeddable block for any note:
		 * ```bjj
		 * summary
		 * goals
		 * ```
		 * Empty = full dashboard. Sections: summary, heatmap, goals, drills, positions, techniques, recent.
		 */
		this.registerMarkdownCodeBlockProcessor("bjj", (source, el, ctx) => {
			const requested = source
				.split(/[\n,]/)
				.map((s) => s.trim().toLowerCase())
				.map((s) => SECTION_ALIASES[s] ?? s)
				.filter((s): s is Section => (SECTIONS as readonly string[]).includes(s));
			const sections = requested.length ? requested : SECTIONS;
			const child = new MarkdownRenderChild(el);
			const render = () => renderDashboard(this, el, sections);
			const refresh = debounce(render, 500, true);
			child.registerEvent(this.app.metadataCache.on("changed", (f) => f.path !== ctx.sourcePath && refresh()));
			ctx.addChild(child);
			render();
		});

		this.addSettingTab(new BjjSettingTab(this.app, this));
	}

	private kindOf(f: TFile): unknown {
		return this.app.metadataCache.getFileCache(f)?.frontmatter?.bjj;
	}

	async openDashboard() {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD)[0];
		if (!leaf) {
			leaf = workspace.getLeaf("tab");
			await leaf.setViewState({ type: VIEW_TYPE_DASHBOARD, active: true });
		}
		await workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		this.settings = Object.assign(defaultSettings(), await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD).forEach((l) => {
			if (l.view instanceof DashboardView) l.view.render();
		});
	}
}
