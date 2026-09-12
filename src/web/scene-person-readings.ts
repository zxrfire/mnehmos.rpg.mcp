/**
 * The people in a scene, as something the narrator can write a person out of.
 */

import type { Cultivator } from '../schema/cultivation.js';
import { CRIPPLING_UNTREATED_INJURIES } from '../schema/cultivation.js';
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';
import type { KnowledgeGate } from './knowledge.js';
import { describeStanding } from './facts.js';
import { HELPLESS_REALM_GAP } from '../engine/cultivation/combat.js';
import { realmIndexOf } from '../engine/cultivation/realms.js';
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
    whatTheyReachFor,
    type WhatTheyReachFor
} from '../engine/social-leverage/what-somebody-reaches-for.js';
import {
    whatThisAsksOfThem,
    whetherTheySayIt,
    WORTH_A_SENTENCE,
    type Bearing
} from '../engine/social-leverage/moved-to-speak.js';
import {
    aGroupOfPeople,
    howManyOfThem,
    toOpenASentence
} from '../engine/social-leverage/a-group-is-named-not-counted.js';

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

/**
 * What one person in the square feels about the player, if anything.
 *
 * A lookup the caller owns, so this module stays clear of the ledger. Null for
 * anybody nothing has passed with, which is nearly everybody in nearly every
 * square.
 */
