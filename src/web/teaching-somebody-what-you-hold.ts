/**
 * The player doing the teaching, which is the half of the read that was missing.
 *
 * `what-asking-this-person-for-this-would-cost-them.ts` prices being taught
 * thoroughly and wrote its own gap down in its header: nothing anywhere in
 * `src/` wrote an art onto another person from the played side, and
 * `taught_technique` had been a `FavorCause` since the ledger was written with
 * no producer at all. Measured on the refusal probe, 28 turns each: *I teach
 * her what I know* and *I show her the form* both reached the blank look.
 *
 * ── NOTHING HERE DECIDES ANYTHING THAT WAS NOT ALREADY DECIDED ───────────
 *
 * Every gate is a call into the module that already answers the same question
 * about somebody else, which is the test `AGENTS.md` sets for whether a
 * mechanic is bespoke - take the four away and there is no teaching system left
 * over:
 *
 *   couldWriteOutACopy   CAN THEY. The one thing in the engine that answers
 *                        "do you hold this well enough to put it in somebody
 *                        else's hands". It reads a mastery column where the
 *                        caller has one and the ordinal where it does not,
 *                        which is exactly how `canReproduce` judges every
 *                        master in the world - so the player is held to the
 *                        same bar rather than to a second one written for them.
 *   whatTheyWouldTeachYou  WHICH ART. Run with the two ends swapped, which its
 *                        own author said it would invert to for free.
 *   betrayalOfSelling    WHOSE IT WAS, on the four rungs the world already
 *                        prices a leaked book on.
 *   monthsToCopy         HOW LONG. The same body of work counted the same way -
 *                        a road's realm sections - because walking somebody
 *                        down an art covers what writing it out covers.
 *
 * ── WHY THE BAR IS THE COPYIST'S BAR AND NOT A LOWER ONE ─────────────────
 *
 * A teacher is in the room and a manual is not, so the obvious objection is
 * that teaching should be possible at less than the whole of an art. The answer
 * is what the far side of the transaction looks like: there is one row for an
 * art on a person and no such thing as a partial one. What goes onto the
 * student is the whole road or nothing, and somebody at sixty parts in a
 * hundred would be putting their gaps in as well - which is the refusal
 * `sellACopyOfAnArt` already writes, in its own words, for the identical
 * reason.
 *
 * ── AND NOTHING HERE BANS ANYTHING ───────────────────────────────────────
 *
 * Handing a house its own canon to a stranger is available, is priced as the
 * betrayal it is, and the house answers it through the same
 * `whatTheHouseDoesAboutIt` a sold copy goes through. The refusals below are
 * all about whether the act is COHERENT - you hold nothing, they hold it
 * already, their root will not take it, they cannot open it yet - and never
 * about whether it was allowed.
 */

import { getTechnique, carriesTo } from '../data/cultivation/techniques.js';
import { getSect } from '../data/cultivation/sects.js';
import { DAYS_PER_YEAR } from '../engine/cultivation/cultivation.js';
import { rankName } from '../engine/cultivation/realms.js';
import { highestStage, type KnowingStage } from '../engine/social/discovery.js';
import { createObligation } from '../engine/social/grudges.js';
import { theStageAWitnessReaches } from '../engine/social-leverage/selling-a-copy-of-somebody-elses-art.js';
import { aDeedEntersTheWorld } from '../engine/world/a-deed-enters-the-world-as-a-fact.js';
import { whatTheirReferenceAffords } from '../engine/world/recognising-whose-art-you-just-watched.js';
import {
    FULLY_MASTERED,
    betrayalOfSelling,
    couldWriteOutACopy,
    manualsOf,
    masteryBarFor,
    noHouseCanCallItTheirs,
    suitsRoot,
    whoseArt
} from '../engine/world/manuals.js';
import { monthsToCopy } from '../engine/world/what-a-copy-of-a-manual-costs-at-a-stall.js';
import type { NpcRecord } from '../engine/world/npc-state.js';
import { writeOneObligation } from '../storage/repos/obligation.repo.js';
import type { AmbientQi, Cultivator, Run } from '../schema/cultivation.js';
import { type DatabaseHandle } from './encounters.js';
import { resolveTechnique } from './entities.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { refused } from './tool-result-prose.js';
import { TRAVEL_FOCUS } from './turn-constants.js';
import type { Execution, ToolCallRecord } from './turn-wire-shapes.js';
import type { GameService } from './turn-engine.js';
import {
    whatTheyCouldTeach,
    whatTheyWouldTeachYou
} from './what-asking-this-person-for-this-would-cost-them.js';

