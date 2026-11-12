import {
	AbstractInputSuggest,
	App,
	FuzzySuggestModal,
	Modal,
	Notice,
	Setting,
	TFile,
	moment,
} from "obsidian";
import {
	CATEGORIAS_META,
	CATEGORIAS_POSICAO,
	HORIZONTES_META,
	METRICAS_META,
	NIVEIS,
	PERSPECTIVAS,
	TIPOS_TREINO,
} from "./constants";
import { DATE_FMT } from "./data";
import type BjjPlugin from "./main";

/* ---------- Campo de "chips" com autocompletar ---------- */

class NameSuggest extends AbstractInputSuggest<string> {
	constructor(app: App, private input: HTMLInputElement, private source: () => string[]) {
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
		const existe = this.source().includes(value);
		el.setText(existe ? value : `➕ Criar link "${value}"`);
	}
}

/** Lista de nomes (viram [[links]]) com sugestões de notas existentes. */
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
	const input = setting.controlEl.createEl("input", {
		type: "text",
		placeholder: "Digite para buscar…",
	});

	const render = () => {
		chips.empty();
		values.forEach((v, i) => {
			const chip = chips.createSpan({ cls: "bjj-chip", text: v });
			const x = chip.createSpan({ cls: "bjj-chip-x", text: "×" });
			x.onclick = () => {
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
			// se o popover estiver aberto o Obsidian trata o Enter; isso cobre o caso sem sugestões
			setTimeout(() => input.value.trim() && add(input.value), 0);
		}
	});
	render();
}

function numberField(
	container: HTMLElement,
	name: string,
	value: number,
	onChange: (v: number) => void,
	desc = ""
) {
	return new Setting(container)
		.setName(name)
		.setDesc(desc)
		.addText((t) => {
			t.inputEl.type = "number";
			t.inputEl.min = "0";
			t.setValue(String(value)).onChange((v) => onChange(Number(v) || 0));
		});
}

function dateField(container: HTMLElement, name: string, value: string, onChange: (v: string) => void) {
	return new Setting(container).setName(name).addText((t) => {
		t.inputEl.type = "date";
		t.setValue(value).onChange(onChange);
	});
}

function textArea(
	container: HTMLElement,
	name: string,
	placeholder: string,
	onChange: (v: string) => void
) {
	const s = new Setting(container).setName(name).addTextArea((t) => {
		t.setPlaceholder(placeholder).onChange(onChange);
		t.inputEl.rows = 4;
	});
	s.settingEl.addClass("bjj-textarea-setting");
	return s;
}

abstract class BjjModal extends Modal {
	constructor(protected plugin: BjjPlugin, private titulo: string) {
		super(plugin.app);
	}
	abstract build(el: HTMLElement): void;
	abstract submit(): Promise<boolean>;

