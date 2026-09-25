/**
 * A piece of posted work, worded as the task it is: the job, for whom, where,
 * and for how long. The owner's form is "Staff the dock ticket booth at <place>
 * for the next 50 years"; a gerund like "Formation keeping" names a kind of
 * work and not a task.
 *
 * A row carries its task as a template and its handle (`said`) as the words a
 * player uses for it. Every task contains its handle, so a title typed back
 * reaches its row by the handle.
 */

import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';

/** "10 years", "3 months", "18 days" - whichever unit reads plainest. */
export function humanDays(days: number): string {
    const d = Math.max(0, Math.round(days));
    if (d >= DAYS_PER_YEAR) {
        const years = d / DAYS_PER_YEAR;
        const shown = years >= 10 ? Math.round(years) : Math.round(years * 10) / 10;
        return `${shown} year${shown === 1 ? '' : 's'}`;
    }
    if (d >= 60) {
        const months = Math.round(d / 30);
        return `${months} month${months === 1 ? '' : 's'}`;
    }
    return wholeDays(d);
}

export function wholeDays(days: number): string {
    const d = Math.max(0, Math.round(days));
    return `${d} day${d === 1 ? '' : 's'}`;
}

/**
 * The tag a posted row carries naming the house that posted it, so a board can
 * group rows by house without reading it back out of the title.
 */
const POSTED_FOR = 'for:';

export function postedForTag(house: string): string {
    return `${POSTED_FOR}${house}`;
}

/** The house a row was posted for, or null for paper nobody's house put up. */
export function whoPostedIt(entry: { tags: readonly string[] }): string | null {
    const tag = entry.tags.find(t => t.startsWith(POSTED_FOR));
    return tag === undefined ? null : tag.slice(POSTED_FOR.length);
}

/** A slot's value, or nothing where the engine does not know it. */
export type TaskSlots = Readonly<Record<string, string | null | undefined>>;

/** The word that joins a slot to the task, dropped with the slot when it is empty. */
const JOINED_BY = String.raw`(?:\s+(?:out of|at|for|to|from|in|over|under|below|around|between))?`;

/**
 * A task template filled with what the engine knows. `{term}` is always the
 * term the engine runs, in `humanDays`. A slot the engine cannot fill is left
 * out with the word that joined it, so a title never prints a blank or an id.
 */
export function aTaskAsPosted(task: string, slots: TaskSlots, days: number): string {
    const all: TaskSlots = { ...slots, term: humanDays(days) };
    return task
        .replace(new RegExp(`${JOINED_BY}\\s*\\{(\\w+)\\}`, 'g'), (whole, slot: string) => {
            const value = all[slot];
            if (value === null || value === undefined || value.trim() === '') return '';
            return whole.replace(`{${slot}}`, value.trim());
        })
        .replace(/\s+/g, ' ')
        .trim();
}