/**
 * The arts this cultivator could put into THIS person's hands.
 *
 * The forward read, run backwards. `whatTheyWouldTeachYou(asked, asking)`
 * answers which of `asked`'s arts they would volunteer to `asking`, and the two
 * shapes are symmetric - so the player goes in as the one being asked and the
 * student as the one asking, and the house rule about who may read what falls
 * out of it without a second table.
 *
 * The ability gate is applied ON TOP, because the forward read has no mastery
 * column to consult: an `NpcRecord` carries none, and the player does.
 */
export function whatYouCouldPassTo(
    teacher: {
        id: string;
        name: string;
        ordinal: number;
        factionId: string | null;
        holds: readonly string[];
        masteryOf: (techniqueId: string) => number | null;
    },
    student: { name: string; ordinal: number; factionId: string | null; holds: readonly string[] }
): { id: string; name: string; cap: number | null }[] {
    return whatTheyWouldTeachYou(
        {
            id: teacher.id,
            name: teacher.name,
            ordinal: teacher.ordinal,
            factionId: teacher.factionId,
            holds: teacher.holds
        },
        {
            name: student.name,
            ordinal: student.ordinal,
            factionId: student.factionId,
            holds: student.holds
        }
    ).filter(art => couldWriteOutACopy(
        { realmOrdinal: teacher.ordinal, masteryOfIt: teacher.masteryOf(art.id) }, art.id
    ));
}

/**
 * How far the owning house gets on the ladder of knowing, from who was standing
 * there when the art left.
 *
 * One copy of this loop, read by both ways an art can go out - a copy sold at a
 * counter and an art walked into somebody over a season. It was written for the
 * first and is not a fact about counters: what it reads is what each person
 * standing here could have made of what they watched, which is the same
 * question either way.
 */
export function whoHereCouldSayWhoseItWas(
    here: readonly NpcRecord[],
    ownerFactionId: string | null,
    techniqueId: string
): { stage: KnowingStage; sawIt: number } {
    if (!ownerFactionId) return { stage: 'unaware', sawIt: 0 };
    let stage: KnowingStage = 'unaware';
    let sawIt = 0;
    for (const npc of here) {
        // Their reference for the house that owns it, off the roster and
        // nothing else: one of theirs was taught out of this book, somebody who
        // practises the art has held a copy, and everybody else has never been
        // in the room. `whatTheirReferenceAffords` is the calibration and it is
        // not restated here.
        const reference: KnowingStage =
            npc.factionId === ownerFactionId ? 'known'
                : (npc.cultivation.techniqueIds ?? []).includes(techniqueId)
                    ? 'encountered'
                    : 'unaware';
        const reached = theStageAWitnessReaches(whatTheirReferenceAffords(reference));
        if (reached !== 'unaware') sawIt++;
        stage = highestStage(stage, reached);
    }
    return { stage, sawIt };
}

/** Why this particular student cannot take this particular art. */
function whyItWillNotGoIn(
    student: NpcRecord,
    art: { id: string; name: string; element: string | null; requiredOrdinal: number }
): { headline: string; prose: string; structure: string } | null {
    if (student.cultivation.techniqueIds.includes(art.id)) {
        return {
            headline: `${student.name} already has ${art.name}.`,
            prose:
                'They let you get a few sentences in before they say so. Whatever else is '
                + 'worth doing here, it is not walking them down a road they have already '
                + 'walked.',
            structure:
                `teach: ${art.id} is already on ${student.id}'s row. Refused before the span, `
                + 'so no day was spent.'
        };
    }
    if (!suitsRoot(student.cultivation.spiritRoot, art.element)) {
        return {
            headline: `${art.name} fights what ${student.name} was born with.`,
            prose:
                `The art is of ${art.element}, and their root will not take it. You could put `
                + 'the whole of it in front of them and what they would get out of it is torn '
                + 'meridians. A road is walked by the body that has it, and theirs is not this '
                + 'one.',
            structure:
                `teach: suitsRoot refused ${art.element} against ${student.cultivation.spiritRoot}. `
                + 'Refused before the span, so no day was spent.'
        };
    }
    if (art.requiredOrdinal > student.cultivation.realmOrdinal) {
        return {
            headline: `${student.name} cannot open ${art.name} yet.`,
            prose:
                `It wants somebody standing at ${rankName(art.requiredOrdinal)} and they are at `
                + `${rankName(student.cultivation.realmOrdinal)}. What you would be handing over `
                + 'is a description of something they cannot do. The bar is the art\'s own and '
                + 'no amount of patience at their elbow lifts it.',
            structure:
                `teach: requiredOrdinal ${art.requiredOrdinal} against `
                + `${student.cultivation.realmOrdinal}. Refused before the span, so no day was `
                + 'spent.'
        };
    }
    return null;
}

