import { moment as obsidianMoment } from "obsidian";

/*
 * Typed view of the moment.js instance bundled with Obsidian.
 *
 * Obsidian's `moment` export is typed through the `moment` package, which is only a transitive
 * dependency of `obsidian`. When it can't be resolved, every date call degrades to `any`. Declaring
 * the small subset this plugin uses keeps the code type-safe regardless of how dependencies are installed.
 */

export type Unit = "day" | "days" | "week" | "weeks" | "isoWeek" | "month" | "months" | "year";

export interface Moment {
	format(format?: string): string;
	clone(): Moment;
	startOf(unit: Unit): Moment;
	add(amount: number, unit: Unit): Moment;
	subtract(amount: number, unit: Unit): Moment;
	isBefore(other: Moment, unit?: Unit): boolean;
	isAfter(other: Moment, unit?: Unit): boolean;
	isSame(other: Moment, unit?: Unit): boolean;
	diff(other: Moment, unit?: Unit): number;
	fromNow(withoutSuffix?: boolean): string;
	isValid(): boolean;
	valueOf(): number;
}

interface MomentFactory {
	(input?: string | number, format?: string | readonly unknown[], strict?: boolean): Moment;
	/** Opaque marker accepted in a list of formats. */
	readonly ISO_8601: unknown;
}

export const moment = obsidianMoment as unknown as MomentFactory;
