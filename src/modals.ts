import { AbstractInputSuggest, App, FuzzySuggestModal, Modal, Notice, Setting, TFile, moment } from "obsidian";
import { GOAL_METRICS, LEVELS } from "./constants";
import { DATE_FMT } from "./data";
import { L, t } from "./i18n";
import type BjjPlugin from "./main";

/* ---------- Chip field with autocomplete ---------- */

class NameSuggest extends AbstractInputSuggest<string> {
	constructor(app: App, input: HTMLInputElement, private source: () => string[]) {
		super(app, input);
	}
	protected getSuggestions(query: string): string[] {
		const q = query.toLowerCase().trim();
		const all = this.source();
		const hits = all.filter((n) => n.toLowerCase().includes(q));
		if (q && !all.some((n) => n.toLowerCase() === q)) hits.push(query.trim());
		return hits;
	}
	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(this.source().includes(value) ? value : t("common.createLink", { name: value }));
	}
}

/** List of names (stored as [[links]]) with suggestions from existing notes. */
function chipField(
	app: App,
	container: HTMLElement,
	name: string,
	desc: string,
	source: () => string[],
	values: string[]
) {
	const setting = new Setting(container).setName(name).setDesc(desc);
	setting.settingEl.addClass("bjj-chip-setting");
	const chips = setting.controlEl.createDiv({ cls: "bjj-chips" });
	const input = setting.controlEl.createEl("input", { type: "text", placeholder: t("common.typeToSearch") });

	const render = () => {
		chips.empty();
		values.forEach((v, i) => {
			const chip = chips.createSpan({ cls: "bjj-chip", text: v });
			chip.createSpan({ cls: "bjj-chip-x", text: "×" }).onclick = () => {
				values.splice(i, 1);
				render();
			};
		});
	};
	const add = (v: string) => {
		v = v.trim();
		if (v && !values.includes(v)) values.push(v);
		input.value = "";
		render();
	};

	const suggest = new NameSuggest(app, input, source);
	suggest.onSelect((v) => {
		add(v);
		suggest.close();
	});
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && input.value.trim() && !e.isComposing) {
			// when the popover is open Obsidian handles Enter; this covers the no-suggestion case
			window.setTimeout(() => input.value.trim() && add(input.value), 0);
		}
	});
	render();
}

function numberField(container: HTMLElement, name: string, value: number, onChange: (v: number) => void, desc = "") {
	return new Setting(container)
		.setName(name)
		.setDesc(desc)
		.addText((tx) => {
			tx.inputEl.type = "number";
			tx.inputEl.min = "0";
			tx.setValue(String(value)).onChange((v) => onChange(Number(v) || 0));
		});
}

function textField(container: HTMLElement, name: string, value: string, onChange: (v: string) => void, placeholder = "") {
	return new Setting(container).setName(name).addText((tx) => tx.setPlaceholder(placeholder).setValue(value).onChange(onChange));
}

function dropdown(container: HTMLElement, name: string, options: readonly string[], value: string, onChange: (v: string) => void) {
	return new Setting(container).setName(name).addDropdown((d) => {
		options.forEach((o) => d.addOption(o, o));
		d.setValue(value).onChange(onChange);
	});
}

function textArea(container: HTMLElement, name: string, placeholder: string, onChange: (v: string) => void) {
	const s = new Setting(container).setName(name).addTextArea((tx) => {
		tx.setPlaceholder(placeholder).onChange(onChange);
		tx.inputEl.rows = 4;
	});
	s.settingEl.addClass("bjj-textarea-setting");
	return s;
}

abstract class BjjModal extends Modal {
	constructor(protected plugin: BjjPlugin, private heading: string) {
		super(plugin.app);
	}
	abstract build(el: HTMLElement): void;
	abstract submit(): Promise<boolean>;

	onOpen() {
		this.modalEl.addClass("bjj-modal");
		this.setTitle(this.heading);
		this.build(this.contentEl);
		new Setting(this.contentEl).addButton((b) =>
			b
				.setButtonText(t("common.save"))
				.setCta()
				.onClick(async () => {
					b.setDisabled(true);
					try {
						if (await this.submit()) this.close();
					} catch (e) {
						console.error(e);
						new Notice(t("common.saveError", { msg: (e as Error).message }));
					} finally {
						b.setDisabled(false);
					}
				})
		);
	}
	onClose() {
		this.contentEl.empty();
	}
}

/* ---------- Training ---------- */

