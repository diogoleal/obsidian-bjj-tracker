import { App, PluginSettingTab, SettingDefinitionItem, normalizePath } from "obsidian";
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
	const root = s.rootFolder.replace(/^\/+|\/+$/g, "");
	return normalizePath(root ? `${root}/${s[key]}` : s[key]);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class BjjSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: BjjPlugin) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem<keyof BjjSettings>[] {
		const types = L.list("trainingTypes");
		const typeOptions: Record<string, string> = {};
		for (const x of [this.plugin.settings.defaultType, ...types]) typeOptions[x] = x;

		return [
			{
				type: "group",
				heading: t("settings.rank"),
				items: [
					{
						name: t("settings.belt"),
						control: {
							type: "dropdown",
							key: "belt",
							options: Object.fromEntries(BELTS.map((b) => [b, L.belt(b)])),
						},
					},
					{
						name: t("settings.stripes"),
						control: { type: "slider", key: "stripes", min: 0, max: 4, step: 1 },
					},
					{
						name: t("settings.promotionDate"),
						desc: t("settings.promotionDateDesc"),
						control: {
							type: "text",
							key: "promotionDate",
							placeholder: "YYYY-MM-DD",
							validate: (v) => (v === "" || DATE_RE.test(v) ? undefined : "YYYY-MM-DD"),
						},
					},
				],
			},
			{
				type: "group",
				heading: t("settings.training"),
				items: [
					{ name: t("settings.academy"), control: { type: "text", key: "defaultAcademy" } },
					{ name: t("settings.instructor"), control: { type: "text", key: "defaultInstructor" } },
					{ name: t("settings.type"), control: { type: "dropdown", key: "defaultType", options: typeOptions } },
					{ name: t("settings.duration"), control: { type: "number", key: "defaultDuration", min: 0, step: 5 } },
					{
						name: t("settings.weeklyGoal"),
						desc: t("settings.weeklyGoalDesc"),
						control: { type: "number", key: "weeklyGoal", min: 1, max: 14, step: 1 },
					},
				],
			},
			{
				type: "group",
				heading: t("settings.folders"),
				items: [
					{ name: t("settings.rootFolder"), control: { type: "folder", key: "rootFolder", includeRoot: true } },
					{ name: t("settings.trainingFolder"), control: { type: "text", key: "trainingFolder" } },
					{ name: t("settings.positionsFolder"), control: { type: "text", key: "positionsFolder" } },
					{ name: t("settings.drillsFolder"), control: { type: "text", key: "drillsFolder" } },
					{ name: t("settings.goalsFolder"), control: { type: "text", key: "goalsFolder" } },
					{ name: t("settings.openAfterCreate"), control: { type: "toggle", key: "openAfterCreate" } },
				],
			},
		];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const s = this.plugin.settings as unknown as Record<string, unknown>;
		s[key] = typeof value === "string" ? value.trim() : value;
		await this.plugin.saveSettings();
	}
}
