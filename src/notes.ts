import { App, Notice, TFile, moment, normalizePath } from "obsidian";
import { NOTE_KIND, NIVEIS } from "./constants";
import { DATE_FMT, toLink } from "./data";
import { BjjSettings, folderFor } from "./settings";

export interface NovoTreino {
	data: string;
	tipo: string;
	duracao: number;
	academia: string;
	instrutor: string;
	intensidade: number;
	rolas: number;
	finalizacoesFeitas: number;
	finalizacoesSofridas: number;
	tecnicas: string[];
	drills: string[];
	lesoes: string;
	notas: string;
}

export interface NovaPosicao {
	nome: string;
	categoria: string;
	perspectiva: string;
	nivel: number;
	video: string;
	relacionadas: string[];
	detalhes: string;
}

export interface NovoDrill {
	nome: string;
	posicoes: string[];
	series: number;
	repeticoes: number;
	tempo: number;
	frequencia: number;
	descricao: string;
}

export interface NovaMeta {
	titulo: string;
	categoria: string;
	horizonte: string;
	prazo: string;
	metrica: string;
	alvo: number;
	porque: string;
	passos: string[];
}

export function sanitizeFileName(name: string): string {
	return name.replace(/[\\/:*?"<>|#^[\]]/g, "-").replace(/\s+/g, " ").trim() || "Sem título";
}

const bullets = (items: string[], fallback = "- ") =>
	items.length ? items.map((i) => `- ${i}`).join("\n") : fallback;

export class NoteFactory {
	constructor(private app: App, private settings: () => BjjSettings) {}

	private async ensureFolder(path: string) {
		const parts = normalizePath(path).split("/");
		let cur = "";
		for (const p of parts) {
			cur = cur ? `${cur}/${p}` : p;
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
		// processFrontMatter cuida da serialização YAML com segurança
		await this.app.fileManager.processFrontMatter(file, (fm) => Object.assign(fm, frontmatter));
		if (this.settings().abrirAposCriar) {
			await this.app.workspace.getLeaf(false).openFile(file);
		}
		return file;
	}

	findByName(name: string): TFile | null {
		return this.app.metadataCache.getFirstLinkpathDest(name, "");
	}

	async criarTreino(t: NovoTreino): Promise<TFile> {
		const s = this.settings();
		const fm = {
			bjj: NOTE_KIND.treino,
			data: t.data,
			tipo: t.tipo,
			duracao: t.duracao,
			academia: t.academia,
			instrutor: t.instrutor,
			intensidade: t.intensidade,
			rolas: t.rolas,
			finalizacoes_feitas: t.finalizacoesFeitas,
			finalizacoes_sofridas: t.finalizacoesSofridas,
			tecnicas: t.tecnicas.map(toLink),
			drills: t.drills.map(toLink),
			lesoes: t.lesoes,
			tags: ["bjj/treino"],
		};
		const titulo = moment(t.data, DATE_FMT).format("DD/MM/YYYY");
		const body = [
			`# Treino ${titulo} — ${t.tipo}`,
			"",
			"## Técnicas da aula",
			bullets(t.tecnicas.map(toLink)),
			"",
			"## Drills",
			bullets(t.drills.map(toLink)),
			"",
			"## Rolas",
			"- Parceiro / faixa:",
			"- O que funcionou:",
			"- Onde travei:",
			"",
			"## O que melhorar",
			"- ",
			"",
			"## Notas",
			t.notas || "",
			"",
		].join("\n");

		const file = await this.create(folderFor(s, "pastaTreinos"), `${t.data} - ${t.tipo}`, fm, body);

		for (const d of t.drills) {
			const df = this.findByName(d);
			if (df) await this.registrarExecucaoDrill(df, t.data, false);
		}
		return file;
	}

	async criarPosicao(p: NovaPosicao): Promise<TFile> {
		const fm = {
			bjj: NOTE_KIND.posicao,
			categoria: p.categoria,
			perspectiva: p.perspectiva,
			nivel: p.nivel,
			video: p.video,
			relacionadas: p.relacionadas.map(toLink),
			criado: moment().format(DATE_FMT),
			tags: ["bjj/posicao"],
		};
		const body = [
			`# ${p.nome}`,
			"",
			`> **${p.categoria}** · ${p.perspectiva} · Nível ${p.nivel} — ${NIVEIS[p.nivel]}`,
			"",
			"## Detalhes-chave",
			p.detalhes || "- ",
			"",
			"## Passo a passo",
			"1. ",
			"",
			"## Erros comuns",
			"- ",
			"",
			"## Continuações / Finalizações",
			"- ",
			"",
			"## Defesas e contra-ataques do oponente",
			"- ",
			"",
			"## Posições relacionadas",
			bullets(p.relacionadas.map(toLink)),
			"",
			"## Referências",
			p.video ? `- ${p.video}` : "- ",
			"",
		].join("\n");
		return this.create(folderFor(this.settings(), "pastaPosicoes"), p.nome, fm, body);
	}

	async criarDrill(d: NovoDrill): Promise<TFile> {
		const fm = {
			bjj: NOTE_KIND.drill,
			posicoes: d.posicoes.map(toLink),
			series: d.series,
			repeticoes: d.repeticoes,
			tempo_min: d.tempo,
			frequencia_semanal: d.frequencia,
			execucoes: [] as string[],
			tags: ["bjj/drill"],
		};
		const body = [
			`# ${d.nome}`,
			"",
			`**Volume:** ${d.series} séries × ${d.repeticoes} repetições${d.tempo ? ` · ${d.tempo} min` : ""}`,
			`**Frequência alvo:** ${d.frequencia}x por semana`,
			"",
			"## Posições trabalhadas",
			bullets(d.posicoes.map(toLink)),
			"",
			"## Como fazer",
			d.descricao || "- ",
			"",
			"## Pontos de atenção",
			"- ",
			"",
			"## Variações / progressões",
			"- ",
			"",
		].join("\n");
		return this.create(folderFor(this.settings(), "pastaDrills"), d.nome, fm, body);
	}

	async criarMeta(m: NovaMeta): Promise<TFile> {
		const fm = {
			bjj: NOTE_KIND.meta,
			categoria: m.categoria,
			horizonte: m.horizonte,
			status: "Ativa",
			inicio: moment().format(DATE_FMT),
			prazo: m.prazo,
			metrica: m.metrica,
			alvo: m.metrica === "checklist" ? 0 : m.alvo,
			progresso: 0,
			tags: ["bjj/meta"],
		};
		const passos = m.passos.length ? m.passos : [""];
		const body = [
			`# ${m.titulo}`,
			"",
			"## Por que essa meta importa",
			m.porque || "",
			"",
			"## Passos",
			passos.map((p) => `- [ ] ${p}`).join("\n"),
			"",
			"## Como vou medir",
			"- ",
			"",
			"## Diário de progresso",
			`- ${moment().format(DATE_FMT)}: meta criada`,
			"",
		].join("\n");
		return this.create(folderFor(this.settings(), "pastaMetas"), m.titulo, fm, body);
	}

	async registrarExecucaoDrill(file: TFile, data = moment().format(DATE_FMT), notify = true) {
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			const ex: string[] = Array.isArray(fm.execucoes) ? fm.execucoes : [];
			ex.push(data);
			fm.execucoes = ex;
		});
		if (notify) new Notice(`Drill "${file.basename}" registrado em ${data}.`);
	}

	async atualizarNivelPosicao(file: TFile, nivel: number) {
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			fm.nivel = nivel;
			fm.atualizado = moment().format(DATE_FMT);
		});
		new Notice(`"${file.basename}" → nível ${nivel} (${NIVEIS[nivel]}).`);
	}

	async incrementarMeta(file: TFile, delta = 1) {
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			fm.progresso = (Number(fm.progresso) || 0) + delta;
		});
	}

	async definirStatusMeta(file: TFile, status: string) {
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			fm.status = status;
			if (status === "Concluída") fm.concluida_em = moment().format(DATE_FMT);
		});
		new Notice(`Meta "${file.basename}": ${status}.`);
	}
}