export class TrainingModal extends BjjModal {
	private v = {
		date: moment().format(DATE_FMT),
		type: this.plugin.settings.defaultType,
		duration: this.plugin.settings.defaultDuration,
		academy: this.plugin.settings.defaultAcademy,
		instructor: this.plugin.settings.defaultInstructor,
		intensity: 6,
		rolls: 0,
		subsGiven: 0,
		subsReceived: 0,
		techniques: [] as string[],
		drills: [] as string[],
		injuries: "",
		notes: "",
	};

	constructor(plugin: BjjPlugin) {
		super(plugin, t("training.title"));
	}

	build(el: HTMLElement) {
		const v = this.v;
		new Setting(el).setName(t("training.date")).addText((tx) => {
			tx.inputEl.type = "date";
			tx.setValue(v.date).onChange((x) => (v.date = x));
		});
		const types = L.list("trainingTypes");
		dropdown(el, t("training.type"), types.includes(v.type) ? types : [v.type, ...types], v.type, (x) => (v.type = x));
		numberField(el, t("training.duration"), v.duration, (x) => (v.duration = x));
		textField(el, t("training.academy"), v.academy, (x) => (v.academy = x));
		textField(el, t("training.instructor"), v.instructor, (x) => (v.instructor = x));
		new Setting(el)
			.setName(t("training.intensity"))
			.setDesc(t("training.intensityDesc"))
			.addSlider((s) => s.setLimits(1, 10, 1).setValue(v.intensity).onChange((x) => (v.intensity = x)));

		chipField(this.app, el, t("training.techniques"), t("training.techniquesDesc"),
			() => this.plugin.store.positions().map((p) => p.name), v.techniques);
		chipField(this.app, el, t("training.drills"), t("training.drillsDesc"),
			() => this.plugin.store.drills().map((d) => d.name), v.drills);

		new Setting(el).setName(t("training.rolls")).setHeading();
		numberField(el, t("training.rollCount"), v.rolls, (x) => (v.rolls = x));
		numberField(el, t("training.subsGiven"), v.subsGiven, (x) => (v.subsGiven = x));
		numberField(el, t("training.subsReceived"), v.subsReceived, (x) => (v.subsReceived = x));

		textField(el, t("training.injuries"), "", (x) => (v.injuries = x), t("training.injuriesPh"));
		textArea(el, t("training.notes"), t("training.notesPh"), (x) => (v.notes = x));
	}

	async submit() {
		if (!moment(this.v.date, DATE_FMT, true).isValid()) {
			new Notice(t("training.invalidDate"));
			return false;
		}
		await this.plugin.notes.createTraining(this.v);
		new Notice(t("training.saved"));
		return true;
	}
}

/* ---------- Position ---------- */

export class PositionModal extends BjjModal {
	private v = {
		name: "",
		category: L.list("positionCategories")[0],
		perspective: L.list("perspectives")[1],
		level: 1,
		video: "",
		related: [] as string[],
		details: "",
	};
	constructor(plugin: BjjPlugin) {
		super(plugin, t("position.title"));
	}
	build(el: HTMLElement) {
		const v = this.v;
		new Setting(el).setName(t("position.name")).addText((tx) => {
			tx.setPlaceholder(t("position.namePh")).onChange((x) => (v.name = x));
			window.setTimeout(() => tx.inputEl.focus(), 0);
		});
		dropdown(el, t("position.category"), L.list("positionCategories"), v.category, (x) => (v.category = x));
		dropdown(el, t("position.perspective"), L.list("perspectives"), v.perspective, (x) => (v.perspective = x));
		new Setting(el).setName(t("position.level")).addDropdown((d) => {
			LEVELS.forEach((n) => d.addOption(String(n), `${n} — ${L.level(n)}`));
			d.setValue(String(v.level)).onChange((x) => (v.level = Number(x)));
		});
		textField(el, t("position.video"), "", (x) => (v.video = x), "https://…");
		chipField(this.app, el, t("position.related"), t("position.relatedDesc"),
			() => this.plugin.store.positions().map((p) => p.name), v.related);
		textArea(el, t("position.details"), t("position.detailsPh"), (x) => (v.details = x));
	}
	async submit() {
		if (!this.v.name.trim()) {
			new Notice(t("position.nameRequired"));
			return false;
		}
		await this.plugin.notes.createPosition({ ...this.v, name: this.v.name.trim() });
		new Notice(t("position.saved"));
		return true;
	}
}

/* ---------- Drill ---------- */

