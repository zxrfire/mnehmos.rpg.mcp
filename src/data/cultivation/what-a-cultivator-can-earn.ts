/**
 * What a cultivator can be paid for, at a rung: the one reading of it.
 *
 * Three tables, because there are three things and none of them is a
 * profession. Menial mortal work a cultivator may also take (the 'either' rows
 * of `OCCUPATIONS`), a contract off a town wall (`CONTRACTS`), and a mission off
 * a house's own board (`HOUSE_MISSIONS`). Anything that prices a cultivator's
 * month - what a copy of a book costs, what a house asks for a season on its
 * ground - reads this and not the tables, so the three cannot drift apart.
 */

import { OCCUPATIONS, type Settlement } from './mortal-world.js';
import { CONTRACTS } from './rogues.js';
import { HOUSE_MISSIONS } from './what-a-house-posts-for-its-own.js';

export type PaidAs = 'mortal work' | 'a contract' | 'a mission';

export interface APaidTerm {
    id: string;
    name: string;
    paidAs: PaidAs;
    minOrdinal: number;
    /** The rate, in cash per month. */
    cashPerMonth: number;
    settlements: readonly Settlement['kind'][];
    risk: 'none' | 'low' | 'moderate' | 'high' | 'lethal';
    note: string;
}

const asATerm = (paidAs: PaidAs) =>
    ({ id, name, minOrdinal, cashPerMonth, settlements, risk, note }: Omit<APaidTerm, 'paidAs'>): APaidTerm =>
        ({ id, name, paidAs, minOrdinal, cashPerMonth, settlements, risk, note });

/** Every row of all three tables, a mortal's trade included, for lookup by id. */
const EVERY_ROW: readonly APaidTerm[] = [
    ...OCCUPATIONS.map(asATerm('mortal work')),
    // A contract or a mission is called by its handle; its title is a task with slots.
    ...CONTRACTS.map(row => asATerm('a contract')({ ...row, name: row.said })),
    ...HOUSE_MISSIONS.map(row => asATerm('a mission')({ ...row, name: row.said }))
];

/** What a cultivator may be put to: a mortal's own trade is not among it. */
const EVERY_PAID_TERM: readonly APaidTerm[] = EVERY_ROW.filter(t =>
    t.paidAs !== 'mortal work' || OCCUPATIONS.some(o => o.id === t.id && o.kind === 'either'));

const BY_ID: ReadonlyMap<string, APaidTerm> = new Map(EVERY_ROW.map(t => [t.id, t]));

/**
 * Everything a cultivator at this rung could be paid for, where they are
 * standing or anywhere. Pitched at or below the rung; not narrowed by regard,
 * which is the board's question and not the rate's.
 */
export function whatACultivatorCanEarnAt(
    ordinal: number,
    settlementKind?: Settlement['kind']
): APaidTerm[] {
    return EVERY_PAID_TERM.filter(t =>
        t.minOrdinal <= ordinal
        && (settlementKind === undefined || t.settlements.includes(settlementKind)));
}

/** One row by id - mortal work, a contract or a mission - or undefined. */
export function aPaidTerm(id: string): APaidTerm | undefined {
    return BY_ID.get(id);
}
