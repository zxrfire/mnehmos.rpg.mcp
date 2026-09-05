/**
 * The people in a scene, as something the narrator can write a person out of.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE MEASUREMENT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Taken by playing a run with both seeds pinned and printing the phase-3 user
 * message verbatim. Three consecutive rounds of a fight, with two other people
 * standing in the square throughout, and the entire person-content of the
 * prompt was:
 *
 *     You are on 36 of 40; Kong Liekuan is on 39 of 43.
 *
 * Being taken into a house came back as *"Taken on by Sand Well Carriers,
 * ranked Skin"* - nobody admitted anybody. A robbery did better, because the
 * leverage path already sends a standing read, and still had nothing about
 * what the robbed man had left or whether he said a word. So the prose was dry
 * because there was no person in the prompt to write, and the fix is a person,
 * not better instructions.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * ONE CHANNEL, AND IT DOES NOT ASK WHAT THE VERB WAS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * This runs once at the end of every turn, over everybody standing here,
 * whether they were involved or not. It reads no action name, no intent and no
 * cause. What it reads is what moved, for whom, by how much of what they had -
 * and a bystander is priced as a share of the largest movement in the scene,
 * which is why witnessing needs no case of its own.
 *
 * ── HOW THE MOVEMENT IS KNOWN, AND WHY NOBODY HAS TO DECLARE IT ──────────
 *
 * By SNAPSHOT. The roster of who is here is taken as the turn opens and again
 * as it closes, and the difference is the movement. That is deliberate rather
 * than convenient: AGENTS.md records that a channel producers have to remember
 * to feed is a channel where *"a verb that forgot was indistinguishable from a
 * verb that decided not to"*, and this one has no such state. A verb written
 * tomorrow that moves somebody's purse produces a person in the prose without
 * its author knowing this file exists.
 *
 * {@link SceneAsPeopleFoundIt.declared} exists for the one thing a snapshot of
 * the roster cannot see, and the first draft of this header claimed it only
 * sharpened a reading that would have happened anyway. MEASURED, AND THAT WAS
 * WRONG. Three rounds of a fight, the player from 40 hit points to 26, and this
 * channel produced NOT ONE LINE - because a bout's damage lives in the fight
 * state and reaches neither the roster projection nor, mid-fight, the world row
 * (`whatItDidToThem` says so in its own header). Weight came out at 0.035
 * against a floor of 0.08 and the person being fought read as nobody.
 *
 * So `declared` is required, and it is still not a producer channel: both of
 * its writers are READS taken by the turn itself, beside the roster snapshot
 * and in the same place - the fight the turn is standing in, and the target the
 * plan named. No verb declares anything, and a verb written next year inherits
 * all three.
 *
 * ── AND SOMEBODY WHO IS NO LONGER STANDING HERE ──────────────────────────
 *
 * {@link SceneAsPeopleFoundIt.fallen} is the other thing two snapshots of the
 * living cannot see: a killing in front of witnesses moves the scene's weight
 * to its maximum, and the person it happened to is simply absent from the
 * second snapshot. They are priced and they get no sentence - they are dead,
 * and what happened to them is narrated by the verb that did it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE DISCOVERY GATE HOLDS, AND SOMEBODY UNNAMEABLE STILL SPEAKS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A name is printed only where `isAwareOf` allows it, exactly as `company()`
 * does. Everybody else is a shape at a standing - which is all the player has
 * of them too, and is enough to be spoken to by. Being in the room is
 * permission to see somebody, never to know who they are, and a scene that
 * hands over a name because somebody in it was upset has spent a discovery for
 * nothing.
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
 *
 * The two snapshots that make a bout legible. `hp` is what the fight state
 * holds now; the pool is the same one `whereThisFightStands` reads, so nothing
 * here re-derives a maximum.
 */
export interface BodyInAFight {
    /** The roster id, so the reading lands on the row the square holds. */
    personId: string;
    hp: number;
    maxHp: number;
}

/**
 * What a round of fighting did to the person on the other side of it.
 *
 * The one thing a snapshot of the roster cannot see, taken as a snapshot
 * anyway: the fight as the turn opened against the fight as it leaves it. A
 * fight that ENDED this turn has no second reading - the service drops it the
 * moment it settles - and the wounds it left are on the world row by then, so
 * what is declared for that turn is only that the two of them dealt with each
 * other, and the roster diff supplies the rest.
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
 *
 * `COMPANY_SHOWN` is 4 and bounds a look, which is a list. This is smaller
 * because each entry here is a whole person's situation, and a paragraph
 * carrying four of them is a paragraph about nobody. Whoever this cuts is
 * counted rather than dropped, the way every other short list in this package
 * counts what it left out.
 */
export const PEOPLE_WORTH_A_SENTENCE = 3;

/**
 * How much of what somebody had a change of binding is worth.
 *
 * Being taken onto a roll, or off one, is not denominated in stones and cannot
 * be read off a purse, so it is priced against the same 0..1 scale everything
 * else on it uses: large, because it is the thing that decides who answers for
 * you and what you are owed, and short of total, because a person is still the
 * person they were the day before. It is a scale rather than a judgement - the
 * same figure is paid for being admitted and for being thrown out.
 */
export const A_BINDING_MOVED = 0.6;

/** And a rung, on the same scale and for the same reason. */
export const A_RUNG_MOVED = 0.6;

