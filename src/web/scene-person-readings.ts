/**
 * The people in a scene, as something the narrator can write a person out of.
 */

import type { Cultivator } from '../schema/cultivation.js';
import { CRIPPLING_UNTREATED_INJURIES } from '../schema/cultivation.js';
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';
import type { KnowledgeGate } from './knowledge.js';
import { describeStanding } from './facts.js';
import {
    reticenceOf,
    howMuchTheyLetShow,
    RETICENCE_BANDS
} from '../engine/social-leverage/emotional-reticence.js';
import {
    openHandednessOf,
    howTheyHoldWhatTheyHave,
    DISPOSITION_BANDS
} from '../engine/social-leverage/how-freely-somebody-parts-with-what-they-have.js';
import {
    whatThisAsksOfThem,
    whetherTheySayIt,
    WORTH_A_SENTENCE,
    type Bearing
} from '../engine/social-leverage/moved-to-speak.js';

/**
 * What the turn can read that the roster projection does not carry.
 *
 * Not a producer channel - see the header. Both writers are reads the turn
 * takes for itself, in the one place the roster snapshot is already taken.
 */
export interface DeclaredMovement {
    personId: string;
    /** Signed fraction of what they had, -1..+1. */
    moved?: number;
    /** What is left of the body, 0..1. */
    bodyLeft?: number;
    /** Whether the player dealt with them directly, whatever came of it. */
    dealtWith?: boolean;
}

export interface SceneAsPeopleFoundIt {
    /** Everybody standing here as the turn opened. */
    before: readonly RosterEntry[];
    /** The same square as the turn leaves it. */
    now: readonly RosterEntry[];
    playerBefore: Cultivator;
    playerNow: Cultivator;
    gate: KnowledgeGate;
    declared?: readonly DeclaredMovement[];
    /**
     * Anybody who was standing here and is now dead.
     *
     * Priced into the scene and never given a sentence. A query the turn runs
     * over the same rows the snapshot came from, not a thing a verb reports.
     */
    fallen?: readonly RosterEntry[];
}

/**
 * A body, as the fight the turn is standing in prices it.
 */
export interface BodyInAFight {
    /** The roster id, so the reading lands on the row the square holds. */
    personId: string;
    hp: number;
    maxHp: number;
}

/**
 * What a round of fighting did to the person on the other side of it.
 */
export function whatTheFightDidToThem(
    opened: BodyInAFight | null,
    closed: BodyInAFight | null
): DeclaredMovement | null {
    const person = closed ?? opened;
    if (!person) return null;
    if (!closed) return { personId: person.personId, dealtWith: true };

    const pool = Math.max(1, closed.maxHp);
    const before = opened && opened.personId === closed.personId ? opened.hp : closed.maxHp;
    return {
        personId: closed.personId,
        moved: clampSigned((closed.hp - before) / pool),
        bodyLeft: clamp01(closed.hp / pool),
        dealtWith: true
    };
}

/**
 * The most people who get a sentence.
 */
export const PEOPLE_WORTH_A_SENTENCE = 3;

/**
 * How much of what somebody had a change of binding is worth.
 */
export const A_BINDING_MOVED = 0.6;

/** And a rung, on the same scale and for the same reason. */
export const A_RUNG_MOVED = 0.6;

/**
 * Who in the square this turn's plan actually pointed at.
 */
export function whoThePlanPointedAt(
    targets: readonly (string | null | undefined)[],
    square: readonly RosterEntry[]
): string[] {
    const said = targets
        .map(target => (target ?? '').trim().toLowerCase())
        .filter(target => target.length >= 2);
    if (said.length === 0) return [];

    const found = new Set<string>();
    for (const row of square) {
        const name = row.name.trim().toLowerCase();
        if (name.length < 2) continue;
        // Contained rather than equal, because a target arrives carrying
        // whatever the sentence wrapped the name in - "Han Peiru with 60
        // spirit stones to introduce me" is one string by the time it is here.
        if (said.some(target => target === name || target.includes(name))) found.add(row.id);
    }
    return [...found];
}

/**
 * The two readings the turn takes for itself, as one list.
 */
export function theBearingsThisTurnCanRead(
    fightBefore: BodyInAFight | null,
    fightNow: BodyInAFight | null,
    dealtWith: readonly string[]
): DeclaredMovement[] {
    const byPerson = new Map<string, DeclaredMovement>();
    for (const id of dealtWith) byPerson.set(id, { personId: id, dealtWith: true });

    const fought = whatTheFightDidToThem(fightBefore, fightNow);
    if (fought) byPerson.set(fought.personId, { ...byPerson.get(fought.personId), ...fought });

    return [...byPerson.values()];
}

// ─────────────────────────────────────────────────────────────────────────
// THE CHANNEL
// ─────────────────────────────────────────────────────────────────────────

