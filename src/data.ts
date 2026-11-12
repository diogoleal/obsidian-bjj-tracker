import { App, TFile, moment } from "obsidian";
import { NOTE_KIND, NoteKind } from "./constants";
import type { BjjSettings } from "./settings";

type Moment = ReturnType<typeof moment>;
export const DATE_FMT = "YYYY-MM-DD";

export interface Treino {
	file: TFile;
	data: Moment;
	tipo: string;
	duracao: number; // minutos
	intensidade: number;
	rolas: number;
	finalizacoesFeitas: number;
	finalizacoesSofridas: number;
	tecnicas: string[]; // nomes (sem [[ ]])
	drills: string[];
}

export interface Posicao {
	file: TFile;
	nome: string;
	categoria: string;
	perspectiva: string;
	nivel: number;
}

export interface Drill {
	file: TFile;
	nome: string;
	posicoes: string[];
	frequencia: number; // vezes por semana
	execucoes: Moment[];
}

export interface Meta {
	file: TFile;
	titulo: string;
	categoria: string;
	horizonte: string;
	status: string;
	metrica: string;
	alvo: number;
	inicio: Moment | null;
	prazo: Moment | null;
	progressoManual: number;
}

export interface ProgressoMeta {
	atual: number;
	alvo: number;
	pct: number; // 0..1
	label: string;
}

const num = (v: unknown, fallback = 0): number => {
	const n = Number(v);
	return Number.isFinite(n) ? n : fallback;
};

const asArray = (v: unknown): unknown[] =>
	Array.isArray(v) ? v : v === undefined || v === null || v === "" ? [] : [v];

/** "[[Nota|alias]]" → "Nota" */
export function linkName(v: unknown): string {
	const s = String(v ?? "").trim();
	const m = s.match(/^\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]$/);
	return (m ? m[1] : s).trim();
}

export const toLink = (name: string) => `[[${name}]]`;

const parseDate = (v: unknown): Moment | null => {
	if (!v) return null;
	const m = moment(String(v), [DATE_FMT, moment.ISO_8601], true);
	return m.isValid() ? m : null;
};

export class BjjData {
	constructor(private app: App, private settings: () => BjjSettings) {}

	private notesOf(kind: NoteKind): { file: TFile; fm: Record<string, any> }[] {
		const out: { file: TFile; fm: Record<string, any> }[] = [];
		for (const file of this.app.vault.getMarkdownFiles()) {
			const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (fm && fm.bjj === kind) out.push({ file, fm });
		}
		return out;
	}

	treinos(): Treino[] {
		return this.notesOf(NOTE_KIND.treino)
			.map(({ file, fm }) => {
				const data = parseDate(fm.data) ?? moment(file.stat.ctime);
				return {
					file,
					data: data.clone().startOf("day"),
					tipo: String(fm.tipo ?? "Outro"),
					duracao: num(fm.duracao),
					intensidade: num(fm.intensidade),
					rolas: num(fm.rolas),
					finalizacoesFeitas: num(fm.finalizacoes_feitas),
					finalizacoesSofridas: num(fm.finalizacoes_sofridas),
					tecnicas: asArray(fm.tecnicas).map(linkName).filter(Boolean),
					drills: asArray(fm.drills).map(linkName).filter(Boolean),
				};
			})
			.sort((a, b) => b.data.valueOf() - a.data.valueOf());
	}

	posicoes(): Posicao[] {
		return this.notesOf(NOTE_KIND.posicao)
			.map(({ file, fm }) => ({
				file,
				nome: file.basename,
				categoria: String(fm.categoria ?? "Outro"),
				perspectiva: String(fm.perspectiva ?? ""),
				nivel: Math.min(5, Math.max(1, num(fm.nivel, 1))),
			}))
			.sort((a, b) => a.nome.localeCompare(b.nome));
	}