/**
 * Who in the square this turn's plan actually pointed at.
 *
 * ── WHY THE PLAN AND NOT THE VERB ────────────────────────────────────────
 *
 * Every verb that deals with a person puts them in `target`, so one read of the
 * plan covers `interact`, `request`, `attack`, `steal`, `coerce`, `investigate`
 * and whatever is added next - and no verb has to remember anything. It is
 * deliberately not the RESOLVED party: resolution happens inside each verb, in
 * a dozen different places, and a channel that needed all dozen to report would
 * be the exact defect this file's header refuses.
 *
 * The consequence of reading the name instead is that a target naming nobody
 * present matches nobody, which is the correct answer: a sentence aimed at
 * somebody who is not here dealt with nobody who is.
 *
 * Measured: a gift offered to somebody standing in front of the player produced
 * no person at all, because nothing moved and nothing had addressed them. Being
 * spoken to is itself something to answer - `BEING_DEALT_WITH` is the floor -
 * and this is what supplies it.
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
 *
 * Merged here rather than at the call site so that the fight's reading wins
 * over the bare fact of having been dealt with, and so a person who is both is
 * one entry rather than two.
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

    // ── WHO IS WORTH A SENTENCE OF THEIR OWN ─────────────────────────────
    //
    // MEASURED. Being admitted to a house in front of three people produced
    // three lines that were word for word identical except for the name -
    // which is exactly right, because the engine knew nothing that separated
    // them, and is exactly the tic this channel was written to avoid. Three
    // sentences saying one thing is worse input than one sentence saying it.
    //
    // So the split is what the engine can actually tell apart. Somebody this
    // turn touched, or the player dealt with, is a person and gets a person's
    // sentence. Somebody who ONLY watched is interchangeable with every other
    // watcher - they share a weight, a band and a reading, because the engine
    // knows nothing else about them - so the room is one line, carrying how
    // many of them answered it out loud. That count is the licence the design
    // owner asked for: one of them is yelling, and which one is not a fact the
    // engine holds.
    //
    // Collapsing the SPEAKERS too was the second half of this and it was not
    // obvious. A first version lifted them out by name and produced, for two
    // witnesses to a killing, two sentences identical but for the name and
    // both ending "They answer it out loud." That is the same tic wearing the
    // fix as a costume.
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
        // ── AND WHICH OF THEM ARE NOT NEUTRAL ────────────────────────────
        //
        // The one thing that separates one watcher from another without any
        // new state: whose people they are. Somebody standing next to a
        // house-mate this turn emptied is not a bystander in the sense the
        // rest of the room is, and it is the difference between a square that
        // watches and a square that answers. Read off `sectId` and nothing
        // else - no relation table, no enum of stances, and no opinion about
        // what they will do about it, which is the narrator's to write.
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
 *
 * Null when the heaviest thing in the scene happened to somebody unaffiliated,
 * or to the player, which is `what-a-house-will-do-about-it.ts`'s own reading of
 * a wanderer: they answer to nobody, and nobody answers for them.
 */
function whoseHouseWasInIt(
    read: readonly { row: RosterEntry; involved: boolean }[]
): string | null {
    return read.find(entry => entry.involved)?.row.sectId ?? null;
}

/**
 * The people who are interchangeable, said once.
 *
 * The reading is the heaviest of theirs rather than an average, because they
 * are standing in one room and the band is a property of the room. Nothing is
 * dropped: the two counts are the fact, and a narrator wanting one of them to
 * shout has a number of bodies, a number of voices, and no name it was not
 * given.
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
 *
 * The order is deliberate and is the order a person is read in: who, how they
 * stand, what this did to them, what they are like, and only then whether they
 * said anything. The last clause is the engine's ruling and the only one the
 * narrator may not decline - if it says they spoke, somebody speaks.
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
 *
 * Only at the MARKED band, which is about one person in sixteen on each axis,
 * so most people carry no clause at all and the ones who do are worth the
 * words. Reticence first: it is the axis that decides whether they spoke, and
 * a silence with a reason beside it reads as a person rather than as an
 * omission.
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
 *
 * A FRACTION and never an amount. Twenty stones off somebody carrying twenty
 * is everything and off somebody carrying four thousand is nothing, and the
 * whole reason two people answer the same event differently is that the engine
 * is asking what it cost THEM. `what-a-deed-leaves.ts` prices every deed on
 * exactly this term.
 *
 * Two columns, because those are the two the roster projection carries. A
 * declared movement wins where a caller has one, which is how a fight - whose
 * damage lands on hit points, and hit points are not on this projection -
 * reads as heavily as it should.
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
 *
 * It exists to price the WITNESSES: a scene is as loud as the loudest thing
 * that happened in it, and the loudest thing is usually what happened to the
 * person playing. Four columns, and none of them is a verb name - a body, a
 * purse, a binding and a rung, diffed. A verb that moves any of them puts
 * people in the square who saw it, and its author never has to know that.
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
 *
 * Read off the square rather than off the roll: a member of a house whose
 * people are three provinces away is on their own this afternoon, and being on
 * your own is the whole of what this term is for. Nobody unaffiliated is ever
 * backed, which is `what-a-house-will-do-about-it.ts`'s own reading of a
 * wanderer - they answer to nobody, and nobody answers for them.
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
