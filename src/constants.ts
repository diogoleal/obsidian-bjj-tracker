export const VIEW_TYPE_DASHBOARD = "bjj-dashboard";

/** Value of the `bjj` frontmatter field that identifies each note kind. */
export const NOTE_KIND = {
	training: "training",
	position: "position",
	drill: "drill",
	goal: "goal",
} as const;
export type NoteKind = (typeof NOTE_KIND)[keyof typeof NOTE_KIND];

export const LEVELS = [1, 2, 3, 4, 5] as const;

export const BELTS = ["white", "blue", "purple", "brown", "black"] as const;

export const BELT_COLORS: Record<string, string> = {
	white: "#f2f2f2",
	blue: "#1f5fc9",
	purple: "#6b2fa3",
	brown: "#6d4022",
	black: "#151515",
};

export const GOAL_STATUSES = ["active", "paused", "done", "abandoned"] as const;

export const GOAL_METRICS = ["checklist", "sessions", "hours", "manual"] as const;