export class DrillModal extends BjjModal {
	private v = {
		name: "",
		positions: [] as string[],
		sets: 3,
		reps: 10,
		time: 0,
		weeklyTarget: 2,
		description: "",
	};
	constructor(plugin: BjjPlugin) {
		super(plugin, t("drill.title"));
	}
	build(el: HTMLElement) {
		const v = this.v;
		new Setting(el).setName(t("drill.name")).addText((tx) => {
			tx.setPlaceholder(t("drill.namePh")).onChange((x) => (v.name = x));
			window.setTimeout(() => tx.inputEl.focus(), 0);
		});
		chipField(this.app, el, t("drill.positions"), "", () => this.plugin.store.positions().map((p) => p.name), v.positions);
		numberField(el, t("drill.sets"), v.sets, (x) => (v.sets = x));
		numberField(el, t("drill.reps"), v.reps, (x) => (v.reps = x));
		numberField(el, t("drill.time"), v.time, (x) => (v.time = x), t("drill.timeDesc"));
		numberField(el, t("drill.weekly"), v.weeklyTarget, (x) => (v.weeklyTarget = x));
		textArea(el, t("drill.how"), t("drill.howPh"), (x) => (v.description = x));
	}
	async submit() {
		if (!this.v.name.trim()) {
			new Notice(t("drill.nameRequired"));
			return false;
		}
		await this.plugin.notes.createDrill({ ...this.v, name: this.v.name.trim() });
		new Notice(t("drill.saved"));
		return true;
	}
}

/* ---------- Goal ---------- */

export class GoalModal extends BjjModal {
	private v = {
		title: "",
		category: L.list("goalCategories")[0],
		horizon: L.list("horizons")[0],
		deadline: moment().add(3, "months").format(DATE_FMT),
		metric: "checklist",
		target: 10,
		why: "",
		steps: [] as string[],
	};
	constructor(plugin: BjjPlugin) {
		super(plugin, t("goal.title"));
	}
	build(el: HTMLElement) {
		const v = this.v;
		const horizons = L.list("horizons");
		let deadlineInput: HTMLInputElement | null = null;

		new Setting(el).setName(t("goal.goal")).addText((tx) => {
			tx.setPlaceholder(t("goal.goalPh")).onChange((x) => (v.title = x));
			window.setTimeout(() => tx.inputEl.focus(), 0);
		});
		dropdown(el, t("goal.category"), L.list("goalCategories"), v.category, (x) => (v.category = x));
		dropdown(el, t("goal.horizon"), horizons, v.horizon, (x) => {
			v.horizon = x;
			const months = [3, 6, 12][horizons.indexOf(x)] ?? 3;
			v.deadline = moment().add(months, "months").format(DATE_FMT);
			if (deadlineInput) deadlineInput.value = v.deadline;
		});
		new Setting(el).setName(t("goal.deadline")).addText((tx) => {
			tx.inputEl.type = "date";
			deadlineInput = tx.inputEl;
			tx.setValue(v.deadline).onChange((x) => (v.deadline = x));
		});

		let targetSetting: Setting | null = null;
		new Setting(el).setName(t("goal.metric")).addDropdown((d) => {
			GOAL_METRICS.forEach((k) => d.addOption(k, L.metric(k)));
			d.setValue(v.metric).onChange((x) => {
				v.metric = x;
				targetSetting?.settingEl.toggle(x !== "checklist");
			});
		});
		targetSetting = numberField(el, t("goal.target"), v.target, (x) => (v.target = x), t("goal.targetDesc"));
		targetSetting.settingEl.toggle(false);

		textArea(el, t("goal.why"), t("goal.whyPh"), (x) => (v.why = x));
		textArea(el, t("goal.steps"), t("goal.stepsPh"), (x) => {
			v.steps = x.split("\n").map((s) => s.trim()).filter(Boolean);
		});
	}
	async submit() {
		if (!this.v.title.trim()) {
			new Notice(t("goal.required"));
			return false;
		}
		await this.plugin.notes.createGoal({ ...this.v, title: this.v.title.trim() });
		new Notice(t("goal.saved"));
		return true;
	}
}

/* ---------- Quick pickers ---------- */

export class FileSuggestModal extends FuzzySuggestModal<TFile> {
	constructor(app: App, private files: TFile[], placeholder: string, private onPick: (f: TFile) => void) {
		super(app);
		this.setPlaceholder(placeholder);
	}
	getItems() {
		return this.files;
	}
	getItemText(f: TFile) {
		return f.basename;
	}
	onChooseItem(f: TFile) {
		this.onPick(f);
	}
}

export class LevelModal extends FuzzySuggestModal<number> {
	constructor(app: App, private onPick: (n: number) => void) {
		super(app);
		this.setPlaceholder(t("cmd.newLevel"));
	}
	getItems() {
		return [...LEVELS];
	}
	getItemText(n: number) {
		return `${n} — ${L.level(n)}`;
	}
	onChooseItem(n: number) {
		this.onPick(n);
	}
}