/** What the four rungs read like, said from the side handing it over. */
function whatItCostsYouToHandItOver(
    rung: 0 | 1 | 2 | 3,
    studentName: string,
    owner: string | null
): string {
    switch (rung) {
        case 0:
            return 'Nobody owns it. Enough houses hand it out that none of them can call it '
                + 'theirs, and what you are spending is your months and nothing else.';
        case 1:
            return `It is ${owner ?? 'somebody'}'s art and you are not theirs. That makes this `
                + 'awkward rather than fatal, for as long as nobody who can recognise it on '
                + `sight watches ${studentName} practise.`;
        case 2:
            return `It is ${owner ?? 'your house'}'s working manual and you are one of theirs. A `
                + 'shelf is what a house has instead of a wall, and handing a piece of it to '
                + 'somebody outside is the thing a house never forgives.';
        case 3:
            return `It is the top of ${owner ?? 'their house'}'s shelf. Once it is out it is out, `
                + 'and nothing afterwards puts it back.';
    }
}

export const teachingVerbs = {
    /**
     * Hand an art on to somebody standing here.
     *
     * Refuses wherever the act is incoherent, and each refusal names the fact
     * that would change the answer. Where it is coherent the months are spent,
     * the art goes onto the student's world row, the favour is opened, and a
     * house whose art it was answers through the same path a sold copy goes
     * down.
     */
    async teachSomebody(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        named: string | undefined,
        namedArt: string | undefined
    ): Promise<Execution> {
        this.atHand = this.atHand ?? await this.loadWorld();
        const world = this.atHand;

        // ── WHAT THIS CULTIVATOR COULD HAND ANYBODY ──────────────────────
        //
        // Read before the student is resolved, so somebody carrying nothing
        // gets the answer that is actually about them rather than a complaint
        // about who they pointed at.
        const held = this.repos.techniques.listKnown(cultivator.id);
        if (held.length === 0) {
            return refused('teach.holdsNothing', 'teach', factsForRefusal(
                'You have nothing to pass on.',
                'You open your mouth to start and there is no road behind it. Nobody has ever '
                + 'sat you down with a method, and what you have been doing you have been doing '
                + 'by yourself. Teaching needs something to teach.',
                `teach: cultivator_techniques holds 0 rows for ${cultivator.id}. Refused before `
                + 'the span, so no day was spent.'
            ));
        }

        const wanted = (named ?? '').trim();
        const here = this.present(cultivator).filter(row => row.id !== cultivator.id);
        // A POINTED FINGER RESOLVES THE WAY IT DOES FOR EVERY OTHER VERB.
        // "her" is what these sentences actually carry, and `somebodyAtHand` is
        // what `attack` and `guard` already put a pointer through.
        const pointedAt = wanted.length >= 2 ? this.somebodyAtHand(wanted, cultivator) : null;
        const studentRow = wanted.length < 2
            ? undefined
            : (pointedAt && pointedAt.id !== cultivator.id
                ? here.find(row => row.id === pointedAt.id)
                : undefined)
              ?? here.find(row => row.name.toLowerCase().includes(wanted.toLowerCase()));
        if (!studentRow) {
            return refused('teach.whoIsHere', 'teach', factsForRefusal(
                wanted.length >= 2 ? `${wanted} is not standing here.` : 'You did not say who.',
                here.length > 0
                    ? 'An art is handed over in the same room as the person taking it. Here with '
                      + `you: ${here.slice(0, 8).map(row => row.name).join(', ')}.`
                    : 'An art is handed over in the same room as the person taking it, and there '
                      + 'is nobody here to hand one to.',
                `teach: ${here.length} row(s) at ${cultivator.location ?? 'nowhere'}, none `
                + `matching "${wanted.slice(0, 40)}". Nothing spent.`
            ));
        }

        const student = world?.npcs.find(row => row.id === studentRow.id) ?? null;
        if (!world || !student) {
            // The art has to land on a row the world holds. A stored-only entry
            // has no `techniqueIds`, so writing it there would be writing it
            // nowhere - and inventing a second place for an art to live is the
            // one-fact-one-home rule broken on purpose.
            return refused('teach.notAWorldRecord', 'teach', factsForRefusal(
                `You cannot teach ${studentRow.name} anything.`,
                'What somebody carries is written down against the person they are in the world, '
                + 'and there is no such record for them. Nothing you showed them would stay '
                + 'anywhere.',
                'teach: student has no `NpcRecord`. Nothing spent.'
            ));
        }

        // ── WHICH ART ────────────────────────────────────────────────────
        const mine = this.repos.sects.getMembership(cultivator.id);
        const myHouse = mine?.sectId ?? cultivator.sectId ?? null;
        const masteryOf = (id: string): number | null =>
            this.repos.techniques.getKnown(cultivator.id, id)?.mastery ?? null;
        const couldPass = whatYouCouldPassTo(
            {
                id: cultivator.id,
                name: cultivator.name,
                ordinal: cultivator.realmOrdinal,
                factionId: myHouse,
                holds: held.map(row => row.id),
                masteryOf
            },
            {
                name: student.name,
                ordinal: student.cultivation.realmOrdinal,
                factionId: student.factionId,
                holds: student.cultivation.techniqueIds
            }
        );

        const askedFor = (namedArt ?? '').trim();
        const resolved = askedFor.length >= 2
            ? resolveTechnique(this.repos, askedFor, cultivator.id)
            : null;
        let chosen = resolved && held.some(row => row.id === resolved.id) ? resolved.id : null;

        if (!chosen && askedFor.length >= 2 && resolved) {
            return refused('teach.notHeld', 'teach', factsForRefusal(
                `You have never been taught ${resolved.name}.`,
                'You know the name and that is the whole of what you have of it. Nobody hands on '
                + 'a road they have not walked.',
                `teach: no cultivator_techniques row for ${cultivator.id} x ${resolved.id}. `
                + 'Nothing spent.'
            ));
        }

        if (!chosen) {
            if (couldPass.length === 0) {
                // THE TWO HONEST REFUSALS THAT ARE NOT THE BLANK LOOK, and they
                // are different events: holding arts none of which you hold
                // WELL ENOUGH is not the same as holding arts they already have.
                const short = held
                    .filter(row => !student.cultivation.techniqueIds.includes(row.id))
                    .filter(row => !couldWriteOutACopy(
                        { realmOrdinal: cultivator.realmOrdinal, masteryOfIt: row.mastery },
                        row.id
                    ));
                if (short.length > 0) {
                    const worst = short.sort((a, b) => b.mastery - a.mastery)[0];
                    const bar = masteryBarFor(worst.id);
                    return refused('world.couldWriteOutACopy', 'teach', factsForRefusal(
                        `You do not hold ${worst.name} well enough to pass it on.`,
                        `You are ${(worst.mastery * 100).toFixed(0)} parts in a hundred of `
                        + `${worst.name}, and the parts are what would go in. Somebody taught `
                        + 'out of your gaps carries them for the rest of their climb, which is '
                        + 'worse than being '
                        + 'taught nothing. Take it to the end first.',
                        `teach: couldWriteOutACopy refused ${worst.id} at mastery `
                        + `${worst.mastery.toFixed(2)} against ${FULLY_MASTERED}`
                        + `${bar === null ? '' : `, or the ordinal bar of ${bar}`}. Nothing spent.`
                    ));
                }
                return refused('teach.nothingTheyWant', 'teach', factsForRefusal(
                    `${student.name} has nothing to learn from you.`,
                    'They hear you out. Everything you could put in front of them they are '
                    + 'already carrying, or it is not yours to volunteer to somebody standing '
                    + 'where they stand.',
                    `teach: ${held.length} art(s) held, none of them passable to ${student.id}. `
                    + `whatTheyCouldTeach saw ${whatTheyCouldTeach(
                        {
                            id: cultivator.id,
                            name: cultivator.name,
                            ordinal: cultivator.realmOrdinal,
                            factionId: myHouse,
                            holds: held.map(row => row.id)
                        },
                        {
                            name: student.name,
                            ordinal: student.cultivation.realmOrdinal,
                            factionId: student.factionId,
                            holds: student.cultivation.techniqueIds
                        }
                    ).length} new to them. Nothing spent.`
                ));
            }
            // One candidate is not a choice. Several is a real question, and
            // guessing would spend months on a road the player did not name -
            // which is the same ruling `costOfTeaching` makes in the other
            // direction, and it is put back as a question there too.
            if (couldPass.length > 1) {
                return refused('teach.whichArt', 'teach', factsForRefusal(
                    `${student.name} wants to know which.`,
                    `You could walk them down any of these: `
                    + `${couldPass.slice(0, 4).map(art => art.name).join(', ')}. They are not `
                    + 'the same road and they do not cost the same months. Say which one.',
                    `teach: ${couldPass.length} arts could be passed to ${student.id} and the `
                    + `sentence named none: ${couldPass.map(art => art.id).join(', ')}. `
                    + 'Nothing spent.'
                ));
            }
            chosen = couldPass[0].id;
        }

        const row = getTechnique(chosen) as {
            id: string; name: string; element?: string | null;
            requiredOrdinal?: number; cap?: number | null;
        } | undefined;
        if (!row) {
            return refused('teach.noSuchArt', 'teach', factsForRefusal(
                'No art by that name.',
                'The name goes nowhere. It is not a method anybody was ever taught.',
                `teach: ${chosen} is not a row in the technique catalog. Nothing spent.`
            ));
        }
        const art = {
            id: row.id,
            name: row.name,
            element: row.element ?? null,
            requiredOrdinal: Number(row.requiredOrdinal ?? 0)
        };

        // ── CAN YOU ──────────────────────────────────────────────────────
        const known = this.repos.techniques.getKnown(cultivator.id, art.id);
        if (!known) {
            return refused('teach.notHeld', 'teach', factsForRefusal(
                `You have never been taught ${art.name}.`,
                'You know the name and that is the whole of what you have of it. Nobody hands on '
                + 'a road they have not walked.',
                `teach: no cultivator_techniques row for ${cultivator.id} x ${art.id}. Nothing `
                + 'spent.'
            ));
        }
        if (!couldWriteOutACopy(
            { realmOrdinal: cultivator.realmOrdinal, masteryOfIt: known.mastery }, art.id
        )) {
            const bar = masteryBarFor(art.id);
            return refused('world.couldWriteOutACopy', 'teach', factsForRefusal(
                `You do not hold ${art.name} well enough to pass it on.`,
                `You are ${(known.mastery * 100).toFixed(0)} parts in a hundred of ${art.name}, `
                + 'and the parts are what would go in. Somebody taught out of your gaps carries '
                + 'them for the rest of their climb, which is worse than being taught nothing. '
                + 'Take it to '
                + 'the end first.',
                `teach: couldWriteOutACopy refused ${art.id} at mastery `
                + `${known.mastery.toFixed(2)} against ${FULLY_MASTERED}`
                + `${bar === null ? '' : `, or the ordinal bar of ${bar}`}. Nothing spent.`
            ));
        }

        // ── CAN THEY ─────────────────────────────────────────────────────
        const willNot = whyItWillNotGoIn(student, art);
        if (willNot) {
            return refused('teach.theyCannotTakeIt', 'teach', factsForRefusal(
                willNot.headline, willNot.prose, willNot.structure
            ));
        }

        // ── WHOSE IT WAS ─────────────────────────────────────────────────
        const owners = whoseArt(art.id);
        const ownerFactionId = myHouse && owners.includes(myHouse) ? myHouse : owners[0] ?? null;
        const rung = betrayalOfSelling({ factionId: myHouse }, art.id, ownerFactionId);
        const ownerName = ownerFactionId ? getSect(ownerFactionId)?.name ?? ownerFactionId : null;

        // ── THE MONTHS ───────────────────────────────────────────────────
        //
        // The same figure `sellACopyOfAnArt` spends, for the same reason: what
        // is being handed over is the whole art, and the work in it is counted
        // by the realm sections it covers rather than by how it leaves the hand.
        const carries = Number(row.cap ?? art.requiredOrdinal);
        const months = monthsToCopy(art.requiredOrdinal, carries);
        const days = Math.max(1, Math.round(months * (DAYS_PER_YEAR / 12)));

        const today = Math.floor(world.currentDay);
        const onDay = Math.floor(run.elapsedDays);
        const others = here.filter(other => other.id !== student.id).length;
        const inTheSquare = new Set(here.map(other => other.id));
        const watching = whoHereCouldSayWhoseItWas(
            world.npcs.filter(npc => inTheSquare.has(npc.id)), ownerFactionId, art.id
        );

        const spent = await this.shortSkip(
            run, cultivator, ambient, TRAVEL_FOCUS, `Teaching ${student.name} ${art.name}`, days
        );

        // ── A SEASON CUT SHORT IS NOT A SEASON ───────────────────────────
        //
        // `shortSkip` returns control early when something interrupts - the
        // food ran out, somebody walked in - and the days it actually lived are
        // its own answer rather than this file's. What goes onto the student is
        // the whole road or nothing, which is the same reason the mastery bar
        // is where it is, so a lesson that stopped halfway leaves them with
        // nothing and the player with the days gone.
        const lived = spent.timeSkip?.simulatedDays ?? days;
        if (lived < days) {
            const facts = factsForToolResult(
                `The lesson stopped before ${art.name} was in.`,
                [
                    `${months} month${months === 1 ? '' : 's'} was what it would have taken and `
                    + `${lived} day${lived === 1 ? '' : 's'} is what you got. A road goes in whole `
                    + `or not at all, so ${student.name} is carrying nothing of it.`,
                    ...spent.facts.lines
                ]
            );
            facts.structure.push(
                `teach: shortSkip returned at ${lived} of ${days} day(s). ${art.id} was NOT `
                + `written to ${student.id}; no deed, no favour.`
            );
            return {
                facts,
                events: spent.events,
                timeSkip: spent.timeSkip,
                breakthrough: null,
                outcome: 'executed',
                calls: [
                    {
                        name: 'world.monthsToCopy',
                        action: 'teach',
                        summary:
                            `${months} month(s) asked of it and ${lived} day(s) lived. Nothing `
                            + 'was written onto the student.',
                        ok: false
                    },
                    ...spent.calls
                ]
            };
        }

        // ── AND THE ART IS ON THEM ───────────────────────────────────────
        const at = world.npcs.findIndex(npc => npc.id === student.id);
        world.npcs[at] = {
            ...student,
            cultivation: {
                ...student.cultivation,
                techniqueIds: [...student.cultivation.techniqueIds, art.id]
            }
        };
        this.theWorldMoved();

        const calls: ToolCallRecord[] = [
            {
                name: 'world.couldWriteOutACopy',
                action: 'teach',
                summary:
                    `${art.name} at mastery ${known.mastery.toFixed(2)} clears the bar a master `
                    + 'has to clear to put an art in somebody else\'s hands, which is the same '
                    + 'bar `canReproduce` holds every teacher in the world to.',
                ok: true
            },
            {
                name: 'world.monthsToCopy',
                action: 'teach',
                summary:
                    `${months} month(s) at their elbow, off the realm sections ${art.name} covers `
                    + `(${art.requiredOrdinal} -> ${carries}). ${days} day(s) spent.`,
                ok: true
            },
            {
                name: 'npc.techniqueIds',
                action: 'teach',
                summary:
                    `${art.id} is on ${student.name}'s row now. What they carry is written in one `
                    + 'place and this is it.',
                ok: true
            },
            ...spent.calls
        ];

        // ── WHAT IT BUYS ─────────────────────────────────────────────────
        //
        // `whatADeedLeaves` prices it through `aDeedEntersTheWorld`, at
        // `paidBy: 'actor'` - the direction that makes it a kindness and opens a
        // favour on the teacher's side. The cost is the share of a life the
        // months are, which is what was actually given up.
        const deed = aDeedEntersTheWorld(world, {
            kind: 'debt_incurred',
            day: today,
            locationId: student.locationId,
            place: cultivator.location ?? 'nowhere anybody has named',
            actors: [
                { id: cultivator.id, name: cultivator.name, role: 'taught it' },
                { id: student.id, name: student.name, role: 'was taught' }
            ],
            factionIds: student.factionId ? [student.factionId] : [],
            summary:
                `${cultivator.name} walked ${student.name} down ${art.name} over `
                + `${months} month${months === 1 ? '' : 's'}.`,
            unattributed:
                'Somebody came out of a season carrying a method they did not have going in, and '
                + 'would not say who put it there.',
            price: {
                deed: {
                    cause: 'taught_technique',
                    paidBy: 'actor',
                    cost: Math.min(1, days / DAYS_PER_YEAR),
                    // A road handed over does not come back. This is the one
                    // fact separating a taught art from a lent object, and
                    // `manuals.md` states it: once it is out it is out.
                    irreversible: true,
                    onDay,
                    description:
                        `${cultivator.name} taught ${student.name} ${art.name}, which they now `
                        + 'carry for the rest of their climb.',
                    witnesses: others,
                    participants: [student.id]
                },
                actor: {
                    id: cultivator.id,
                    name: cultivator.name,
                    houseId: myHouse,
                    houseName: null,
                    alignment: null,
                    ranked: (mine?.rankIndex ?? 0) > 0
                },
                subject: {
                    id: student.id,
                    name: student.name,
                    houseId: student.factionId,
                    houseName: null,
                    alignment: null,
                    ranked: student.factionRankIndex > 0
                }
            },
            data: { techniqueId: art.id, months, rung }
        });

        if (deed) {
            calls.push({
                name: 'world.aDeedEntersTheWorld',
                action: 'teach',
                summary:
                    `${deed.fact.id} (debt_incurred, ${deed.weight}, magnitude `
                    + `${deed.fact.magnitude.toFixed(2)}) priced by whatADeedLeaves; it reached `
                    + `${deed.leaves?.reached}.`,
                ok: true
            });
            for (const opens of deed.leaves?.opens ?? []) {
                const record = createObligation({ ...opens, triggeringEventId: deed.fact.id });
                writeOneObligation(this.db as unknown as DatabaseHandle, record);
                calls.push({
                    name: 'social.createObligation',
                    action: 'teach',
                    summary:
                        `${record.id}: ${record.holderId} holds a ${record.severity} `
                        + `${record.kind} about ${record.subjectId} for ${record.cause}, off `
                        + `${deed.fact.id}.`,
                    ok: true
                });
            }
        }

        const reach = carriesTo(cultivator.realmOrdinal, art.id);
        const facts = factsForToolResult(
            `${student.name} carries ${art.name} now.`,
            [
                `${months} month${months === 1 ? '' : 's'} at their elbow, and it went in. It is `
                + 'on them for as long as they keep climbing on it.',
                whatItCostsYouToHandItOver(rung, student.name, ownerName),
                reach === null
                    ? 'The art states no teachable end.'
                    : reach > student.cultivation.realmOrdinal
                        ? `You have stood at ${rankName(reach)} on it, which is as far as you `
                          + 'could take them.'
                        : 'You have not stood any further up it than they are now, so what they '
                          + 'have is the art and not a road past where they already were.',
                ...spent.facts.lines
            ]
        );
        facts.structure.push(
            `teach: student=${student.id} at ordinal ${student.cultivation.realmOrdinal}; `
            + `${art.id} at teacher mastery ${known.mastery.toFixed(2)}; monthsToCopy `
            + `${art.requiredOrdinal} -> ${carries} is ${months} month(s), ${days} day(s); `
            + `betrayalOfSelling rung ${rung}`
            + (ownerFactionId ? ` against ${ownerFactionId}` : ', nobody\'s property')
            + `. ${noHouseCanCallItTheirs(art.id)
                ? 'Held widely enough that no house can call it theirs.'
                : ownerFactionId && manualsOf(ownerFactionId).at(-1)?.id === art.id
                    ? 'It sits at the top of that shelf.'
                    : 'One house on record owns it.'}`
        );

        // ── AND THE HOUSE WHOSE ART IT WAS ANSWERS ───────────────────────
        //
        // The identical path a sold copy goes down. `manuals.md` is explicit
        // that what a house loses is the art being OUT, and it does not become
        // less out because it left through somebody's mouth.
        const answered = ownerFactionId
            ? this.whatTheHouseDidAboutTheLeak({
                run,
                cultivator,
                art: { id: art.id, name: art.name },
                rung,
                ownerFactionId,
                mine: myHouse,
                howItLeft: `taught ${art.name} to ${student.name}`,
                // WHO ELSE WAS IN THE SQUARE, read the same way a sold copy
                // reads it. The student is left in: they are the one person who
                // certainly watched, and whether their reference is worth
                // anything is `whatTheirReferenceAffords`'s answer rather than
                // this file's.
                houseStage: watching.stage,
                witnesses: Math.max(others, watching.sawIt),
                facts
            })
            : [];

        return {
            facts,
            events: spent.events,
            timeSkip: spent.timeSkip,
            breakthrough: null,
            outcome: 'executed',
            calls: [...calls, ...answered]
        };
    }
};
