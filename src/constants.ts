export const VIEW_TYPE_DASHBOARD = "bjj-dashboard";

/** Valor do campo `bjj` no frontmatter que identifica cada tipo de nota. */
export const NOTE_KIND = {
	treino: "treino",
	posicao: "posicao",
	drill: "drill",
	meta: "meta",
} as const;
export type NoteKind = (typeof NOTE_KIND)[keyof typeof NOTE_KIND];

export const TIPOS_TREINO = [
	"Gi",
	"No-Gi",
	"Open Mat",
	"Aula particular",
	"Competição",
	"Drill / Técnica",
	"Condicionamento",
] as const;

export const CATEGORIAS_POSICAO = [
	"Guarda",
	"Passagem de guarda",
	"Raspagem",
	"Montada",
	"Costas",
	"Cem quilos / Lateral",
	"Joelho na barriga",
	"Meia-guarda",
	"Finalização",
	"Escape",
	"Queda / Em pé",
	"Defesa",
	"Transição",
] as const;

export const PERSPECTIVAS = ["Por cima", "Por baixo", "Neutro"] as const;

export const NIVEIS: Record<number, string> = {
	1: "Conheço",
	2: "Entendo os detalhes",
	3: "Faço no drill",
	4: "Faço no rola",
	5: "Domino",
};

export const CATEGORIAS_META = [
	"Técnica",
	"Competição",
	"Graduação",
	"Frequência",
	"Físico",
	"Outro",
] as const;

export const HORIZONTES_META = ["Curto prazo", "Médio prazo", "Longo prazo"] as const;

export const STATUS_META = ["Ativa", "Pausada", "Concluída", "Abandonada"] as const;

export const METRICAS_META: Record<string, string> = {
	checklist: "Checklist (tarefas na nota)",
	treinos: "Número de treinos",
	horas: "Horas de tatame",
	manual: "Manual (contador)",
};

export const FAIXAS = ["Branca", "Azul", "Roxa", "Marrom", "Preta"] as const;

export const CORES_FAIXA: Record<string, string> = {
	Branca: "#f2f2f2",
	Azul: "#1f5fc9",
	Roxa: "#6b2fa3",
	Marrom: "#6d4022",
	Preta: "#151515",
};