export type WhatTheyFeelAboutThePlayer = (personId: string) => string | null;

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
    /**
     * WHETHER THIS TURN WAS A SCENE OR A DIGEST. Defaults to a scene.
     *
     * FOUND BY PLAYING, seed `dm2-2`. A ten-year seclusion, cut short at 2.1
     * years, in a village square, produced this on the same screen as the
     * years-long digest:
     *
     *     6 other people are here. No part of this was theirs. They saw all of
     *     it, from close by. Every one of them answers, out loud.
     *
     * Six people watched somebody meditate for two years, from close by, and
     * every one of them spoke up about it.
     *
     * Everything this module does is priced against `sceneWeight` - "the
     * largest thing this turn did to anybody in it" - and on a digest turn that
     * is two years of cultivation, which prices out as an enormous incident
     * with an audience. But a stretch of years is not an INCIDENT. There is no
     * moment in it for anybody to have seen, and nothing for them to answer.
     *
     * PRESENCE SURVIVES AND WITNESSING DOES NOT, which is the whole of the
     * distinction. Six people being here afterwards is true and worth saying;
     * that they watched it happen and reacted is neither.
     *
     * Same root cause as `fallen` above - see `theFallenAmong` in
     * `turn-engine.ts`, where a death that happened somewhere in those years
     * was put on the ground at the player's feet by the same arithmetic.
     */
    wasAScene?: boolean;
    /**
     * What each person here feels about the player, off what has passed between
     * them.
     *
     * The design owner: *emotion needs to be tracked ... for every npc you do
     * stuff to, of course ... and emotions can change - like if i rob her,
     * she's sad. if i kill her father she's despondent (and acts that way).*
     *
     * The ACTS THAT WAY half is why it belongs here rather than in a sheet
     * somewhere: this is the channel that puts a person in front of the
     * narrator, and a person who has been robbed by whoever is standing in
     * front of them is not the same person as one who has not.
     */
    feels?: WhatTheyFeelAboutThePlayer;
    /**
     * How heavy a house is, on the ordinal ladder.
     *
     * A lookup the caller owns, for the same reason `feels` is: this module
     * stays clear of the sect catalog. Absent means every house weighs nothing,
     * which reads as nobody having a house worth naming - the honest answer for
     * a caller that cannot price one.
     */
    houseWeight?: (houseId: string | null) => number;
    /**
     * WHAT WAS SAID ABOUT THIS PERSON LAST TURN.
     *
     * This channel runs on every turn, and the renderer is deterministic, so a
     * reading whose parts have not changed arrives word for word again. Played,
     * through a bout of four exchanges:
     *
     *     Kong Zhaoshan, a little beneath you. They lost a little of what they
     *     had. They answer, out loud. Nothing they hold reaches. They ask.
     *
     * Five times running, and the last three sentences never once changed -
     * because what somebody reaches for does not change while the fight they
     * are in does not. A sentence read five times has stopped being a reading
     * of anybody.
     *
     * Given the parts said last turn, the ones that still say the same thing
     * are dropped, and a person about whom nothing new is true drops out
     * entirely. The caller owns the memory, the same way it owns `feels`: this
     * module holds no state between turns and must not start.
     */
    saidLastTurn?: (personId: string) => ReadonlySet<string>;
    /**
     * HOW HEAVY THE THING THIS TURN DID WAS, 0..1, WHERE IT MOVED NO BODY.
     *
     * Everything below is priced against `sceneWeight`, and `sceneWeight` was
     * the largest distance any BODY moved - a purse, HP, a binding, a rung, or
     * somebody who stopped standing anywhere. So a turn that is an EVENT rather
     * than a transfer priced at nought and the square read as idle.
     *
     * MEASURED, and the design owner's ruling on it: *"smashing your pill in
     * the middle of an audience should invite some reaction"*, then *"that
     * should fall out"*. Half of it already did - the world fact named five
     * witnesses - and the other half could not, because nothing told this
     * module anything had happened. Nobody was robbed, nobody was hurt, nobody
     * changed houses, and a treasure was destroyed in front of four people.
     *
     * A number on the same 0..1 scale as everything else, so it folds in
     * through the same `Math.max` and needs no case of its own.
     * `A_THING_ENDED_IN_FRONT_OF_THEM` is what a destruction is worth; a verb
     * that ends something else states its own.
     */
    theDeedItself?: number;
    /** Called once per person with everything true of them this turn. */
    noteWhatWasSaid?: (personId: string, parts: readonly string[]) => void;
    /**
     * THE EXACT FIGURE, FOR THE MACHINE-READABLE CHANNEL.
     *
     * The design owner, ruling on the headcount this module used to print:
     * *"the engine should still tell you exactly how many in the engine ruling
     * data ... but that's for the state itself ... not as part of narration."*
     * Everything this function RETURNS is player-facing - the caller pushes it
     * onto `facts.lines` and `facts.prose` - so the count cannot ride out that
     * way, and a second return value would change a signature the one caller
     * iterates. It leaves by the door `noteWhatWasSaid` already uses, and the
     * caller puts it in `facts.structure`.
     *
     * Called at most once a turn, and not at all when the square is empty.
     */
    noteHowManyWereHere?: (said: string) => void;
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
 * What a thing destroyed in front of people is worth, on the same scale.
 *
 * Set so a bystander reads at the lowest band and no higher. A witness carries
 * `WITNESS_SHARE` of the scene, which is 0.35, so this clears
 * `WORTH_A_SENTENCE` (0.08) at 0.21 and stays under `TOUCHED` (0.25). A
 * treasure smashed in a square is something the square WATCHED - it is not
 * something that happened TO anybody standing in it, and pricing it higher
 * would have four strangers reading as though they had lost something.
 *
 * The same figure as `A_RUNG_MOVED` and `A_BINDING_MOVED`, and for the same
 * reason: it is the weight of a thing that is large and is not a wound.
 */
