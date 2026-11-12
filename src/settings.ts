import { App, PluginSettingTab, Setting, normalizePath } from "obsidian";
import type BjjPlugin from "./main";
import { FAIXAS, TIPOS_TREINO } from "./constants";

export interface BjjSettings {
	pastaRaiz: string;
	pastaTreinos: string;
	pastaPosicoes: string;
	pastaDrills: string;
	pastaMetas: string;
	academiaPadrao: string;
	instrutorPadrao: string;
	tipoPadrao: string;
	duracaoPadrao: number;
	metaSemanal: number;
	faixa: string;
	graus: number;
	dataGraduacao: string;
	abrirAposCriar: boolean;
}

export const DEFAULT_SETTINGS: BjjSettings = {
	pastaRaiz: "BJJ",
	pastaTreinos: "Treinos",
	pastaPosicoes: "Posições",
	pastaDrills: "Drills",
	pastaMetas: "Metas",
	academiaPadrao: "",
	instrutorPadrao: "",
	tipoPadrao: "Gi",
	duracaoPadrao: 90,
	metaSemanal: 3,
	faixa: "Branca",
	graus: 0,
	dataGraduacao: "",
	abrirAposCriar: true,
};

export function folderFor(
	s: BjjSettings,
	key: "pastaTreinos" | "pastaPosicoes" | "pastaDrills" | "pastaMetas"
): string {
	return normalizePath(s.pastaRaiz ? `${s.pastaRaiz}/${s[key]}` : s[key]);
}

export class BjjSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: BjjPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		const s = this.plugin.settings;
		containerEl.empty();

		const save = async () => {
			await this.plugin.saveSettings();
		};

		new Setting(containerEl).setName("Graduação").setHeading();

		new Setting(containerEl).setName("Faixa atual").addDropdown((d) => {
			FAIXAS.forEach((f) => d.addOption(f, f));
			d.setValue(s.faixa).onChange(async (v) => {
				s.faixa = v;
				await save();
			});
		});

		new Setting(containerEl).setName("Graus").addSlider((sl) =>
			sl
				.setLimits(0, 4, 1)
				.setValue(s.graus)
				.setDynamicTooltip()
				.onChange(async (v) => {
					s.graus = v;
					await save();
				})
		);

		new Setting(containerEl)
			.setName("Data da última graduação")
			.setDesc("Usada para mostrar há quanto tempo você está na faixa/grau atual.")
			.addText((t) => {
				t.inputEl.type = "date";
				t.setValue(s.dataGraduacao).onChange(async (v) => {
					s.dataGraduacao = v;
					await save();
				});
			});

		new Setting(containerEl).setName("Treinos").setHeading();

		new Setting(containerEl).setName("Academia padrão").addText((t) =>
			t.setValue(s.academiaPadrao).onChange(async (v) => {
				s.academiaPadrao = v;
				await save();
			})
		);

		new Setting(containerEl).setName("Instrutor padrão").addText((t) =>
			t.setValue(s.instrutorPadrao).onChange(async (v) => {
				s.instrutorPadrao = v;
				await save();
			})
		);

		new Setting(containerEl).setName("Tipo de treino padrão").addDropdown((d) => {
			TIPOS_TREINO.forEach((t) => d.addOption(t, t));
			d.setValue(s.tipoPadrao).onChange(async (v) => {
				s.tipoPadrao = v;
				await save();
			});
		});

		new Setting(containerEl).setName("Duração padrão (min)").addText((t) => {
			t.inputEl.type = "number";
			t.setValue(String(s.duracaoPadrao)).onChange(async (v) => {
				s.duracaoPadrao = Number(v) || 0;
				await save();
			});
		});

		new Setting(containerEl)
			.setName("Meta de treinos por semana")
			.setDesc("Usada no painel e para calcular a sequência de semanas.")
			.addText((t) => {
				t.inputEl.type = "number";
				t.setValue(String(s.metaSemanal)).onChange(async (v) => {
					s.metaSemanal = Math.max(1, Number(v) || 1);
					await save();
				});
			});

		new Setting(containerEl).setName("Pastas").setHeading();

		const pasta = (
			name: string,
			key: "pastaRaiz" | "pastaTreinos" | "pastaPosicoes" | "pastaDrills" | "pastaMetas"
		) =>
			new Setting(containerEl).setName(name).addText((t) =>
				t.setValue(s[key]).onChange(async (v) => {
					s[key] = v.trim();
					await save();
				})
			);
		pasta("Pasta raiz", "pastaRaiz");
		pasta("Subpasta de treinos", "pastaTreinos");
		pasta("Subpasta de posições", "pastaPosicoes");
		pasta("Subpasta de drills", "pastaDrills");
		pasta("Subpasta de metas", "pastaMetas");

		new Setting(containerEl)
			.setName("Abrir nota após criar")
			.addToggle((t) =>
				t.setValue(s.abrirAposCriar).onChange(async (v) => {
					s.abrirAposCriar = v;
					await save();
				})
			);
	}
}