	onOpen() {
		this.modalEl.addClass("bjj-modal");
		this.setTitle(this.titulo);
		this.build(this.contentEl);
		new Setting(this.contentEl).addButton((b) =>
			b
				.setButtonText("Salvar")
				.setCta()
				.onClick(async () => {
					b.setDisabled(true);
					try {
						if (await this.submit()) this.close();
					} catch (e) {
						console.error(e);
						new Notice(`Erro ao salvar: ${(e as Error).message}`);
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

/* ---------- Treino ---------- */

export class TreinoModal extends BjjModal {
	private v = {
		data: moment().format(DATE_FMT),
		tipo: this.plugin.settings.tipoPadrao,
		duracao: this.plugin.settings.duracaoPadrao,
		academia: this.plugin.settings.academiaPadrao,
		instrutor: this.plugin.settings.instrutorPadrao,
		intensidade: 6,
		rolas: 0,
		finalizacoesFeitas: 0,
		finalizacoesSofridas: 0,
		tecnicas: [] as string[],
		drills: [] as string[],
		lesoes: "",
		notas: "",
	};

	constructor(plugin: BjjPlugin) {
		super(plugin, "🥋 Registrar treino");
	}

	build(el: HTMLElement) {
		const v = this.v;
		dateField(el, "Data", v.data, (x) => (v.data = x));
		new Setting(el).setName("Tipo").addDropdown((d) => {
			TIPOS_TREINO.forEach((t) => d.addOption(t, t));
			d.setValue(v.tipo).onChange((x) => (v.tipo = x));
		});
		numberField(el, "Duração (min)", v.duracao, (x) => (v.duracao = x));
		new Setting(el).setName("Academia").addText((t) => t.setValue(v.academia).onChange((x) => (v.academia = x)));
		new Setting(el).setName("Instrutor").addText((t) => t.setValue(v.instrutor).onChange((x) => (v.instrutor = x)));
		new Setting(el)
			.setName("Intensidade")
			.setDesc("1 = leve · 10 = máximo")
			.addSlider((s) =>
				s.setLimits(1, 10, 1).setValue(v.intensidade).setDynamicTooltip().onChange((x) => (v.intensidade = x))
			);

		chipField(
			this.app,
			el,
			"Técnicas / posições",
			"O que foi ensinado ou trabalhado.",
			() => this.plugin.store.posicoes().map((p) => p.nome),
			v.tecnicas
		);
		chipField(
			this.app,
			el,
			"Drills executados",
			"Drills existentes recebem a execução registrada.",
			() => this.plugin.store.drills().map((d) => d.nome),
			v.drills
		);

		el.createEl("h4", { text: "Rolas" });
		numberField(el, "Número de rolas", v.rolas, (x) => (v.rolas = x));
		numberField(el, "Finalizações aplicadas", v.finalizacoesFeitas, (x) => (v.finalizacoesFeitas = x));
		numberField(el, "Finalizações sofridas", v.finalizacoesSofridas, (x) => (v.finalizacoesSofridas = x));

		new Setting(el)
			.setName("Lesões / dores")
			.addText((t) => t.setPlaceholder("Ex.: dedo da mão direita").onChange((x) => (v.lesoes = x)));
		textArea(el, "Notas", "Insights, o que funcionou, o que melhorar…", (x) => (v.notas = x));
	}

	async submit() {
		if (!moment(this.v.data, DATE_FMT, true).isValid()) {
			new Notice("Informe uma data válida.");
			return false;
		}
		await this.plugin.notes.criarTreino(this.v);
		new Notice("Treino registrado! 🥋");
		return true;
	}
}

/* ---------- Posição ---------- */

export class PosicaoModal extends BjjModal {
	private v = {
		nome: "",
		categoria: CATEGORIAS_POSICAO[0] as string,
		perspectiva: PERSPECTIVAS[1] as string,
		nivel: 1,
		video: "",
		relacionadas: [] as string[],
		detalhes: "",
	};
	constructor(plugin: BjjPlugin) {
		super(plugin, "📍 Nova posição / técnica");
	}
	build(el: HTMLElement) {
		const v = this.v;
		new Setting(el).setName("Nome").addText((t) => {
			t.setPlaceholder("Ex.: Armlock da guarda fechada").onChange((x) => (v.nome = x));
			setTimeout(() => t.inputEl.focus(), 0);
		});
		new Setting(el).setName("Categoria").addDropdown((d) => {
			CATEGORIAS_POSICAO.forEach((c) => d.addOption(c, c));
			d.setValue(v.categoria).onChange((x) => (v.categoria = x));
		});
		new Setting(el).setName("Perspectiva").addDropdown((d) => {
			PERSPECTIVAS.forEach((c) => d.addOption(c, c));
			d.setValue(v.perspectiva).onChange((x) => (v.perspectiva = x));
		});
		new Setting(el).setName("Nível de domínio").addDropdown((d) => {
			Object.entries(NIVEIS).forEach(([k, n]) => d.addOption(k, `${k} — ${n}`));
			d.setValue(String(v.nivel)).onChange((x) => (v.nivel = Number(x)));
		});
		new Setting(el).setName("Vídeo / referência").addText((t) =>
			t.setPlaceholder("https://…").onChange((x) => (v.video = x))
		);
		chipField(
			this.app,
			el,
			"Posições relacionadas",
			"Entradas, continuações, defesas.",
			() => this.plugin.store.posicoes().map((p) => p.nome),
			v.relacionadas
		);
		textArea(el, "Detalhes-chave", "Pegadas, ângulos, pesos…", (x) => (v.detalhes = x));
	}
	async submit() {
		if (!this.v.nome.trim()) {
			new Notice("Dê um nome para a posição.");
			return false;
		}
		await this.plugin.notes.criarPosicao({ ...this.v, nome: this.v.nome.trim() });
		new Notice("Posição criada! 📍");
		return true;
	}
}

/* ---------- Drill ---------- */

export class DrillModal extends BjjModal {
	private v = {
		nome: "",
		posicoes: [] as string[],
		series: 3,
		repeticoes: 10,
		tempo: 0,
		frequencia: 2,
		descricao: "",
	};
	constructor(plugin: BjjPlugin) {
		super(plugin, "🔁 Novo drill");
	}
	build(el: HTMLElement) {
		const v = this.v;
		new Setting(el).setName("Nome").addText((t) => {
			t.setPlaceholder("Ex.: Hip escape na parede").onChange((x) => (v.nome = x));
			setTimeout(() => t.inputEl.focus(), 0);
		});
		chipField(
			this.app,
			el,
			"Posições trabalhadas",
			"",
			() => this.plugin.store.posicoes().map((p) => p.nome),
			v.posicoes
		);
		numberField(el, "Séries", v.series, (x) => (v.series = x));
		numberField(el, "Repetições por série", v.repeticoes, (x) => (v.repeticoes = x));
		numberField(el, "Tempo (min)", v.tempo, (x) => (v.tempo = x), "Opcional, para drills por tempo.");
		numberField(el, "Frequência alvo (vezes/semana)", v.frequencia, (x) => (v.frequencia = x));
		textArea(el, "Como fazer", "Descrição do drill…", (x) => (v.descricao = x));
	}
	async submit() {
		if (!this.v.nome.trim()) {
			new Notice("Dê um nome para o drill.");
			return false;
		}
		await this.plugin.notes.criarDrill({ ...this.v, nome: this.v.nome.trim() });
		new Notice("Drill criado! 🔁");
		return true;
	}
}

/* ---------- Meta ---------- */

export class MetaModal extends BjjModal {
	private v = {
		titulo: "",
		categoria: CATEGORIAS_META[0] as string,
		horizonte: HORIZONTES_META[0] as string,
		prazo: moment().add(3, "months").format(DATE_FMT),
		metrica: "checklist",
		alvo: 10,
		porque: "",
		passos: [] as string[],
	};
	constructor(plugin: BjjPlugin) {
		super(plugin, "🎯 Nova meta");
	}
	build(el: HTMLElement) {
		const v = this.v;
		new Setting(el).setName("Meta").addText((t) => {
			t.setPlaceholder("Ex.: Pegar a faixa azul").onChange((x) => (v.titulo = x));
			setTimeout(() => t.inputEl.focus(), 0);
		});
		new Setting(el).setName("Categoria").addDropdown((d) => {
			CATEGORIAS_META.forEach((c) => d.addOption(c, c));
			d.setValue(v.categoria).onChange((x) => (v.categoria = x));
		});
		new Setting(el).setName("Horizonte").addDropdown((d) => {
			HORIZONTES_META.forEach((c) => d.addOption(c, c));
			d.setValue(v.horizonte).onChange((x) => {
				v.horizonte = x;
				const meses = x === "Curto prazo" ? 3 : x === "Médio prazo" ? 6 : 12;
				prazoInput.value = v.prazo = moment().add(meses, "months").format(DATE_FMT);
			});
		});
		let prazoInput!: HTMLInputElement;
		new Setting(el).setName("Prazo").addText((t) => {
			t.inputEl.type = "date";
			prazoInput = t.inputEl;
			t.setValue(v.prazo).onChange((x) => (v.prazo = x));
		});

		let alvoSetting: Setting;
		new Setting(el)
			.setName("Como medir o progresso")
			.addDropdown((d) => {
				Object.entries(METRICAS_META).forEach(([k, n]) => d.addOption(k, n));
				d.setValue(v.metrica).onChange((x) => {
					v.metrica = x;
					alvoSetting.settingEl.toggle(x !== "checklist");
				});
			});
		alvoSetting = numberField(
			el,
			"Alvo",
			v.alvo,
			(x) => (v.alvo = x),
			"Treinos e horas são contados automaticamente entre hoje e o prazo."
		);
		alvoSetting.settingEl.toggle(false);

		textArea(el, "Por que essa meta importa?", "Sua motivação…", (x) => (v.porque = x));
		textArea(el, "Passos (um por linha)", "Viram tarefas na nota", (x) => {
			v.passos = x
				.split("\n")
				.map((s) => s.trim())
				.filter(Boolean);
		});
	}
	async submit() {
		if (!this.v.titulo.trim()) {
			new Notice("Descreva a meta.");
			return false;
		}
		await this.plugin.notes.criarMeta({ ...this.v, titulo: this.v.titulo.trim() });
		new Notice("Meta criada! 🎯");
		return true;
	}
}

/* ---------- Seletores rápidos ---------- */

export class FileSuggestModal extends FuzzySuggestModal<TFile> {
	constructor(
		app: App,
		private files: TFile[],
		placeholder: string,
		private onPick: (f: TFile) => void
	) {
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

export class NivelModal extends FuzzySuggestModal<number> {
	constructor(app: App, private onPick: (n: number) => void) {
		super(app);
		this.setPlaceholder("Novo nível de domínio");
	}
	getItems() {
		return [1, 2, 3, 4, 5];
	}
	getItemText(n: number) {
		return `${n} — ${NIVEIS[n]}`;
	}
	onChooseItem(n: number) {
		this.onPick(n);
	}
}