export const A_THING_ENDED_IN_FRONT_OF_THEM = 0.6;

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
    // Read once, at the top, and used by every branch below. Two separate
    // `scene.wasAScene !== false` tests is how a scene rule gets applied in one
    // place and not the other.
    const wasAScene = scene.wasAScene !== false;
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
    // A DIGEST HAS NO SCENE WEIGHT. Everything below is priced against "the
    // largest thing this turn did to anybody in it", and on a stretch of years
    // that is the player's own cultivation - which prices out as an enormous
    // incident with an audience. Nobody watched it, because there was no moment
    // in it to watch. See `wasAScene`.
    const sceneWeight = !wasAScene ? 0 : Math.max(
        // WHAT THE TURN DID, AND NOT ONLY WHAT IT MOVED. See `theDeedItself`:
        // every other term here is a distance some body travelled, so an event
        // that transfers nothing priced at nought and nobody reacted to it.
        clamp01(scene.theDeedItself ?? 0),
        Math.abs(whatTheTurnDidToThePlayer(scene.playerBefore, scene.playerNow)),
        ...movements.map(m => Math.abs(m.moved)),
        // Somebody who was standing here and is not standing anywhere now. The
        // whole of them moved, which is what makes a killing the loudest thing
        // that can happen to the people who merely watched it.
        ...(scene.fallen ?? []).map(() => 1),
        0
    );

    // AND THE ONES IT HAPPENED TO HARDEST
    //
    // Somebody who is not standing anywhere now had the whole of what they had
    // moved, so they price out as the heaviest thing in the scene by the same
    // arithmetic as everybody else. They were priced INTO it before and never
    // given a line of their own, which left a killing as the one moment in this
    // game where the person it happened to had nothing to say about it.
    const dying = (scene.fallen ?? []).map(row => ({
        row,
        involved: true,
        gotAMoment: theyGotAMoment(row.realmOrdinal, scene.playerNow.realmOrdinal),
        asked: whatThisAsksOfThem({
            moved: -1,
            bodyLeft: 0,
            rungsOverTheOther: row.realmOrdinal - scene.playerNow.realmOrdinal,
            backed: standsWithTheirOwn(row, scene.now),
            sceneWeight,
            dealtWith: true,
            reticence: reticenceOf(row.id)
        })
    }));

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
            gotAMoment: true,
            asked: whatThisAsksOfThem(bearing)
        };
    })
        .concat(dying)
        .filter(entry => entry.asked.reading !== null)
        // Heaviest first: the person this turn actually happened to is the one
        // worth the sentence, and a square of forty must not push them out.
        .sort((a, b) => b.asked.weight - a.asked.weight
            || (a.row.id < b.row.id ? -1 : a.row.id > b.row.id ? 1 : 0));

    // ── WHO IS STANDING THERE WHEN YOU OPEN YOUR EYES ────────────────────
    //
    // ABOVE THE EMPTY-SCENE GUARD, because a digest always trips it. At zero
    // scene weight `readingFor` returns null for everybody - it stops below
    // `WORTH_A_SENTENCE` - so `read` is empty and the guard below returns
    // nothing at all. That is correct for this module, which is a REACTIONS
    // channel and has no reactions to report: nobody reacted, because there was
    // no moment to react to.
    //
    // But somebody coming out of a two-year sitting into a square with six
    // people in it can SEE the six people, and the time-skip facts carry no
    // census of their own - so with nothing here the player is told nothing at
    // all about who is around them. It was covered by accident before, as the
    // preamble to a witness line that should never have been printed.
    //
    // A name only where the player holds one: somebody they have never been
    // introduced to stays nameless whoever they are standing beside. See the
    // discovery gate, and `whoTheGroupIs` for the rest of what a group is
    // called.
    if (!wasAScene) {
        const standing = scene.now.filter(row => row.id !== scene.playerNow.id);
        if (standing.length === 0) return [];
        scene.noteHowManyWereHere?.(theCensus(standing.length, 0, 0));
        return [theRoom({
            count: standing.length,
            spoke: 0,
            ofTheirs: 0,
            reading: '',
            wasAScene: false,
            ...whoTheGroupIs(standing, scene.gate, scene.playerNow.id)
        })];
    }

    if (read.length === 0) return [];
    const dead = new Set((scene.fallen ?? []).map(row => row.id));

    // WHO IS WORTH A SENTENCE OF THEIR OWN
    const involved = read.filter(entry => entry.involved);
    const watchers = read.filter(entry => !entry.involved);

    // At most one person the player cannot name is lifted out. Two would both
    // be "somebody here", which is a sentence about an ambiguity rather than
    // about a person.
    let unnamedShown = false;
    const lines: string[] = [];
    /** Read out this turn, before the ones that read alike are folded. */
    const readOut: { who: string; said: string }[] = [];
    /**
     * Everybody the loop below settled, one way or another.
     *
     * The overflow line used to subtract three running totals from
     * `involved.length`, which gave a figure and no way to reach the PEOPLE -
     * so the only thing it could say about them was how many there were. Who
     * they are is what the sentence wants now, so who they are is what is kept.
     */
    const handled = new Set<string>();

    // ── MORE THAN ONE PERSON DYING IS ONE SENTENCE ───────────────────────
    //
    // `lastSentenceFor` is a fixed sentence, so two deaths in the same span
    // came out word for word identical except for the name:
    //
    //   Yun Huiya, well beneath you. They are dying, and there was time enough
    //   in it for them to know so. They say the last thing they are going to say.
    //   Han Lanping, well beneath you. They are dying, and there was time enough
    //   in it for them to know so. They say the last thing they are going to say.
    //
    // Which is the exact failure this whole channel was written to avoid, and
    // the one `theRoom` already solves for watchers: say them once, together.
    //
    // ── AND THE ONE THE PLAYER CANNOT NAME IS FOLDED IN TOO ──────────────
    //
    // This folded only the NAMEABLE dead, on the reasoning that putting an
    // unnameable person into a list of names would name them by implication.
    // The reasoning is right and the rule was too narrow: with one of each, two
    // deaths again came out word for word identical.
    //
    //   Bai Anming, a little above you. They are dying, and there was time
    //   enough in it for them to know so. They say the last thing...
    //   Somebody here whose name you do not have, well above you. They are
    //   dying, and there was time enough in it for them to know so. They say...
    //
    // A name and a count are not a list of names: "Bai Anming, and somebody
    // whose name you do not have, are dying" names exactly the one person it
    // named before.
    //
    // Only the ones who got a moment. Somebody the gap killed in a single
    // action was not present for any of it, which is a different sentence and
    // must not be folded into this one.
    const dyingAloud = involved.filter(entry => dead.has(entry.row.id) && entry.gotAMoment);
    const foldedIntoOne = new Set<string>();
    if (dyingAloud.length > 1) {
        for (const entry of dyingAloud) foldedIntoOne.add(entry.row.id);
        const names = dyingAloud
            .filter(entry => scene.gate.isAwareOf(scene.playerNow.id, 'cultivator', entry.row.id))
            .map(entry => entry.row.name);
        const unnameable = dyingAloud.length - names.length;
        const said = dyingAloud.filter(entry => entry.asked.aloud).length;
        const spoke = howManyOfThem(said, dyingAloud.length);
        lines.push(
            // Capitalised here rather than in `whoIsDying`, because the same
            // clause lands mid-sentence in a list of names and lower case is
            // right there. It opened with a digit until the headcount went.
            `${toOpenASentence(whoIsDying(names, unnameable))} are dying. `
            + (said === 0
                ? 'None of them says anything.'
                : said === dyingAloud.length
                    ? 'Each of them says a last thing.'
                    : `${toOpenASentence(spoke.said)} ${spoke.plural ? 'say' : 'says'} a last thing. `
                      + 'The rest say nothing.')
        );
    }

    for (const entry of involved) {
        // THE CAP IS ON PEOPLE, AND HAS TO BE COUNTED WHERE THEY ARE COLLECTED.
        // It read `lines.length` and the readings go into `readOut` now, so
        // nothing capped anything and twelve strangers were all read out.
        if (readOut.length >= PEOPLE_WORTH_A_SENTENCE) break;
        if (foldedIntoOne.has(entry.row.id)) continue;
        const nameable = scene.gate.isAwareOf(scene.playerNow.id, 'cultivator', entry.row.id);
        if (!nameable) {
            if (unnamedShown) continue;
            unnamedShown = true;
        }
        const said = dead.has(entry.row.id)
            ? lastSentenceFor(
                entry.row, nameable, entry.asked, entry.gotAMoment, scene.playerNow.realmOrdinal)
            : sentenceFor(
                entry.row,
                nameable,
                entry.asked,
                scene.playerNow.realmOrdinal,
                scene.feels?.(entry.row.id) ?? null,
                // Read for everybody who got a moment to speak, whatever the
                // verb was. This channel runs on every turn, so what somebody
                // reaches for is answered the same way for a robbery, a
                // killing, a demand and a snub - which is what makes it a rule
                // rather than a combat feature.
                whatTheyReachFor({
                    them: {
                        id: entry.row.id,
                        ordinal: entry.row.realmOrdinal,
                        stones: entry.row.spiritStones,
                        houseId: entry.row.sectId,
                        houseOrdinal: scene.houseWeight?.(entry.row.sectId) ?? 0
                    },
                    theOther: {
                        id: scene.playerNow.id,
                        ordinal: scene.playerNow.realmOrdinal,
                        stones: scene.playerNow.spiritStones,
                        houseId: scene.playerNow.sectId ?? null,
                        houseOrdinal: scene.houseWeight?.(scene.playerNow.sectId ?? null) ?? 0
                    }
                }),
                scene.saidLastTurn?.(entry.row.id) ?? null,
                parts => scene.noteWhatWasSaid?.(entry.row.id, parts)
            );
        // A person about whom nothing is newly true drops out, and does not
        // count against the cap: the cap is there to keep a crowded square from
        // pushing out the person the turn happened to, and somebody who reads
        // exactly as they read last turn is not that person.
        if (said === null) { handled.add(entry.row.id); continue; }
        readOut.push({ who: entry.row.name, said });
        handled.add(entry.row.id);
    }
    // ── AND TWO PEOPLE WHO READ THE SAME ARE ONE SENTENCE ────────────────
    //
    // The memory above stops a reading repeating across TURNS. Inside one
    // turn, an act aimed at a set leaves several people in the same state, and
    // each of them got the same twenty-eight words under a different name:
    //
    //   Liang Rongping, well beneath you. They lost a serious piece of what
    //   they had... They say nothing, where the others can see it.
    //   Jiang Xuchen, well beneath you. They lost a serious piece of what
    //   they had... They say nothing, where the others can see it.
    //
    // Which is the same failure `theRoom` solves for watchers and the dead
    // fold solves for the dying, one channel over.
    lines.push(...theOnesWhoReadTheSame(readOut));

    // Two sets, and they are different facts. Somebody the cap pushed out was
    // in it; somebody who only watched was not, and saying so is the whole of
    // what a bystander line is for.
    // Neither the folded dead nor the people who read the same as last turn are
    // overflow: this is the ones the CAP pushed out, and both of those were
    // said, or deliberately not said, for their own reasons.
    const overflow = involved
        .filter(entry => !handled.has(entry.row.id) && !foldedIntoOne.has(entry.row.id))
        .map(entry => entry.row);
    if (overflow.length > 0) {
        // THE COLLECTIVE, AND DELIBERATELY NOT A NAME. This said "3 others here
        // were in it too" - the same headcount as the room line, one paragraph
        // down. The corpus fold that fixes the room line is wrong HERE, because
        // the clause after it says nothing about them stands out: a sentence
        // that singles one of them out and then says none of them is worth
        // singling out argues with itself, and it would also put a fourth name
        // past `PEOPLE_WORTH_A_SENTENCE`. What they ARE is a property of the
        // set rather than of a person, so that half stays.
        const group = aGroupOfPeople({
            howMany: overflow.length,
            whatTheyAre: whoTheGroupIs(overflow, scene.gate, scene.playerNow.id).whatTheyAre
        });
        lines.push(
            `${toOpenASentence(group.said)} ${group.plural ? 'were' : 'was'} in it too, and `
            + 'nothing about them stands out from the rest.'
        );
    }
    if (watchers.length > 0) {
        // AND WHICH OF THEM ARE NOT NEUTRAL
        const ofTheirs = whoseHouseWasInIt(read);
        const spoke = watchers.filter(entry => entry.asked.aloud).length;
        const theirs = ofTheirs === null
            ? 0
            : watchers.filter(entry => entry.row.sectId === ofTheirs).length;
        scene.noteHowManyWereHere?.(theCensus(watchers.length, spoke, theirs));
        lines.push(theRoom({
            count: watchers.length,
            spoke,
            ofTheirs: theirs,
            reading: watchers[0].asked.reading!,
            wasAScene,
            ...whoTheGroupIs(
                watchers.map(entry => entry.row), scene.gate, scene.playerNow.id)
        }));
    }
    return lines;
}

