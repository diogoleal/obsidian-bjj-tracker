import { MarkdownRenderChild, Notice, Plugin, TFile, debounce } from "obsidian";
import { NOTE_KIND, VIEW_TYPE_DASHBOARD } from "./constants";
import { BjjData } from "./data";
import { DashboardView, SECOES, Secao, renderDashboard } from "./dashboard";
import {
	DrillModal,
	FileSuggestModal,
	MetaModal,
	NivelModal,
	PosicaoModal,
	TreinoModal,
} from "./modals";
import { NoteFactory } from "./notes";
import { BjjSettingTab, BjjSettings, DEFAULT_SETTINGS } from "./settings";

export default class BjjPlugin extends Plugin {
	settings!: BjjSettings;
	store!: BjjData;
	notes!: NoteFactory;

	async onload() {
		await this.loadSettings();
		this.store = new BjjData(this.app, () => this.settings);
		this.notes = new NoteFactory(this.app, () => this.settings);

		this.registerView(VIEW_TYPE_DASHBOARD, (leaf) => new DashboardView(leaf, this));

		this.addRibbonIcon("swords", "Painel BJJ", () => this.abrirPainel());
		this.addRibbonIcon("plus-circle", "Registrar treino de BJJ", () => new TreinoModal(this).open());

		this.addCommand({ id: "abrir-painel", name: "Abrir painel", callback: () => this.abrirPainel() });
		this.addCommand({ id: "registrar-treino", name: "Registrar treino", callback: () => new TreinoModal(this).open() });
		this.addCommand({ id: "nova-posicao", name: "Nova posição / técnica", callback: () => new PosicaoModal(this).open() });
		this.addCommand({ id: "novo-drill", name: "Novo drill", callback: () => new DrillModal(this).open() });
		this.addCommand({ id: "nova-meta", name: "Nova meta", callback: () => new MetaModal(this).open() });

		this.addCommand({
			id: "registrar-drill",
			name: "Registrar execução de drill (hoje)",
			callback: () => {
				const files = this.store.drills().map((d) => d.file);
				if (!files.length) return new Notice("Nenhum drill cadastrado.");
				new FileSuggestModal(this.app, files, "Qual drill você fez?", (f) =>
					this.notes.registrarExecucaoDrill(f)
				).open();
			},
		});

		this.addCommand({
			id: "nivel-posicao",
			name: "Alterar nível de domínio de uma posição",
			callback: () => {
				const escolherNivel = (f: TFile) =>
					new NivelModal(this.app, (n) => this.notes.atualizarNivelPosicao(f, n)).open();
				const ativa = this.app.workspace.getActiveFile();
				if (ativa && this.kindOf(ativa) === NOTE_KIND.posicao) return escolherNivel(ativa);
				const files = this.store.posicoes().map((p) => p.file);
				if (!files.length) return new Notice("Nenhuma posição cadastrada.");
				new FileSuggestModal(this.app, files, "Qual posição?", escolherNivel).open();
			},
		});

		this.addCommand({
			id: "concluir-meta",
			name: "Concluir meta",
			callback: () => {
				const ativa = this.app.workspace.getActiveFile();
				if (ativa && this.kindOf(ativa) === NOTE_KIND.meta)
					return this.notes.definirStatusMeta(ativa, "Concluída");
				const files = this.store.metas().filter((m) => m.status === "Ativa").map((m) => m.file);
				if (!files.length) return new Notice("Nenhuma meta ativa.");
				new FileSuggestModal(this.app, files, "Qual meta você concluiu? 🏆", (f) =>
					this.notes.definirStatusMeta(f, "Concluída")
				).open();
			},
		});

		/*
		 * Bloco embutível em qualquer nota:
		 * ```bjj
		 * resumo
		 * metas
		 * ```
		 * Sem conteúdo = painel completo. Seções: resumo, heatmap, metas, drills, posicoes, tecnicas, recentes.
		 */
		this.registerMarkdownCodeBlockProcessor("bjj", (source, el, ctx) => {
			const pedidas = source
				.split(/[\n,]/)
				.map((s) => s.trim().toLowerCase())
				.filter((s): s is Secao => (SECOES as readonly string[]).includes(s));
			const secoes = pedidas.length ? pedidas : SECOES;
			const child = new MarkdownRenderChild(el);
			const render = () => renderDashboard(this, el, secoes);
			const refresh = debounce(render, 500, true);
			child.registerEvent(this.app.metadataCache.on("changed", (f) => f.path !== ctx.sourcePath && refresh()));
			ctx.addChild(child);
			render();
		});

		this.addSettingTab(new BjjSettingTab(this.app, this));
	}

	onunload() {}

	private kindOf(f: TFile): string | undefined {
		return this.app.metadataCache.getFileCache(f)?.frontmatter?.bjj;
	}

	async abrirPainel() {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD)[0];
		if (!leaf) {
			leaf = workspace.getLeaf("tab");
			await leaf.setViewState({ type: VIEW_TYPE_DASHBOARD, active: true });
		}
		workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD).forEach((l) => {
			if (l.view instanceof DashboardView) l.view.render();
		});
	}
}