export function whatThePeopleHereAreAnswering(scene: SceneAsPeopleFoundIt): string[] {
    const had = new Map(scene.before.map(row => [row.id, row]));
    const declared = new Map((scene.declared ?? []).map(row => [row.personId, row]));

    // The largest thing this turn did to anybody in it, the player included.
    // A bystander is priced against this, which is the whole of how witnessing
    // works and the reason it needs no case of its own.
    const movements = scene.now.map(row => ({
        row,
        moved: movementOf(row, had.get(row.id), declared.get(row.id)),
        bodyLeft: bodyLeftOf(row, declared.get(row.id))
    }));
    const sceneWeight = Math.max(
        Math.abs(whatTheTurnDidToThePlayer(scene.playerBefore, scene.playerNow)),
        ...movements.map(m => Math.abs(m.moved)),
        // Somebody who was standing here and is not standing anywhere now. The
        // whole of them moved, which is what makes a killing the loudest thing
        // that can happen to the people who merely watched it.
        ...(scene.fallen ?? []).map(() => 1),
        0
    );

    const read = movements.map(m => {
        const dealtWith = declared.get(m.row.id)?.dealtWith ?? false;
        const bearing: Bearing = {
            moved: m.moved,
            bodyLeft: m.bodyLeft,
            rungsOverTheOther: m.row.realmOrdinal - scene.playerNow.realmOrdinal,
            backed: standsWithTheirOwn(m.row, scene.now),
            sceneWeight,
            dealtWith,
            reticence: reticenceOf(m.row.id)
        };
        return {
            row: m.row,
            // Whether any of this was THEIRS, which is the split the output is
            // built on. A pure witness is somebody nothing touched and nobody
            // addressed; every other entry is a person this turn happened to.
            involved: m.moved !== 0 || m.bodyLeft < 1 || dealtWith,
            asked: whatThisAsksOfThem(bearing)
        };
    })
        .filter(entry => entry.asked.reading !== null)
        // Heaviest first: the person this turn actually happened to is the one
        // worth the sentence, and a square of forty must not push them out.
        .sort((a, b) => b.asked.weight - a.asked.weight
            || (a.row.id < b.row.id ? -1 : a.row.id > b.row.id ? 1 : 0));

    if (read.length === 0) return [];

    // WHO IS WORTH A SENTENCE OF THEIR OWN
    const involved = read.filter(entry => entry.involved);
    const watchers = read.filter(entry => !entry.involved);

    // At most one person the player cannot name is lifted out. Two would both
    // be "somebody here", which is a sentence about an ambiguity rather than
    // about a person.
    let unnamedShown = false;
    const lines: string[] = [];
    let spokenFor = 0;
    for (const entry of involved) {
        if (lines.length >= PEOPLE_WORTH_A_SENTENCE) break;
        const nameable = scene.gate.isAwareOf(scene.playerNow.id, 'cultivator', entry.row.id);
        if (!nameable) {
            if (unnamedShown) continue;
            unnamedShown = true;
        }
        lines.push(sentenceFor(entry.row, nameable, entry.asked, scene.playerNow.realmOrdinal));
        spokenFor++;
    }

    // Two counts, and they are different facts. Somebody the cap pushed out was
    // in it; somebody who only watched was not, and saying so is the whole of
    // what a bystander line is for.
    const overflow = involved.length - spokenFor;
    if (overflow > 0) {
        lines.push(
            `${overflow} other${overflow === 1 ? '' : 's'} here ${overflow === 1 ? 'was' : 'were'} `
            + 'in it too, and nothing about them stands out from the rest.'
        );
    }
    if (watchers.length > 0) {
        // AND WHICH OF THEM ARE NOT NEUTRAL
        const ofTheirs = whoseHouseWasInIt(read);
        lines.push(theRoom(
            watchers.length,
            watchers.filter(entry => entry.asked.aloud).length,
            ofTheirs === null
                ? 0
                : watchers.filter(entry => entry.row.sectId === ofTheirs).length,
            watchers[0].asked.reading!
        ));
    }
    return lines;
}

/**
 * The house of whoever this turn happened to hardest, when they have one.
 */
function whoseHouseWasInIt(
    read: readonly { row: RosterEntry; involved: boolean }[]
): string | null {
    return read.find(entry => entry.involved)?.row.sectId ?? null;
}

/**
 * The people who are interchangeable, said once.
 */
