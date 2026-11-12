import { App, PluginSettingTab, Setting, normalizePath } from "obsidian";
import type BjjPlugin from "./main";
import { BELTS } from "./constants";
import { L, t } from "./i18n";

export interface BjjSettings {
	rootFolder: string;
	trainingFolder: string;
	positionsFolder: string;
	drillsFolder: string;
	goalsFolder: string;
	defaultAcademy: string;
	defaultInstructor: string;
	defaultType: string;
	defaultDuration: number;
	weeklyGoal: number;
	belt: string;
	stripes: number;
	promotionDate: string;
	openAfterCreate: boolean;
}

/** Defaults are built at load time so folder names follow the app language. */
export function defaultSettings(): BjjSettings {
	return {
		rootFolder: "BJJ",
		trainingFolder: t("folder.training"),
		positionsFolder: t("folder.positions"),
		drillsFolder: t("folder.drills"),
		goalsFolder: t("folder.goals"),
		defaultAcademy: "",
		defaultInstructor: "",
		defaultType: L.list("trainingTypes")[0],
		defaultDuration: 90,
		weeklyGoal: 3,
		belt: "white",
		stripes: 0,
		promotionDate: "",
		openAfterCreate: true,
	};
}

type FolderKey = "trainingFolder" | "positionsFolder" | "drillsFolder" | "goalsFolder";

export function folderFor(s: BjjSettings, key: FolderKey): string {
	return normalizePath(s.rootFolder ? `${s.rootFolder}/${s[key]}` : s[key]);
}

export class BjjSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: BjjPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		const s = this.plugin.settings;
		const save = () => this.plugin.saveSettings();
		containerEl.empty();

		new Setting(containerEl).setName(t("settings.rank")).setHeading();

		new Setting(containerEl).setName(t("settings.belt")).addDropdown((d) => {
			BELTS.forEach((b) => d.addOption(b, L.belt(b)));
			d.setValue(s.belt).onChange(async (v) => {
				s.belt = v;
				await save();
			});
		});

		new Setting(containerEl).setName(t("settings.stripes")).addSlider((sl) =>
			sl
				.setLimits(0, 4, 1)
				.setValue(s.stripes)
				.setDynamicTooltip()
				.onChange(async (v) => {
					s.stripes = v;
					await save();
				})
		);

		new Setting(containerEl)
			.setName(t("settings.promotionDate"))
			.setDesc(t("settings.promotionDateDesc"))
			.addText((tx) => {
				tx.inputEl.type = "date";
				tx.setValue(s.promotionDate).onChange(async (v) => {
					s.promotionDate = v;
					await save();
				});
			});

		new Setting(containerEl).setName(t("settings.training")).setHeading();

		new Setting(containerEl).setName(t("settings.academy")).addText((tx) =>
			tx.setValue(s.defaultAcademy).onChange(async (v) => {
				s.defaultAcademy = v;
				await save();
			})
		);

		new Setting(containerEl).setName(t("settings.instructor")).addText((tx) =>
			tx.setValue(s.defaultInstructor).onChange(async (v) => {
				s.defaultInstructor = v;
				await save();
			})
		);

		new Setting(containerEl).setName(t("settings.type")).addDropdown((d) => {
			const types = L.list("trainingTypes");
			if (!types.includes(s.defaultType)) d.addOption(s.defaultType, s.defaultType);
			types.forEach((x) => d.addOption(x, x));
			d.setValue(s.defaultType).onChange(async (v) => {
				s.defaultType = v;
				await save();
			});
		});

		new Setting(containerEl).setName(t("settings.duration")).addText((tx) => {
			tx.inputEl.type = "number";
			tx.setValue(String(s.defaultDuration)).onChange(async (v) => {
				s.defaultDuration = Number(v) || 0;
				await save();
			});
		});

		new Setting(containerEl)
			.setName(t("settings.weeklyGoal"))
			.setDesc(t("settings.weeklyGoalDesc"))
			.addText((tx) => {
				tx.inputEl.type = "number";
				tx.setValue(String(s.weeklyGoal)).onChange(async (v) => {
					s.weeklyGoal = Math.max(1, Number(v) || 1);
					await save();
				});
			});

		new Setting(containerEl).setName(t("settings.folders")).setHeading();

		const folder = (name: string, key: "rootFolder" | FolderKey) =>
			new Setting(containerEl).setName(name).addText((tx) =>
				tx.setValue(s[key]).onChange(async (v) => {
					s[key] = v.trim();
					await save();
				})
			);
		folder(t("settings.rootFolder"), "rootFolder");
		folder(t("settings.trainingFolder"), "trainingFolder");
		folder(t("settings.positionsFolder"), "positionsFolder");
		folder(t("settings.drillsFolder"), "drillsFolder");
		folder(t("settings.goalsFolder"), "goalsFolder");

		new Setting(containerEl).setName(t("settings.openAfterCreate")).addToggle((tg) =>
			tg.setValue(s.openAfterCreate).onChange(async (v) => {
				s.openAfterCreate = v;
				await save();
			})
		);
	}
}