	drills(): Drill[] {
		return this.notesOf(NOTE_KIND.drill)
			.map(({ file, fm }) => ({
				file,
				nome: file.basename,
				posicoes: asArray(fm.posicoes).map(linkName).filter(Boolean),
				frequencia: num(fm.frequencia_semanal),
				execucoes: asArray(fm.execucoes)
					.map(parseDate)
					.filter((m): m is Moment => !!m)
					.sort((a, b) => b.valueOf() - a.valueOf()),
			}))
			.sort((a, b) => a.nome.localeCompare(b.nome));
	}

	metas(): Meta[] {
		return this.notesOf(NOTE_KIND.meta)
			.map(({ file, fm }) => ({
				file,
				titulo: file.basename,
				categoria: String(fm.categoria ?? "Outro"),
				horizonte: String(fm.horizonte ?? ""),
				status: String(fm.status ?? "Ativa"),
				metrica: String(fm.metrica ?? "checklist"),
				alvo: num(fm.alvo),
				inicio: parseDate(fm.inicio),
				prazo: parseDate(fm.prazo),
				progressoManual: num(fm.progresso),
			}))
			.sort((a, b) => {
				const pa = a.prazo?.valueOf() ?? Infinity;
				const pb = b.prazo?.valueOf() ?? Infinity;
				return pa - pb;
			});
	}

	progressoMeta(meta: Meta, treinos = this.treinos()): ProgressoMeta {
		const dentroDoPeriodo = (t: Treino) =>
			(!meta.inicio || !t.data.isBefore(meta.inicio, "day")) &&
			(!meta.prazo || !t.data.isAfter(meta.prazo, "day"));

		let atual = 0;
		let alvo = meta.alvo;
		let unidade = "";

		switch (meta.metrica) {
			case "treinos":
				atual = treinos.filter(dentroDoPeriodo).length;
				unidade = " treinos";
				break;
			case "horas":
				atual =
					Math.round(
						(treinos.filter(dentroDoPeriodo).reduce((s, t) => s + t.duracao, 0) / 60) * 10
					) / 10;
				unidade = " h";
				break;
			case "manual":
				atual = meta.progressoManual;
				break;
			default: {
				const tasks = (this.app.metadataCache.getFileCache(meta.file)?.listItems ?? []).filter(
					(li) => li.task !== undefined
				);
				alvo = tasks.length;
				atual = tasks.filter((li) => li.task !== " ").length;
				unidade = " tarefas";
			}
		}

		const pct = meta.status === "Concluída" ? 1 : alvo > 0 ? Math.min(1, atual / alvo) : 0;
		return { atual, alvo, pct, label: `${atual}/${alvo}${unidade}` };
	}

	/** Semanas consecutivas (até a atual) batendo a meta semanal de treinos. */
	sequenciaSemanas(treinos = this.treinos()): number {
		const meta = this.settings().metaSemanal;
		const porSemana = new Map<string, number>();
		for (const t of treinos) {
			const k = t.data.format("GGGG-[W]WW");
			porSemana.set(k, (porSemana.get(k) ?? 0) + 1);
		}
		const semana = moment().startOf("isoWeek");
		const bateu = (m: Moment) => (porSemana.get(m.format("GGGG-[W]WW")) ?? 0) >= meta;
		// a semana atual ainda está em andamento: só conta se já bateu
		if (!bateu(semana)) semana.subtract(1, "week");
		let streak = 0;
		while (bateu(semana)) {
			streak++;
			semana.subtract(1, "week");
		}
		return streak;
	}

	/** Contagem de vezes que cada técnica aparece nos treinos. */
	tecnicasMaisTreinadas(treinos = this.treinos(), limite = 8): [string, number][] {
		const cont = new Map<string, number>();
		for (const t of treinos) for (const n of t.tecnicas) cont.set(n, (cont.get(n) ?? 0) + 1);
		return [...cont.entries()].sort((a, b) => b[1] - a[1]).slice(0, limite);
	}
}