function theRoom(count: number, spoke: number, ofTheirs: number, reading: string): string {
    const who = count === 1
        ? 'One other person here had no part in it.'
        : `${count} other people here had no part in it.`;

    const voices = count === 1
        ? (spoke === 1
            ? 'They say something about it.'
            : 'They do not say anything, and the not saying is visible.')
        : spoke === 0
            ? 'None of them says anything, and the not saying is visible.'
            : spoke === count
                ? 'Every one of them answers it out loud.'
                : `${spoke} of them answer it out loud. The rest do not, and the not saying `
                  + 'is visible.';

    const theirs = ofTheirs === 0
        ? ''
        : ofTheirs === 1
            ? ' One of them is of the same house as the person it happened to.'
            : ` ${ofTheirs} of them are of the same house as the person it happened to.`;

    return `${who} ${reading} ${voices}${theirs}`;
}

/**
 * One person's situation, as somebody in the room would perceive it.
 */
function sentenceFor(
    row: RosterEntry,
    nameable: boolean,
    asked: { aloud: boolean; reading: string | null },
    observerOrdinal: number
): string {
    const who = nameable
        ? row.name
        : 'Somebody here whose name this cultivator does not have';
    const standing = describeStanding(observerOrdinal, row.realmOrdinal);
    const disposition = whatTheyAreLike(row.id);

    return [
        `${who}, ${standing}.`,
        asked.reading,
        disposition === null ? null : `They ${disposition}.`,
        whetherTheySayIt(asked.aloud)
    ].filter((part): part is string => part !== null).join(' ');
}

/**
 * The one clause of disposition a sentence gets, when there is one.
 */
function whatTheyAreLike(personId: string): string | null {
    const reticence = reticenceOf(personId);
    if (Math.abs(reticence) >= RETICENCE_BANDS.MARKED) return howMuchTheyLetShow(reticence);
    const openHanded = openHandednessOf(personId);
    if (Math.abs(openHanded) >= DISPOSITION_BANDS.MARKED) {
        return howTheyHoldWhatTheyHave(openHanded);
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT MOVED
// ─────────────────────────────────────────────────────────────────────────

/**
 * How much of what this person had this turn moved, signed.
 */
function movementOf(
    now: RosterEntry,
    before: RosterEntry | undefined,
    declared: DeclaredMovement | undefined
): number {
    if (declared?.moved !== undefined && Number.isFinite(declared.moved)) {
        return clampSigned(declared.moved);
    }
    if (!before) return 0;

    const purse = (now.spiritStones - before.spiritStones)
        / Math.max(1, before.spiritStones);
    // An injury is a movement away from them, so the sign is inverted here and
    // nowhere else: the column counts up as the person is worse off.
    const body = -(now.untreatedInjuries - before.untreatedInjuries)
        / CRIPPLING_UNTREATED_INJURIES;

    return clampSigned(Math.abs(purse) >= Math.abs(body) ? purse : body);
}

function bodyLeftOf(row: RosterEntry, declared: DeclaredMovement | undefined): number {
    if (declared?.bodyLeft !== undefined && Number.isFinite(declared.bodyLeft)) {
        return clamp01(declared.bodyLeft);
    }
    return clamp01(1 - row.untreatedInjuries / CRIPPLING_UNTREATED_INJURIES);
}

/**
 * What this turn did to the player, on the same 0..1 scale as everybody else.
 */
export function whatTheTurnDidToThePlayer(before: Cultivator, now: Cultivator): number {
    const body = safeFraction(now.hp, now.maxHp) - safeFraction(before.hp, before.maxHp);
    const purse = (now.spiritStones - before.spiritStones) / Math.max(1, before.spiritStones);
    const bound = (before.sectId ?? null) === (now.sectId ?? null)
        ? 0
        : (now.sectId ? A_BINDING_MOVED : -A_BINDING_MOVED);
    const rung = now.realmOrdinal === before.realmOrdinal
        ? 0
        : (now.realmOrdinal > before.realmOrdinal ? A_RUNG_MOVED : -A_RUNG_MOVED);

    return clampSigned([body, purse, bound, rung]
        .reduce((worst, n) => Math.abs(n) > Math.abs(worst) ? n : worst, 0));
}

/**
 * Whether anybody standing here answers for them.
 */
function standsWithTheirOwn(row: RosterEntry, here: readonly RosterEntry[]): boolean {
    if (!row.sectId) return false;
    return here.some(other => other.id !== row.id && other.sectId === row.sectId);
}

// ─────────────────────────────────────────────────────────────────────────

function safeFraction(part: number, whole: number): number {
    return whole > 0 ? clamp01(part / whole) : 0;
}

function clamp01(n: number): number {
    return !Number.isFinite(n) ? 0 : n < 0 ? 0 : n > 1 ? 1 : n;
}

function clampSigned(n: number): number {
    return !Number.isFinite(n) ? 0 : n < -1 ? -1 : n > 1 ? 1 : n;
}

/** Re-exported so a caller can ask the same question the bands ask. */
export { WORTH_A_SENTENCE };
