import { ItemView, TFile, WorkspaceLeaf, debounce, moment, setIcon } from "obsidian";
import { CORES_FAIXA, NIVEIS, VIEW_TYPE_DASHBOARD } from "./constants";
import { DATE_FMT, Treino } from "./data";
import type BjjPlugin from "./main";
import { DrillModal, MetaModal, PosicaoModal, TreinoModal } from "./modals";

export const SECOES = ["resumo", "heatmap", "metas", "drills", "posicoes", "tecnicas", "recentes"] as const;
export type Secao = (typeof SECOES)[number];

const horas = (min: number) => {
	const h = Math.floor(min / 60);
	const m = Math.round(min % 60);
	return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
};

/** Renderiza o painel (ou só algumas seções) dentro de `root`. Usado pela view e pelo bloco ```bjj```. */
export function renderDashboard(plugin: BjjPlugin, root: HTMLElement, secoes: readonly Secao[] = SECOES) {
	const { app, store: data, settings } = plugin;
	root.empty();
	root.addClass("bjj-dashboard");

	const treinos = data.treinos();
	const hoje = moment().startOf("day");

	const open = (f: TFile) => app.workspace.getLeaf(false).openFile(f);
	const link = (parent: HTMLElement, f: TFile, text = f.basename) => {
		const a = parent.createEl("a", { text, cls: "bjj-link", href: "#" });
		a.onclick = (e) => {
			e.preventDefault();
			open(f);
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
		b.createDiv({ cls: "bjj-bar-fill" }).style.width = `${Math.round(pct * 100)}%`;
		return b;
	};

	/* ---- Resumo ---- */
	if (secoes.includes("resumo")) {
		const header = root.createDiv({ cls: "bjj-header" });
		const faixa = header.createDiv({ cls: "bjj-belt" });
		faixa.style.setProperty("--belt-color", CORES_FAIXA[settings.faixa] ?? "#ccc");
		const tarja = faixa.createDiv({ cls: `bjj-belt-bar ${settings.faixa === "Preta" ? "is-black" : ""}` });
		for (let i = 0; i < settings.graus; i++) tarja.createDiv({ cls: "bjj-stripe" });

		const info = header.createDiv({ cls: "bjj-belt-info" });
		info.createDiv({
			cls: "bjj-belt-name",
			text: `Faixa ${settings.faixa}${settings.graus ? ` · ${settings.graus}º grau` : ""}`,
		});
		if (settings.dataGraduacao) {
			const desde = moment(settings.dataGraduacao, DATE_FMT);
			const treinosDesde = treinos.filter((t) => !t.data.isBefore(desde)).length;
			info.createDiv({
				cls: "bjj-muted",
				text: `Há ${desde.fromNow(true)} na graduação atual · ${treinosDesde} treinos desde então`,
			});
		}

		const actions = header.createDiv({ cls: "bjj-actions" });
		const btn = (text: string, icon: string, fn: () => void, cta = false) => {
			const b = actions.createEl("button", { cls: cta ? "mod-cta" : "" });
			setIcon(b.createSpan({ cls: "bjj-btn-icon" }), icon);
			b.createSpan({ text });
			b.onclick = fn;
		};
		btn("Treino", "plus", () => new TreinoModal(plugin).open(), true);
		btn("Posição", "map-pin", () => new PosicaoModal(plugin).open());
		btn("Drill", "repeat", () => new DrillModal(plugin).open());
		btn("Meta", "target", () => new MetaModal(plugin).open());

		const semana = treinos.filter((t) => t.data.isSame(hoje, "isoWeek"));
		const mes = treinos.filter((t) => t.data.isSame(hoje, "month"));
		const ano = treinos.filter((t) => t.data.isSame(hoje, "year"));
		const minutos = (ts: Treino[]) => ts.reduce((s, t) => s + t.duracao, 0);
		const streak = data.sequenciaSemanas(treinos);

		const cards = root.createDiv({ cls: "bjj-cards" });
		const card = (label: string, value: string, sub = "") => {
			const c = cards.createDiv({ cls: "bjj-card" });
			c.createDiv({ cls: "bjj-card-value", text: value });
			c.createDiv({ cls: "bjj-card-label", text: label });
			if (sub) c.createDiv({ cls: "bjj-card-sub", text: sub });
			return c;
		};
		const cSemana = card("Esta semana", `${semana.length}/${settings.metaSemanal}`, horas(minutos(semana)));
		bar(cSemana, semana.length / settings.metaSemanal, "is-small");
		card("Este mês", String(mes.length), horas(minutos(mes)));
		card("Este ano", String(ano.length), horas(minutos(ano)));
		card("Total", String(treinos.length), horas(minutos(treinos)));
		card("Sequência", `${streak} ${streak === 1 ? "semana" : "semanas"}`, `≥ ${settings.metaSemanal} treinos/semana`);

		const rolas = mes.reduce((s, t) => s + t.rolas, 0);
		const fFeitas = mes.reduce((s, t) => s + t.finalizacoesFeitas, 0);
		const fSofridas = mes.reduce((s, t) => s + t.finalizacoesSofridas, 0);
		card("Rolas no mês", String(rolas), `${fFeitas} finalizou · ${fSofridas} foi finalizado`);
	}

	/* ---- Heatmap ---- */
	if (secoes.includes("heatmap")) {
		const s = section("Frequência (últimas 26 semanas)", "calendar-days");
		const porDia = new Map<string, number>();
		for (const t of treinos) {
			const k = t.data.format(DATE_FMT);
			porDia.set(k, (porDia.get(k) ?? 0) + Math.max(t.duracao, 1));
		}
		const grid = s.createDiv({ cls: "bjj-heatmap" });
		const inicio = hoje.clone().startOf("isoWeek").subtract(25, "weeks");
		for (let w = 0; w < 26; w++) {
			const col = grid.createDiv({ cls: "bjj-heat-col" });
			for (let d = 0; d < 7; d++) {
				const dia = inicio.clone().add(w, "weeks").add(d, "days");
				const min = porDia.get(dia.format(DATE_FMT)) ?? 0;
				const lvl = min === 0 ? 0 : min < 60 ? 1 : min < 90 ? 2 : min < 150 ? 3 : 4;
				const cell = col.createDiv({ cls: `bjj-heat-cell lvl-${lvl}` });
				if (dia.isAfter(hoje)) cell.addClass("is-future");
				cell.setAttr("aria-label", `${dia.format("DD/MM/YYYY")}${min ? ` · ${horas(min)}` : ""}`);
			}
		}
		const porTipo = new Map<string, number>();
		const ultimos90 = treinos.filter((t) => t.data.isAfter(hoje.clone().subtract(90, "days")));
		for (const t of ultimos90) porTipo.set(t.tipo, (porTipo.get(t.tipo) ?? 0) + t.duracao);
		if (porTipo.size) {
			const total = [...porTipo.values()].reduce((a, b) => a + b, 0) || 1;
			const tipos = s.createDiv({ cls: "bjj-types" });
			tipos.createDiv({ cls: "bjj-muted", text: "Tempo por tipo (90 dias)" });
			[...porTipo.entries()]
				.sort((a, b) => b[1] - a[1])
				.forEach(([tipo, min]) => {
					const row = tipos.createDiv({ cls: "bjj-row" });
					row.createSpan({ cls: "bjj-row-label", text: tipo });
					bar(row, min / total);
					row.createSpan({ cls: "bjj-row-value", text: horas(min) });
				});
		}
	}

	/* ---- Metas ---- */
	if (secoes.includes("metas")) {
		const s = section("Metas ativas", "target");
		const metas = data.metas().filter((m) => m.status === "Ativa");
		if (!metas.length) empty(s, "Nenhuma meta ativa. Crie uma com o botão “Meta”.");
		for (const m of metas) {
			const p = data.progressoMeta(m, treinos);
			const row = s.createDiv({ cls: "bjj-goal" });
			const top = row.createDiv({ cls: "bjj-goal-top" });
			link(top, m.file, m.titulo);
			if (m.horizonte) top.createSpan({ cls: "bjj-badge", text: m.horizonte });
			top.createSpan({ cls: "bjj-badge is-muted", text: m.categoria });
			if (m.prazo) {
				const dias = m.prazo.diff(hoje, "days");
				top.createSpan({
					cls: `bjj-deadline ${dias < 0 ? "is-late" : dias <= 14 ? "is-soon" : ""}`,
					text: dias < 0 ? `atrasada ${-dias}d` : dias === 0 ? "vence hoje" : `${dias}d restantes`,
				});
			}
			const bottom = row.createDiv({ cls: "bjj-goal-bottom" });
			bar(bottom, p.pct, p.pct >= 1 ? "is-done" : "");
			bottom.createSpan({ cls: "bjj-row-value", text: `${p.label} · ${Math.round(p.pct * 100)}%` });
			const acts = bottom.createDiv({ cls: "bjj-mini-actions" });
			if (m.metrica === "manual") {
				const plus = acts.createEl("button", { text: "+1", attr: { "aria-label": "Somar 1" } });
				plus.onclick = () => plugin.notes.incrementarMeta(m.file, 1);
			}
			const done = acts.createEl("button", { attr: { "aria-label": "Marcar como concluída" } });
			setIcon(done, "check");
			done.onclick = () => plugin.notes.definirStatusMeta(m.file, "Concluída");
		}
		const concluidas = data.metas().filter((m) => m.status === "Concluída").length;
		if (concluidas) s.createDiv({ cls: "bjj-muted", text: `🏆 ${concluidas} meta(s) concluída(s) até agora` });
	}

	/* ---- Drills ---- */
	if (secoes.includes("drills")) {
		const s = section("Drills da semana", "repeat");
		const drills = data.drills();
		if (!drills.length) empty(s, "Nenhum drill cadastrado.");
		for (const d of drills) {
			const feitos = d.execucoes.filter((e) => e.isSame(hoje, "isoWeek")).length;
			const row = s.createDiv({ cls: "bjj-row" });
			const label = row.createSpan({ cls: "bjj-row-label" });
			link(label, d.file, d.nome);
			const alvo = d.frequencia || 1;
			bar(row, feitos / alvo, feitos >= alvo ? "is-done" : "");
			row.createSpan({
				cls: "bjj-row-value",
				text: `${feitos}/${d.frequencia || "–"}${d.execucoes[0] ? ` · último ${d.execucoes[0].fromNow()}` : ""}`,
			});
			const b = row.createEl("button", { cls: "bjj-icon-btn", attr: { "aria-label": "Registrar execução hoje" } });
			setIcon(b, "check");
			b.onclick = () => plugin.notes.registrarExecucaoDrill(d.file);
		}
	}

	/* ---- Posições ---- */
	if (secoes.includes("posicoes")) {
		const s = section("Repertório de posições", "map-pin");
		const posicoes = data.posicoes();
		if (!posicoes.length) {
			empty(s, "Nenhuma posição cadastrada.");
		} else {
			const niveis = s.createDiv({ cls: "bjj-levels" });
			for (let n = 1; n <= 5; n++) {
				const qtd = posicoes.filter((p) => p.nivel === n).length;
				const c = niveis.createDiv({ cls: `bjj-level lvl-${n}` });
				c.createDiv({ cls: "bjj-card-value", text: String(qtd) });
				c.createDiv({ cls: "bjj-card-label", text: `${n} · ${NIVEIS[n]}` });
			}
			const porCategoria = new Map<string, typeof posicoes>();
			for (const p of posicoes) porCategoria.set(p.categoria, [...(porCategoria.get(p.categoria) ?? []), p]);
			const cats = s.createDiv({ cls: "bjj-categories" });
			[...porCategoria.entries()]
				.sort((a, b) => b[1].length - a[1].length)
				.forEach(([cat, ps]) => {
					const det = cats.createEl("details", { cls: "bjj-category" });
					det.createEl("summary", { text: `${cat} (${ps.length})` });
					const ul = det.createEl("ul");
					ps.sort((a, b) => b.nivel - a.nivel).forEach((p) => {
						const li = ul.createEl("li");
						link(li, p.file, p.nome);
						li.createSpan({ cls: `bjj-dots lvl-${p.nivel}`, text: " " + "●".repeat(p.nivel) + "○".repeat(5 - p.nivel) });
					});
				});

			// Revisar: posições que não aparecem em treinos há mais tempo
			const ultimaVez = new Map<string, number>();
			for (const t of treinos)
				for (const n of t.tecnicas) if (!ultimaVez.has(n)) ultimaVez.set(n, t.data.valueOf());
			const revisar = posicoes
				.filter((p) => p.nivel < 5)
				.sort((a, b) => (ultimaVez.get(a.nome) ?? 0) - (ultimaVez.get(b.nome) ?? 0))
				.slice(0, 5);
			if (revisar.length) {
				const r = s.createDiv({ cls: "bjj-review" });
				r.createDiv({ cls: "bjj-muted", text: "Para revisar (há mais tempo sem treinar):" });
				const ul = r.createEl("ul");
				for (const p of revisar) {
					const li = ul.createEl("li");
					link(li, p.file, p.nome);
					const u = ultimaVez.get(p.nome);
					li.createSpan({ cls: "bjj-muted", text: u ? ` — ${moment(u).fromNow()}` : " — nunca registrada em treino" });
				}
			}
		}
	}

	/* ---- Técnicas mais treinadas ---- */
	if (secoes.includes("tecnicas")) {
		const top = data.tecnicasMaisTreinadas(treinos);
		if (top.length) {
			const s = section("Técnicas mais treinadas", "flame");
			const max = top[0][1];
			for (const [nome, qtd] of top) {
				const row = s.createDiv({ cls: "bjj-row" });
				const label = row.createSpan({ cls: "bjj-row-label" });
				const f = plugin.notes.findByName(nome);
				if (f) link(label, f, nome);
				else label.setText(nome);
				bar(row, qtd / max);
				row.createSpan({ cls: "bjj-row-value", text: `${qtd}x` });
			}
		}
	}

	/* ---- Recentes ---- */
	if (secoes.includes("recentes")) {
		const s = section("Treinos recentes", "history");
		if (!treinos.length) empty(s, "Nenhum treino registrado ainda. Bora pro tatame! 🥋");
		const table = s.createEl("table", { cls: "bjj-table" });
		if (treinos.length) {
			const head = table.createEl("thead").createEl("tr");
			["Data", "Tipo", "Duração", "Intens.", "Técnicas"].forEach((h) => head.createEl("th", { text: h }));
		}
		const tbody = table.createEl("tbody");
		for (const t of treinos.slice(0, 10)) {
			const tr = tbody.createEl("tr");
			link(tr.createEl("td"), t.file, t.data.format("DD/MM/YY"));
			tr.createEl("td", { text: t.tipo });
			tr.createEl("td", { text: t.duracao ? horas(t.duracao) : "–" });
			tr.createEl("td", { text: t.intensidade ? String(t.intensidade) : "–" });
			tr.createEl("td", { text: t.tecnicas.join(", ") || "–", cls: "bjj-muted" });
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
		return "Painel BJJ";
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
		const el = this.containerEl.children[1] as HTMLElement;
		renderDashboard(this.plugin, el);
	}
}