/**
 * The figures the prose no longer prints, for `facts.structure`.
 *
 * Everything the room reading used to say in digits, said in digits, in the one
 * channel that is not read to a player. The prose above and this line are
 * computed from the same three numbers so they cannot disagree about what
 * happened.
 */
function theCensus(count: number, spoke: number, ofTheirs: number): string {
    return `${count} standing here besides the player and not individually read out; `
        + `${spoke} of them answered aloud; ${ofTheirs} are on the roll of the house of `
        + 'whoever this turn happened to hardest.';
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
 * Readings that say the same thing about different people, said once.
 *
 * A reading is a head - who this is and how they stand relative to the reader -
 * and then what happened to them. The BODY is what is tested: an act aimed at
 * a set leaves several people in the same state, and their readings then differ
 * only in the head. Measured on a square of ten, one act:
 *
 *   Liang Rongping, well beneath you. They lost a serious piece of what they
 *   had... They say nothing, where the others can see it.
 *   Jiang Xuchen, well beneath you. They lost a serious piece of what they
 *   had... They say nothing, where the others can see it.
 *   Gu Nuohe, far beneath you. They lost a serious piece of what they
 *   had... They say nothing, where the others can see it.
 *
 * Grouping on the whole sentence folds the first two and leaves the third
 * repeating every word of them, because one standing differs. So the body is
 * the key and the heads are gathered into it: `7 of them well beneath you, and
 * 3 far beneath you.`
 *
 * Past three names in one head, a count. A sentence that has to name seven
 * people before it says anything is a roster wearing a reading.
 */
function theOnesWhoReadTheSame(read: readonly { who: string; said: string }[]): string[] {
    const order: string[] = [];
    const byBody = new Map<string, { who: string; standing: string; said: string }[]>();
    for (const one of read) {
        const split = headAndBody(one.said, one.who);
        const held = byBody.get(split.body);
        const row = { who: one.who, standing: split.standing, said: one.said };
        if (held) held.push(row);
        else { order.push(split.body); byBody.set(split.body, [row]); }
    }
    return order.map(body => {
        const group = byBody.get(body)!;
        if (group.length === 1) return group[0]!.said;
        return `${theHeadsTogether(group)} ${body}`.trim();
    });
}

/** The head a reading opens with, and everything after it. */
function headAndBody(
    said: string,
    who: string
): { standing: string; body: string } {
    const opens = `${who}, `;
    const stop = said.indexOf('. ');
    // Not a reading this can take apart. Kept whole, which folds it only
    // against another reading that is whole and identical.
    if (!said.startsWith(opens) || stop < 0) return { standing: '', body: said };
    return {
        standing: said.slice(opens.length, stop),
        body: said.slice(stop + 2)
    };
}

/** Several heads over one body, gathered by the standing they share. */
function theHeadsTogether(
    group: readonly { who: string; standing: string }[]
): string {
    const byStanding = new Map<string, string[]>();
    for (const one of group) {
        const held = byStanding.get(one.standing);
        if (held) held.push(one.who);
        else byStanding.set(one.standing, [one.who]);
    }
    const parts = [...byStanding].map(([standing, names]) =>
        `${namesOrCount(names)}${standing.length > 0 ? ` ${standing}` : ''}`);
    return `${parts.length === 1
        ? parts[0]
        : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`}.`;
}

/**
 * Who they are, with the rest folded in behind the first of them.
 *
 * Past three names, this printed `${names.length} of them`. The corpus
 * construction is the one immediately above it in this file - a person named
 * and the remainder carried along - and it costs nothing here, because the
 * names are already in hand.
 */
function namesOrCount(names: readonly string[]): string {
    if (names.length > 3) return `${names[0]} and the others`;
    if (names.length === 1) return names[0]!;
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The dead, named where they can be named.
 *
 * A count is not a name: somebody the player has never been introduced to
 * stays that way whoever they are standing beside - and is not tallied either,
 * which is what `${unnameable} others whose names you do not have` was doing.
 */
function whoIsDying(names: readonly string[], unnameable: number): string {
    const nameless = unnameable === 0
        ? null
        : unnameable === 1
            ? 'somebody whose name you do not have'
            : 'others whose names you do not have';
    const parts = [...names, ...(nameless === null ? [] : [nameless])];
    if (parts.length === 1) return parts[0]!;
    return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * The people who are interchangeable, said once and never counted.
 *
 * This opened `${count} other people are here.` and closed `${spoke} of them
 * answer, out loud.` - which the design owner read back as *"reminder that this
 * is not xianxia prose"*. Both halves are the same defect: a tally of the
 * bodies in the room where the genre names the group, and a report of the
 * vantage and the modality where the genre has the group act.
 *
 * `aGroupOfPeople` holds the rule and the corpus figures behind it. What is
 * added here is the material it wants: one of them the player can name, and
 * what they are where the roll says so.
 */
function theRoom(over: {
    readonly count: number;
    readonly spoke: number;
    readonly ofTheirs: number;
    readonly reading: string;
    readonly wasAScene: boolean;
    /** One of them the player can put a name to, where there is one. */
    readonly named: string | null;
    /** What they all are, where they are all the same thing. */
    readonly whatTheyAre: string | null;
}): string {
    const group = aGroupOfPeople({
        howMany: over.count,
        named: over.named,
        whatTheyAre: over.whatTheyAre
    });
    // STANDING HERE RATHER THAN BEING HERE. A group that merely exists is the
    // inspector again with a nicer noun; a group doing something is what the
    // corpus has on every page.
    const who = `${toOpenASentence(group.said)} ${group.plural ? 'are' : 'is'} standing here.`;

    // PRESENCE SURVIVES A DIGEST AND WITNESSING DOES NOT. Six people being in
    // the square when somebody comes out of a two-year sitting is true and
    // worth saying. That they watched it and every one of them spoke up about
    // it is neither, and it is what this printed. See `wasAScene` on the input.
    if (!over.wasAScene) return who;

    const spoke = howManyOfThem(over.spoke, over.count);
    const voices = over.count === 1
        ? (over.spoke === 1 ? 'They say something about it.' : 'They say nothing.')
        : over.spoke === 0
            ? 'None of them says anything.'
            : over.spoke === over.count
                ? 'Every one of them answers.'
                : `${toOpenASentence(spoke.said)} ${spoke.plural ? 'answer' : 'answers'}. `
                  + 'The rest say nothing.';

    const ofTheirs = howManyOfThem(over.ofTheirs, over.count);
    const theirs = over.ofTheirs === 0
        ? ''
        : ` ${toOpenASentence(ofTheirs.said)} ${ofTheirs.plural ? 'are' : 'is'} of the same house `
          + 'as the person it happened to.';

    return `${who} ${over.reading} ${voices}${theirs}`;
}

/**
 * Who a set of people is, in the two things the genre names a group by.
 *
 * A name the player holds beats everything - "the Joy Lord and the others" is
 * the corpus workhorse. Failing that, what they all are, which the roll
 * answers when every one of them is on the same one: the disciples in the yard,
 * the elders. Both null in a village square full of strangers, which is the
 * case a plain collective is for.
 */
function whoTheGroupIs(
    rows: readonly RosterEntry[],
    gate: KnowledgeGate,
    playerId: string
): { named: string | null; whatTheyAre: string | null } {
    const named = rows.find(row => gate.isAwareOf(playerId, 'cultivator', row.id))?.name ?? null;

    const house = rows[0]?.sectName ?? null;
    const sameHouse = house !== null && rows.every(row => row.sectName === house);
    if (!sameHouse) return { named, whatTheyAre: null };

    const rank = rows[0]?.sectRank ?? null;
    const sameRank = rank !== null && rows.every(row => row.sectRank === rank);
    return {
        named,
        whatTheyAre: sameRank ? `${house} ${asMoreThanOne(rank)}` : `${house} people`
    };
}

/** A rank name said of several people holding it. */
function asMoreThanOne(rank: string): string {
    return /s$/i.test(rank) ? rank : `${rank}s`;
}

/**
 * One person's situation, as somebody in the room would perceive it.
 */
function sentenceFor(
    row: RosterEntry,
    nameable: boolean,
    asked: { aloud: boolean; reading: string | null },
    observerOrdinal: number,
    /** What they feel about the player, where anything has passed between them. */
    feeling: string | null = null,
    /** What they have to answer WITH, where the moment left them room to. */
    reachedFor: WhatTheyReachFor | null = null,
    /** Everything true of them the last time this channel ran. */
    alreadySaid: ReadonlySet<string> | null = null,
    /** Told everything true of them now, whether or not it is printed. */
    said: ((parts: readonly string[]) => void) | null = null
): string | null {
    const who = nameable
        ? row.name
        : 'Somebody here whose name you do not have';
    const standing = describeStanding(observerOrdinal, row.realmOrdinal);
    const disposition = whatTheyAreLike(row.id);

    // The head is not a part. It names who this is about, and a reading that
    // opened with the changed sentence and no name would be a reading of
    // nobody.
    const parts = ([
        asked.reading,
        // WHAT THEY FEEL ABOUT THE PLAYER BEFORE WHAT THEY ARE LIKE, because
        // the first is about this pair and the second is about them in
        // general, and a person robbed by whoever is standing in front of them
        // is read through that first.
        feeling,
        disposition === null ? null : `They ${disposition}.`,
        whetherTheySayIt(asked.aloud),
        // AND WITH WHAT.
        //
        // `whetherTheySayIt` says THAT somebody answers and stops there, which
        // handed the narrator a person opening their mouth and nothing to put
        // in it - every scene in the game read "They answer it out loud" and
        // ended. What they reach for is a read over what they actually hold
        // against the person in front of them: an arm, a house, a purse, or
        // asking. The engine names the lever; the narrator writes the words.
        asked.aloud ? reachedFor?.line ?? null : null
    ] as ReadonlyArray<string | null>).filter((part): part is string => part !== null);

    said?.(parts);
    const fresh = alreadySaid === null ? parts : parts.filter(part => !alreadySaid.has(part));
    // Nothing about them is newly true. The turn happened; it did not happen to
    // them in any way it had not already.
    if (fresh.length === 0) return null;
    return [`${who}, ${standing}.`, ...fresh].join(' ');
}

/**
 * Whether the moment left them room to say anything.
 *
 * `HELPLESS_REALM_GAP` is the combat module's own statement of when a
 * confrontation stopped being one: at that gap it resolves in a single action
 * with nothing contested and no exchange rolled, and somebody who never got an
 * exchange never got a moment to speak in either. Below it there were rounds,
 * and a person with rounds in them has a last thing to say.
 */
function theyGotAMoment(theirOrdinal: number, killersOrdinal: number): boolean {
    return realmIndexOf(killersOrdinal) - realmIndexOf(theirOrdinal) < HELPLESS_REALM_GAP;
}

/**
 * The last thing there was to see of somebody. The narrator writes the words;
 * this says only whether there were any and what the room could see.
 */
function lastSentenceFor(
    row: RosterEntry,
    nameable: boolean,
    asked: { aloud: boolean },
    gotAMoment: boolean,
    observerOrdinal: number
): string {
    const who = nameable
        ? row.name
        : 'Somebody here whose name you do not have';
    const standing = describeStanding(observerOrdinal, row.realmOrdinal);
    if (!gotAMoment) {
        return `${who}, ${standing}. They are dead. It took one action, and there was no part `
            + 'of it they were present for.';
    }
    return [
        `${who}, ${standing}.`,
        'They are dying, and there was time enough in it for them to know so.',
        // "and the not saying is visible" went with "out loud" and "from close
        // by": the engine reporting what could be observed about its own
        // observation. The silence is the fact and the room is standing in it.
        asked.aloud
            ? 'They say the last thing they are going to say.'
            : 'They do not say anything.'
    ].join(' ');
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
