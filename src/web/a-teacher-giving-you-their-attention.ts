/**
 * Somebody giving their attention to the people in front of them, and what each of them gets.
 *
 * ONE MECHANIC, ruled by the design owner. Guidance is attention and not
 * presence: a master standing beside you ignoring you teaches you nothing, and
 * somebody who is actually at it is spending their own days on it. The world
 * already records that as a fact - an activity of kind `teaching` with the
 * student among `withIds` - and `guideFor` in `turn-engine.ts` reads exactly
 * that and nothing else. Everything in this file is how people get into that
 * set and what it costs the person at the front of it:
 *
 *   asked for it   a `request` of kind `guidance`, priced and rolled where
 *                  every request is. A master may say no: what makes their yes
 *                  likelier is the tie the resolver already weighs, and what
 *                  they are already doing can decline it before anything rolls.
 *   taught an art  the same attention for `yearsToWriteOutACopy`, the span
 *                  `teaching-somebody-what-you-hold.ts` spends from the other
 *                  side and argues for in its own header.
 *   sat in on it   somebody already teaching where you stand. No asking and no
 *                  price. Being in the room is the whole of the gate, and
 *                  getting into the room is the business of whatever verb got
 *                  you there.
 *   given it       the player at the front of the room.
 *
 * A lesson to one person, a master with three disciples in front of him and a
 * talk to a hall are the same row with a different number of ids in it. Whether
 * a set is open or closed is not stored anywhere: it is who can reach the room
 * it is happening in, which is what the access chain and the gate already say.
 *
 * ── ATTENTION DIVIDES ────────────────────────────────────────────────────
 *
 * `guidanceMultiplier` is the one rate. A teacher in front of several people is
 * worth less to each of them than a teacher in front of one, and the thinning is
 * one figure, `ATTENTION_THINS_AS` in the rate's own file. `rateTermsFor` hands the
 * rate the teacher's rung and the size of the set, and the rate does the thinning.
 *
 * ── WHAT IT COSTS THEM ───────────────────────────────────────────────────
 *
 * Their days. `NpcRecord` carries no store of energy or stamina - `hp` is the
 * body and `spiritStones` the purse, and a lesson spends neither - so what is
 * charged is the span, stated, with the teacher at the front of a room and not
 * at their own practice for all of it. What those days cost their own climb is
 * the world's rule to read off the same `teaching` activity, and is not
 * restated here.
 */

import { DAYS_PER_YEAR, guidanceMultiplier, shareOfAttention } from '../engine/cultivation/cultivation.js';
import { isTeachingSomebody } from '../engine/world/an-npc-striking-at-the-next-wall.js';
import { rankName } from '../engine/cultivation/realms.js';
import { setLocation, type NpcActivity, type NpcRecord } from '../engine/world/npc-state.js';
import { whatThatLooksLike, whetherTheyWouldLookUp } from '../engine/world/what-somebody-is-at-when-you-walk-up.js';
import { yearsToWriteOutACopy } from '../engine/world/manuals.js';
import { getTechnique } from '../data/cultivation/techniques.js';
import {
    CONTRIBUTION_BASE,
    CONTRIBUTION_PER_ORDINAL,
    ORDINARY_DUTY_DAYS
} from '../engine/encounters/duties.js';
import type { AmbientQi, Cultivator, Run } from '../schema/cultivation.js';
import {
    handleLearn,
    whyThisArtWillNotGoIn
} from '../server/consolidated/technique-manage.js';
import { isGuidingErrorBody } from '../server/consolidated/cultivation-support.js';
import { factsForRefusal, placeName } from './facts.js';
import { refused } from './tool-result-prose.js';
import { SHORT_ACTION_DAYS, TRAVEL_FOCUS } from './turn-constants.js';
import type { Execution, ToolCallRecord } from './turn-wire-shapes.js';
import type { GameService } from './turn-engine.js';
import { whoHoldsTheGround } from '../engine/world/ground-holder.js';
import { guestPlaceHeldBy } from '../server/consolidated/sect-guest.js';
import { whatYouAreNotShowing } from './what-you-are-not-showing.js';
import { whatTheyCanPlaceAbout } from '../engine/social/what-they-can-place-about-you.js';
import { noticesThatTheyAreThere } from '../engine/social/presence-recognition.js';
import {
    severityOfTheWrong,
    shapeOf
} from '../engine/social-leverage/what-somebody-does-about-being-wronged.js';
import { createObligation } from '../engine/social/grudges.js';
import { writeOneObligation } from '../storage/repos/obligation.repo.js';
import { whatTheRoomDecides } from '../engine/social-leverage/what-a-room-decides-about-one-of-its-own.js';
import { whatAFineComesTo } from './a-room-hands-down-what-it-decided.js';
import { aDeedEntersTheWorld } from '../engine/world/a-deed-enters-the-world-as-a-fact.js';
import { openLedgerBetween, tieFrom, type DatabaseHandle } from './encounters.js';
import { wearsTheRobesOf } from '../engine/world/a-recruit-is-given-their-plate-at-the-house.js';
import { A_ROLL_A_PLAYER_COULD_KNOW } from '../engine/world/a-house-raises-its-own.js';
import { pathTo, purposeOf } from '../engine/world/architecture.js';
import { theGroundUnderYou } from '../engine/social-leverage/ground-trust.js';
import { statusesInArea } from '../engine/world/what-is-true-of-a-place-right-now.js';
import { whetherYouAreWorthTheTrouble } from '../engine/social-leverage/what-a-house-does-when-it-catches-you.js';
import { whoAnsweredTheShout, type CouldBeCalled } from '../engine/cultivation/unfinished-fight.js';
import { assessPower, type CombatantInput } from '../engine/cultivation/combat.js';
import {
    combatantFromCultivator,
    combatantFromOpponent
} from '../server/consolidated/combat-manage.js';
import { houseStanding } from '../engine/encounters/what-a-house-asks-of-somebody-it-cannot-order.js';
import type { WorldState } from '../engine/world/world-state.js';

/**
 * The two labels `teach` dispatches on beside handing an art on: sitting in on
 * whoever is already teaching the room, and standing at the front of it.
 */
export const TEACH_INTENTS = ['listen', 'lecture'] as const;

// ─────────────────────────────────────────────────────────────────────────
// WHAT ONE PERSON'S ATTENTION IS WORTH, SPREAD OVER SEVERAL
// ─────────────────────────────────────────────────────────────────────────

/**
 * Whether a person is giving attention to somebody named, still in its term.
 *
 * The world's own answer (`isTeachingSomebody`), so the player and the world's
 * people are read by one rule about when a term ends and about a `teaching`
 * activity with nobody named in it, which is not attention given to anybody.
 */
export function isTeachingToday(npc: Pick<NpcRecord, 'activity' | 'status'>, today: number): boolean {
    return isTeachingSomebody(npc, today);
}

/** Who a person is teaching today, or nobody. */
export function whoTheyAreTeaching(npc: Pick<NpcRecord, 'activity' | 'status'>, today: number): string[] {
    return isTeachingToday(npc, today) ? [...npc.activity!.withIds] : [];
}

/**
 * What a person is in the middle of that they would not put down to teach, and
 * the day it ends where it has one.
 *
 * ONE READ OF THEIR ACTIVITY, ruled by the design owner: a master may not say
 * yes, and the reasons are what they are already doing - their own cultivation,
 * sitting with a dao, a fight, open channels, a party somewhere else. There is no
 * list of excuses here. The split is `whetherTheyWouldLookUp`, the world's own
 * answer to which kinds face out of a room and which are turned away from it,
 * and it is the only per-kind judgement read: somebody talking, idle, at a
 * counter or at the work of their rank looks up, and whether they agree is the
 * ordinary weight of the ask. Somebody already teaching looks up too, because a
 * master with disciples in front of him takes one more.
 *
 * A party the student is out with is not somewhere else.
 */
export function whatTheyCannotPutDown(
    npc: Pick<NpcRecord, 'activity'>,
    studentId: string,
    today: number
): { doing: NpcActivity; freeInDays: number | null } | null {
    const doing = npc.activity;
    if (!doing) return null;
    if (doing.untilDay !== null && doing.untilDay !== undefined && doing.untilDay < today) return null;
    if (whetherTheyWouldLookUp(doing.kind)) return null;
    if (doing.kind === 'out_with_a_party' && doing.withIds.includes(studentId)) return null;
    return {
        doing,
        freeInDays: doing.untilDay === null || doing.untilDay === undefined
            ? null
            : Math.max(1, doing.untilDay - today)
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE ROW, WRITTEN AND TAKEN BACK
// ─────────────────────────────────────────────────────────────────────────

/** What a teacher was at before, so the end of a lesson can put it back. */
interface WhatTheyWereAt {
    teacherId: string;
    /** Their activity before this lesson touched it, whole. */
    previous: NpcActivity | null;
    /** Whether they were already teaching somebody, and this lesson joined it. */
    joined: boolean;
    /** Whoever this lesson added, and nobody else. */
    added: readonly string[];
}

function unique(ids: readonly string[]): string[] {
    return [...new Set(ids)];
}

export const attentionVerbs = {
    /**
     * Put these people in front of this teacher until `untilDay`.
     *
     * Joins a set already there rather than replacing it, because a master with
     * disciples in front of him does not send them away to take one more. Every
     * NPC already in the set is told about the newcomer, since `withIds` is
     * symmetric by construction. The player's own row is not written: the
     * symmetry stops at it on purpose, see `who-is-on-the-road-with-you.ts`.
     */
    theyGiveTheirAttention(
        this: GameService,
        teacherId: string,
        studentIds: readonly string[],
        forDays: number,
        note: string
    ): (WhatTheyWereAt & { listeners: number; sinceDay: number; untilDay: number }) | null {
        const world = this.atHand;
        if (!world) return null;
        const at = world.npcs.findIndex(npc => npc.id === teacherId);
        if (at < 0) return null;
        const teacher = world.npcs[at]!;
        const today = Math.floor(world.currentDay);
        const joined = isTeachingToday(teacher, today);
        const already = whoTheyAreTeaching(teacher, today);
        const added = studentIds.filter(id => !already.includes(id));
        const set = unique([...already, ...studentIds]);
        const until = today + Math.max(1, Math.trunc(forDays));
        const was = teacher.activity;

        world.npcs[at] = {
            ...teacher,
            activity: {
                kind: 'teaching',
                note: joined && was ? was.note : note,
                withIds: set,
                sinceDay: joined && was ? was.sinceDay : today,
                untilDay: joined && was?.untilDay !== null && was?.untilDay !== undefined
                    ? Math.max(until, was.untilDay)
                    : until,
                returnTo: null
            }
        };
        for (let i = 0; i < world.npcs.length; i++) {
            const npc = world.npcs[i]!;
            if (npc.id === teacherId || !set.includes(npc.id)) continue;
            const doing = npc.activity;
            if (!doing || doing.kind !== 'teaching' || !doing.withIds.includes(teacherId)) continue;
            world.npcs[i] = {
                ...npc,
                activity: { ...doing, withIds: unique([...doing.withIds, ...added]) }
            };
        }
        this.theWorldMoved();
        return {
            teacherId,
            previous: was,
            joined,
            added,
            listeners: set.length,
            sinceDay: today,
            untilDay: until
        };
    },

    /**
     * The lesson is over for the people it added.
     *
     * Only what this lesson wrote is taken back. Anybody who was already in
     * front of the teacher stays there; a teacher whose set is empty afterwards
     * goes back to whatever they were at before, and a teacher the world has
     * since moved on to something else is left where the world put them.
     */
    theirAttentionEnds(this: GameService, was: WhatTheyWereAt): void {
        const world = this.atHand;
        if (!world) return;
        const at = world.npcs.findIndex(npc => npc.id === was.teacherId);
        if (at < 0) return;
        const teacher = world.npcs[at]!;
        const doing = teacher.activity;
        if (doing && doing.kind === 'teaching') {
            const remaining = doing.withIds.filter(id => !was.added.includes(id));
            world.npcs[at] = {
                ...teacher,
                activity: !was.joined || was.previous === null
                    ? was.previous
                    : { ...doing, withIds: remaining, untilDay: was.previous.untilDay ?? null }
            };
        }
        for (let i = 0; i < world.npcs.length; i++) {
            const npc = world.npcs[i]!;
            const theirs = npc.activity;
            if (!theirs || theirs.kind !== 'teaching' || !theirs.withIds.includes(was.teacherId)) continue;
            if (!theirs.withIds.some(id => was.added.includes(id))) continue;
            world.npcs[i] = {
                ...npc,
                activity: { ...theirs, withIds: theirs.withIds.filter(id => !was.added.includes(id)) }
            };
        }
        this.theWorldMoved();
    },

    /**
     * A span of cultivation under somebody's eye.
     *
     * The one runner for every way into the set. The attention is written, the
     * span is spent through `runSeclusion` - the cultivate path, so the rations,
     * the encounters, the deviations and a wall crossed in the middle are the
     * ordinary ones and `rateTermsFor` reads the teacher at the start - and the
     * attention ends when the span does, however it ended. An interruption ends
     * it too, because the span it was written for is over.
     */
    async aSpanUnderTheirEye(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        teacher: { id: string; name: string },
        days: number,
        how: string
    ): Promise<Execution> {
        this.atHand = this.atHand ?? await this.loadWorld();
        const row = this.atHand?.npcs.find(npc => npc.id === teacher.id) ?? null;
        const span = Math.max(1, Math.trunc(days));
        const given = row
            ? this.theyGiveTheirAttention(
                teacher.id, [cultivator.id], span,
                `watching ${cultivator.name} sit and correcting it`
            )
            : null;
        if (!row || !given) {
            return refused('attention.notAWorldRecord', 'request', factsForRefusal(
                `${teacher.name} has nowhere to put their attention.`,
                'Who somebody is teaching is written against the person they are in the world, and '
                + 'there is no such record for them. Nothing they did would stay anywhere.',
                `attention: no NpcRecord for ${teacher.id}. Nothing spent.`
            ));
        }

        const multiplier = guidanceMultiplier(
            cultivator.realmOrdinal, row.cultivation.realmOrdinal, given.listeners
        );

        let execution: Execution;
        try {
            execution = await this.runSeclusion(run, cultivator, ambient, span, {});
        } finally {
            this.theirAttentionEnds(given);
        }

        const lived = execution.timeSkip?.simulatedDays ?? 0;
        const others = given.listeners - 1;
        const line = lived <= 0
            ? `${teacher.name} was ready to watch you sit, and no sitting happened.`
            : `${teacher.name} spent ${lived} day${lived === 1 ? '' : 's'} at the front of `
              + `${others === 0 ? 'you' : `you and ${others} other${others === 1 ? '' : 's'}`} and `
              + 'not at their own practice.';
        execution.facts.lines.unshift(line);
        execution.facts.prose = `${line}\n\n${execution.facts.prose}`;
        execution.calls.unshift({
            name: 'world.theyGiveTheirAttention',
            action: 'request',
            summary:
                `${how}. ${teacher.name}, at ${rankName(row.cultivation.realmOrdinal)}, was written `
                + `teaching ${given.listeners} (this cultivator among them) from world day `
                + `${given.sinceDay} to ${given.untilDay}; ${lived} of ${span} day(s) were lived. `
                + `Worth x${multiplier.toFixed(3)} on the rate: guidanceMultiplier from `
                + `${rankName(row.cultivation.realmOrdinal)} over ${rankName(cultivator.realmOrdinal)}, `
                + `thinned to ${(shareOfAttention(given.listeners) * 100).toFixed(0)}% for `
                + `${given.listeners} in front of them. The attention ended with the span. Their row `
                + 'carries no energy store, so what it cost them is the days.',
            ok: lived > 0
        });
        return execution;
    },

    /**
     * Being walked down an art by somebody, over the months it takes.
     *
     * The same attention, and the same span the other direction spends - see
     * `teaching-somebody-what-you-hold.ts`, whose header says why it is
     * `yearsToWriteOutACopy` and why an art goes in whole or not at all. The
     * gates `handleLearn` holds are asked BEFORE the months, through
     * `whyThisArtWillNotGoIn`, so a refusal the engine could give on the first
     * day is not given at the end of a season.
     */
    async anArtFromThem(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        teacher: { id: string; name: string },
        techniqueId: string
    ): Promise<{ lines: string[]; calls: ToolCallRecord[]; span: Execution | null }> {
        const art = getTechnique(techniqueId);
        const name = art?.name ?? techniqueId;
        const gate = art
            ? whyThisArtWillNotGoIn(this.repos, run, cultivator, art, 'taught_by_a_person')
            : null;
        if (!art || (gate && isGuidingErrorBody(gate))) {
            const message = gate && isGuidingErrorBody(gate) ? gate.message : `No art ${techniqueId}.`;
            return {
                lines: [`They sit down with you, and it does not go in. ${message}`],
                calls: [{
                    name: 'technique_manage.learn',
                    action: 'request',
                    summary:
                        `${teacher.name} agreed and ${name} still did not go in: ${message} Asked `
                        + 'before the lesson, so no day of it was spent. Two gates, and this is the '
                        + 'second one - what a person will give you and what you can open are '
                        + 'different questions.',
                    ok: false
                }],
                span: null
            };
        }

        const years = yearsToWriteOutACopy(art.id) ?? 0;
        const days = Math.max(1, Math.round(years * DAYS_PER_YEAR));
        const months = Math.max(1, Math.round(years * 12));
        const howLong = months < 24 ? `${months} month${months === 1 ? '' : 's'}` : `${Math.round(years)} years`;

        this.atHand = this.atHand ?? await this.loadWorld();
        const given = this.theyGiveTheirAttention(
            teacher.id, [cultivator.id], days, `walking ${cultivator.name} down ${art.name}`
        );
        let spent: Execution;
        try {
            spent = await this.shortSkip(
                run, cultivator, ambient, TRAVEL_FOCUS, `Being taught ${art.name} by ${teacher.name}`, days
            );
        } finally {
            if (given) this.theirAttentionEnds(given);
        }

        const lived = spent.timeSkip?.simulatedDays ?? days;
        if (lived < days) {
            return {
                lines: [
                    `The lesson stopped before ${art.name} was in. ${howLong} was what it would have `
                    + `taken and ${lived} day${lived === 1 ? '' : 's'} is what you got. A road goes in `
                    + 'whole or not at all, so you are carrying nothing of it.'
                ],
                calls: [{
                    name: 'world.yearsToWriteOutACopy',
                    action: 'request',
                    summary:
                        `${howLong} asked of it and ${lived} day(s) lived at ${teacher.name}'s elbow. `
                        + `${art.id} was NOT written to the sheet.`,
                    ok: false
                }],
                span: spent
            };
        }

        const taught = await handleLearn({
            action: 'learn',
            techniqueId: art.id,
            cultivatorId: cultivator.id,
            provenance: 'taught_by_a_person'
        });
        if (isGuidingErrorBody(taught)) {
            return {
                lines: [`${howLong} at ${teacher.name}'s elbow, and it does not go in. ${taught.message}`],
                calls: [{
                    name: 'technique_manage.learn',
                    action: 'request',
                    summary: `${art.name} did not go in after the lesson: ${taught.message}`,
                    ok: false
                }],
                span: spent
            };
        }
        return {
            lines: [
                `${howLong} at ${teacher.name}'s elbow, and ${art.name} goes in. It is on you now, `
                + 'for as long as you keep climbing on it.'
            ],
            calls: [{
                name: 'technique_manage.learn',
                action: 'request',
                summary:
                    `${art.name} is on ${cultivator.name}'s sheet, recorded as taught by a person, `
                    + `after ${days} day(s) of ${teacher.name}'s attention off yearsToWriteOutACopy `
                    + `(${years.toFixed(2)} year(s)).`,
                ok: true
            }],
            span: spent
        };
    },

    /**
     * Sitting in on somebody who is already teaching where you stand.
     *
     * No asking and no price, ruled by the design owner. What gates it is that
     * you are standing in the room, and nothing else: a person outside is told
     * where they are standing, and a person who got in some other way sits down
     * like anybody.
     */
    async sitInOn(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        named: string | undefined,
        askedDays: number | undefined,
        rawInput?: string
    ): Promise<Execution> {
        this.atHand = this.atHand ?? await this.loadWorld();
        const world = this.atHand;
        const where = placeName(cultivator);
        if (!world) {
            return refused('attention.noWorld', 'teach', factsForRefusal(
                'Nobody here is teaching.',
                `You are at ${where}, and there is no world loaded to be teaching in it.`,
                'attention: the world is off, so no activity can be read. Nothing spent.'
            ));
        }
        const today = Math.floor(world.currentDay);
        const hereIds = new Set(this.present(cultivator).map(row => row.id));
        const teaching = world.npcs
            .filter(npc => hereIds.has(npc.id) && npc.status === 'alive')
            .filter(npc => isTeachingToday(npc, today))
            .sort((a, b) => b.cultivation.realmOrdinal - a.cultivation.realmOrdinal
                || (a.id < b.id ? -1 : 1));

        const wanted = (named ?? '').trim();
        const pointed = wanted.length >= 2 ? this.somebodyAtHand(wanted, cultivator) : null;
        const teacher = pointed
            ? teaching.find(npc => npc.id === pointed.id) ?? null
            : teaching[0] ?? null;

        if (!teacher) {
            if (pointed) {
                const npc = world.npcs.find(row => row.id === pointed.id);
                const doing = npc?.activity
                    ? whatThatLooksLike(npc.activity, npc.activity.withIds
                        .map(id => world.npcs.find(row => row.id === id)?.name)
                        .filter((n): n is string => !!n))
                    : null;
                return refused('attention.notTeaching', 'teach', factsForRefusal(
                    `${pointed.name} is not teaching anybody.`,
                    `${pointed.name} is ${doing ?? 'here and not at the front of anything'}. There `
                    + 'is no lesson to sit in on. Asking them to watch you is a different thing, and '
                    + 'it is asked of them.',
                    `attention: ${pointed.id} has no live teaching activity at ${where}. Nothing spent.`
                ));
            }
            return refused('attention.nobodyTeachingHere', 'teach', factsForRefusal(
                'Nobody where you are standing is teaching.',
                `You are at ${where}, and nobody standing here is at the front of anything. What `
                + 'is taught somewhere else is heard by the people standing there.',
                `attention: ${hereIds.size} present at ${where}, none with a live teaching activity. `
                + 'Nothing spent.'
            ));
        }

        if (teacher.cultivation.realmOrdinal <= cultivator.realmOrdinal) {
            return refused('attention.notAbove', 'teach', factsForRefusal(
                `${teacher.name} has nothing to show you from where they stand.`,
                `${teacher.name} stands at ${rankName(teacher.cultivation.realmOrdinal)} and you at `
                + `${rankName(cultivator.realmOrdinal)}. What a teacher gives is the distance between `
                + 'the two, and there is none to give.',
                `attention: teacher ordinal ${teacher.cultivation.realmOrdinal} against `
                + `${cultivator.realmOrdinal}; guidanceMultiplier is 1. Nothing spent.`
            ));
        }

        // HOW LONG. What was asked, and never past the day the lesson ends: a
        // talk that finishes on the third day is not heard on the fourth, and
        // the account says so rather than quietly shortening what was asked.
        const endsIn = teacher.activity?.untilDay === null || teacher.activity?.untilDay === undefined
            ? null
            : Math.max(1, teacher.activity.untilDay - today);
        const wantedDays = Math.max(1, Math.trunc(askedDays ?? endsIn ?? SHORT_ACTION_DAYS));
        const days = endsIn === null ? wantedDays : Math.min(wantedDays, endsIn);

        // WHETHER THEY SEE YOU DO NOT BELONG. Being in the room is the whole of
        // the gate; being noticed in it is the world's answer to how you got in.
        const seen = this.whetherTheySeeYouDoNotBelong(run, cultivator, teacher, rawInput ?? '');
        if (seen.caught) return seen.caught;

        const execution = await this.aSpanUnderTheirEye(
            run, cultivator, ambient, { id: teacher.id, name: teacher.name }, days,
            `Sat in on ${teacher.name}, who was already teaching at ${where}; nothing was asked`
        );
        if (seen.passed) execution.facts.structure.push(seen.passed);
        if (days < wantedDays) {
            const line = `${teacher.name} finishes after ${days} day${days === 1 ? '' : 's'}, and `
                + `that is all of it there was to hear of the ${wantedDays} you meant to stay.`;
            execution.facts.lines.unshift(line);
        }
        execution.calls[0] = { ...execution.calls[0]!, action: 'teach' };
        return execution;
    },

    /**
     * Somebody who is not of the house, sitting in on its teaching.
     *
     * Ruled by the design owner, in parts. Nothing refuses the lecture because
     * the listener is not a member: being in the room is the gate, and however
     * they got in they sit down like anybody. What follows is the world's:
     * either they blend in, or they are seen.
     *
     * ── WHETHER THEY ARE SEEN IS THE TRUST MODEL, READ ONCE PER WITNESS ─────
     *
     * `docs/world/houses/trust.md`: being believed is read on independent axes
     * and never collapsed into one number. Who looks is the house's own people
     * sitting in the same set, and the person at the front where nobody of the
     * house is listening. For each, {@link whetherAFaceIsRemarkable} reads:
     *
     *   realm      whether they register the face at all
     *              (`noticesThatTheyAreThere`) and what rung they take it for
     *              against any concealment (`whatTheyCanPlaceAbout`)
     *   reference  whether they have dealt with this person, and whether the
     *              house is small enough that its faces are known - its real
     *              size, `howManyAHouseReallyHas`, never the roll
     *   the ground whether the place is having a bad year (`theGroundUnderYou`)
     *   signals    whether the stranger wears this house's robes
     *              (`wearsTheRobesOf`). A token is read by somebody who asks,
     *              and a look does not ask.
     *
     * Deterministic, because every one of those reads is.
     *
     * ── SEEN, AND WHAT THE HOUSE CAN DO ABOUT IT ────────────────────────────
     *
     * A row is opened the ordinary way: `trespassed`, which reads as slight
     * because nothing was taken and nobody harmed. Then who has hands on them is
     * the ordinary answer to any confrontation, and there is no standoff rule:
     *
     *   the house people here can take them   `whetherYouAreWorthTheTrouble`
     *                                         reads anything but beyond them,
     *                                         and the room's sentence is carried
     *                                         out: put out, and fined where the
     *                                         room says a fine
     *   they cannot, and send for somebody    `whoAnsweredTheShout`, over the
     *                                         house's people inside the same
     *                                         compound. One who ends it arrives
     *                                         and the sentence follows; one who
     *                                         does not end it arrives and it is
     *                                         a fight nobody has started yet
     *   nobody in the house stands that high  the house cannot order them and
     *                                         says so, which is `houseStanding`
     */
    whetherTheySeeYouDoNotBelong(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        teacher: NpcRecord,
        rawInput: string
    ): { caught: Execution | null; passed: string | null } {
        const world = this.atHand;
        if (!world) return { caught: null, passed: null };
        const placeId = this.worldPlaceOf(cultivator);
        const holding = whoHoldsTheGround(world.locations, placeId);
        const house = holding.holding === 'held' ? holding.holderFactionId : null;
        if (!house) return { caught: null, passed: null };
        const membership = this.repos.sects.getMembership(cultivator.id);
        if (membership?.sectId === house) return { caught: null, passed: null };
        if (guestPlaceHeldBy(this.db, cultivator.id)?.hostFactionId === house) {
            return { caught: null, passed: null };
        }

        // WHO LOOKS
        const today = Math.floor(world.currentDay);
        const listening = new Set(whoTheyAreTeaching(teacher, today));
        const beside = world.npcs.filter(npc => listening.has(npc.id) && npc.status === 'alive'
            && npc.factionId === house);
        const witnesses = beside.length > 0 ? beside : [teacher];

        // WHAT IS THE SAME FOR EVERY WITNESS
        const hiding = whatYouAreNotShowing(rawInput) !== null;
        const inTheRobes = wearsTheRobesOf(world.objects, cultivator.id, house);
        const houseSize = howManyAHouseReallyHas(world, house);
        const ofTheHouse = world.npcs.filter(npc => npc.status === 'alive' && npc.factionId === house);
        const strongestOfTheHouse = ofTheHouse.reduce<number | null>(
            (top, npc) => top === null || npc.cultivation.realmOrdinal > top ? npc.cultivation.realmOrdinal : top,
            null
        );
        const ground = theGroundUnderYou(
            holding, statusesInArea(world.statuses, world.locations, placeId ?? '', today)
        );

        const readings = witnesses.map(witness => {
            const known = tieFrom(this.repos, witness.id, cultivator.id) !== null
                || openLedgerBetween(this.repos, cultivator.id, witness.id).length > 0;
            return {
                witness,
                reading: whetherAFaceIsRemarkable({
                    registers: noticesThatTheyAreThere({
                        theirOrdinal: cultivator.realmOrdinal,
                        yourOrdinal: witness.cultivation.realmOrdinal,
                        known
                    }),
                    knowsThem: known,
                    inTheRobes,
                    takenForRung: whatTheyCanPlaceAbout({
                        theirOrdinal: cultivator.realmOrdinal,
                        readerOrdinal: witness.cultivation.realmOrdinal,
                        keepingItToThemselves: hiding,
                        hasDealtWithThemBefore: known
                    }).rungTheyAreTakenFor,
                    strongestOfTheHouse,
                    houseSize,
                    groundUnderDuress: ground.underDuress
                })
            };
        });
        const seen = readings.find(one => one.reading.remarkable) ?? null;
        if (seen === null) {
            return {
                caught: null,
                passed:
                    `Not of ${holding.holderName ?? house}, and passed for one of them: `
                    + readings.map(one => `${one.witness.name}: ${one.reading.because}`).join(' ')
            };
        }
        const seenBy = seen.witness;

        // ── SEEN ─────────────────────────────────────────────────────────
        const onDay = Math.floor(run.elapsedDays);
        const severity = severityOfTheWrong('trespassed');
        const houseName = holding.holderName ?? house;
        const row = createObligation({
            kind: 'grudge',
            holderId: house,
            subjectId: cultivator.id,
            cause: shapeOf('trespassed').cause,
            severity,
            onDay,
            description:
                `${cultivator.name} was found sitting in on ${teacher.name}'s teaching inside `
                + `${houseName}, and is not of the house.`,
            participants: [house, seenBy.id],
            tags: ['trespassed']
        });
        writeOneObligation(this.db as unknown as DatabaseHandle, row);

        const noticed = seenBy.id === teacher.id
            ? `${teacher.name} stops talking and looks at you, and you are not one of ${houseName}:`
            : `${seenBy.name}, sitting in front of ${teacher.name} with you, looks at you twice and `
              + `says so, and you are not one of ${houseName}:`;
        const lines: string[] = [`${noticed} ${seen.reading.because}`];
        const structure: string[] = [`Seen by ${seenBy.name}: ${seen.reading.because}`];

        // ── WHO HAS HANDS ON THEM ────────────────────────────────────────
        const hereNow = world.npcs.filter(npc => npc.locationId === placeId && npc.status === 'alive'
            && npc.factionId === house);
        const strongestHere = hereNow.reduce<NpcRecord | null>(
            (top, npc) => top === null || npc.cultivation.realmOrdinal > top.cultivation.realmOrdinal ? npc : top,
            null
        );
        const theyCanTakeThem = (ordinal: number) => whetherYouAreWorthTheTrouble({
            theirOrdinal: ordinal,
            yourOrdinal: cultivator.realmOrdinal
        }) !== 'beyond_them';

        let hands: { id: string; name: string } | null =
            strongestHere && theyCanTakeThem(strongestHere.cultivation.realmOrdinal)
                ? { id: strongestHere.id, name: strongestHere.name }
                : null;

        if (hands === null) {
            // THEY SEND FOR SOMEBODY: the shout, over the house's people inside
            // the same compound. Answering for the ground is why they come.
            const seat = pathTo(world.locations, placeId ?? '').find(place => place.kind === 'sect_seat') ?? null;
            const inside = (locationId: string | null) => seat !== null && locationId !== null
                && pathTo(world.locations, locationId).some(place => place.id === seat.id);
            const candidates: CouldBeCalled[] = world.npcs
                .filter(npc => npc.status === 'alive' && npc.factionId === house
                    && npc.locationId !== placeId && inside(npc.locationId))
                .map(npc => ({
                    id: npc.id,
                    name: npc.name,
                    realmOrdinal: npc.cultivation.realmOrdinal,
                    standing: 0,
                    answersForThisGround: true
                }));
            const ambient: AmbientQi = 'normal';
            const intruder = assessPower(combatantFromCultivator(cultivator, this.repos), { ambient });
            const shout = whoAnsweredTheShout(candidates, intruder, { ambient }, who => {
                const body = combatantFromOpponent({
                    name: who.name,
                    realmOrdinal: who.realmOrdinal
                }, this.repos);
                return assessPower(isGuidingErrorBody(body)
                    ? combatantFromCultivator(cultivator, this.repos)
                    : body as CombatantInput, { ambient });
            });
            structure.push(
                `Nobody of ${houseName} here could take them (strongest here: `
                + `${strongestHere ? rankName(strongestHere.cultivation.realmOrdinal) : 'nobody'}); `
                + `whoAnsweredTheShout over ${candidates.length} inside the compound: ${shout.line}`
            );

            if (shout.answered) {
                const came = world.npcs.findIndex(npc => npc.id === shout.answered!.id);
                if (came >= 0 && placeId) {
                    world.npcs[came] = setLocation(world.npcs[came]!, placeId, today);
                }
                if (shout.endsIt) {
                    hands = { id: shout.answered.id, name: shout.answered.name };
                    lines.push(
                        `Nobody here can make you go, so somebody is sent for, and `
                        + `${shout.answered.name} comes.`
                    );
                } else {
                    lines.push(
                        `Nobody here can make you go, so somebody is sent for, and `
                        + `${shout.answered.name} comes and stands in front of you. It is a fight if `
                        + 'either of you starts one.'
                    );
                    structure.push(
                        `${shout.answered.name} could matter against the intruder and does not end it `
                        + 'on arrival. No fight is opened: nothing in the engine opens a held fight '
                        + 'that the player did not start.'
                    );
                }
            } else {
                const standing = houseStanding(house, cultivator.realmOrdinal);
                lines.push(
                    `Nobody of ${houseName} standing here, or anywhere inside, stands high enough to `
                    + 'make you go. Nobody lays a hand on you. You are asked to leave, which is '
                    + 'all a house can do with somebody it cannot order.'
                );
                structure.push(
                    `Nobody answered, so the house negotiates. houseStanding reads ${standing} for `
                    + `${rankName(cultivator.realmOrdinal)}: nothing it says is an order.`
                );
            }
        }

        // ── AND WHERE THE HOUSE HAS HANDS ON THEM, THE ROOM'S SENTENCE ──────
        let stonesTaken = 0;
        let decidedLine = 'No sentence: the house never had hands on them.';
        if (hands !== null) {
            const decided = whatTheRoomDecides({
                what: { does: 'reports', toId: house, line: `${seenBy.name} saw it and said so.` },
                theirsToPunish: true,
                alignment: holding.alignment,
                severity,
                houseId: house,
                theHouseGaveThemSomething: false,
                oneOfTheirOwn: false
            });
            decidedLine = decided.line;
            if (decided.sentence === 'a fine') {
                const fine = whatAFineComesTo(cultivator.realmOrdinal, severity).stones;
                stonesTaken = Math.min(fine, cultivator.spiritStones);
                if (stonesTaken > 0) {
                    this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -stonesTaken });
                }
            }
            const here = world.locations.find(place => place.id === placeId) ?? null;
            const outside = here?.parentId
                ? world.locations.find(place => place.id === here.parentId && place.kind !== 'region') ?? null
                : null;
            if (outside) this.repos.cultivators.update(cultivator.id, { location: outside.name });
            lines.push(
                `${hands.name} puts you out${outside ? `, and you are standing in ${outside.name}` : ''}.`
                + (stonesTaken > 0 ? ` ${stonesTaken} spirit stones are taken off you on the way.` : '')
            );
        }

        const deed = aDeedEntersTheWorld(world, {
            kind: 'said_in_public',
            weight: severity,
            workedOut: true,
            day: today,
            locationId: placeId,
            place: placeName(cultivator),
            actors: [
                { id: cultivator.id, name: cultivator.name, role: 'was found inside' },
                { id: seenBy.id, name: seenBy.name, role: 'saw them' }
            ],
            factionIds: [house],
            summary:
                `${cultivator.name}, who is not of ${houseName}, was found sitting in on `
                + `${teacher.name}'s teaching inside the house`
                + (hands !== null ? ' and was put out.' : ', and was not put out.'),
            unattributed: `Somebody who was not of ${houseName} was found listening inside it.`,
            data: { putOut: hands !== null }
        });
        this.theWorldMoved();

        const execution = refused('attention.seenInside', 'teach', factsForRefusal(
            hands !== null ? 'You are put out.' : 'You are seen, and not put out.',
            lines.join(' '),
            `trespassed: ${row.id} (${severity}) held by ${house}. ${structure.join(' ')}`
        ));
        execution.calls.push({
            name: 'engine.whatTheRoomDecides',
            action: 'teach',
            summary: `${decidedLine} Deed ${deed.fact.id} written.`,
            ok: true
        });
        return { caught: execution, passed: null };
    },

    /**
     * The player at the front of the room.
     *
     * The set is whoever is standing here, alive, below the speaker, and not in
     * the middle of something they cannot put down - the same three facts that
     * decide whether somebody could watch the player. Each of them is written
     * `teaching` naming the speaker and each other, for the span, and put back
     * to what they were at when it ends. The player's own row is not written:
     * see `theyGiveTheirAttention`.
     *
     * What it costs is the days, spent through `shortSkip` at the focus the
     * other lesson-giving verb spends at. What it earns is contribution in the
     * speaker's own house, for the part of the room that is of it - see
     * {@link whatATalkIsWorthToTheHouse}.
     */
    async giveATalk(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        askedDays: number | undefined
    ): Promise<Execution> {
        this.atHand = this.atHand ?? await this.loadWorld();
        const world = this.atHand;
        const where = placeName(cultivator);
        if (!world) {
            return refused('attention.noWorld', 'teach', factsForRefusal(
                'Nobody is here to listen.',
                `You are at ${where}, and there is no world loaded to be listened to in.`,
                'attention: the world is off. Nothing spent.'
            ));
        }
        const today = Math.floor(world.currentDay);
        const hereIds = new Set(this.present(cultivator).map(row => row.id));
        const standing = world.npcs.filter(npc => hereIds.has(npc.id) && npc.status === 'alive');
        const below = standing.filter(npc => npc.cultivation.realmOrdinal < cultivator.realmOrdinal);
        const free = below.filter(npc => whatTheyCannotPutDown(npc, cultivator.id, today) === null);

        if (free.length === 0) {
            const highest = standing.reduce<NpcRecord | null>(
                (top, npc) => top === null || npc.cultivation.realmOrdinal > top.cultivation.realmOrdinal ? npc : top,
                null
            );
            return refused('attention.nobodyToListen', 'teach', factsForRefusal(
                standing.length === 0 ? 'Nobody is here to listen.' : 'Nobody here has anything to hear from you.',
                standing.length === 0
                    ? `You are at ${where}, and there is nobody standing in it.`
                    : below.length === 0
                        ? `You are at ${where} with ${standing.length} other${standing.length === 1 ? '' : 's'}, `
                          + `the furthest up of them at ${rankName(highest!.cultivation.realmOrdinal)} and you `
                          + `at ${rankName(cultivator.realmOrdinal)}. A talk gives the distance between the `
                          + 'speaker and the listener, and nobody here stands below you.'
                        : `Everybody here below you is in the middle of something a body does not put `
                          + 'down to listen: mending, a fight, or a party waiting somewhere else.',
                `attention: ${standing.length} present, ${below.length} below the speaker, `
                + `${free.length} free to listen. Nothing spent.`
            ));
        }

        const days = Math.max(1, Math.trunc(askedDays ?? SHORT_ACTION_DAYS));
        const ids = free.map(npc => npc.id);
        const before = new Map(free.map(npc => [npc.id, npc.activity]));
        for (let i = 0; i < world.npcs.length; i++) {
            const npc = world.npcs[i]!;
            if (!before.has(npc.id)) continue;
            world.npcs[i] = {
                ...npc,
                activity: {
                    kind: 'teaching',
                    note: `listening to ${cultivator.name} talk`,
                    withIds: [cultivator.id, ...ids.filter(id => id !== npc.id)],
                    sinceDay: today,
                    untilDay: today + days,
                    returnTo: null
                }
            };
        }
        this.theWorldMoved();

        let spent: Execution;
        try {
            spent = await this.shortSkip(run, cultivator, ambient, TRAVEL_FOCUS, 'Giving a talk', days);
        } finally {
            // PUT BACK ONLY WHAT IS STILL THE TALK. Somebody the world moved on
            // to something else in the meantime stays where the world put them.
            for (let i = 0; i < world.npcs.length; i++) {
                const npc = world.npcs[i]!;
                if (!before.has(npc.id)) continue;
                const doing = npc.activity;
                if (!doing || doing.kind !== 'teaching' || !doing.withIds.includes(cultivator.id)) continue;
                world.npcs[i] = { ...npc, activity: before.get(npc.id) ?? null };
            }
            this.theWorldMoved();
        }

        const lived = spent.timeSkip?.simulatedDays ?? days;
        const membership = this.repos.sects.getMembership(cultivator.id);
        const ofTheHouse = membership ? free.filter(npc => npc.factionId === membership.sectId).length : 0;
        const credit = membership
            ? whatATalkIsWorthToTheHouse(cultivator.realmOrdinal, lived, ofTheHouse, free.length)
            : 0;
        if (membership && credit > 0) {
            this.repos.sects.addContribution(membership.sectId, cultivator.id, credit);
        }

        const line = `You talk for ${lived} day${lived === 1 ? '' : 's'} to ${free.length} `
            + `${free.length === 1 ? 'person' : 'people'} standing below you, and those days are not `
            + 'your own practice.'
            + (credit > 0
                ? ` ${ofTheHouse} of them ${ofTheHouse === 1 ? 'is' : 'are'} of your own house, and the `
                  + `house writes ${credit} contribution against your name for it.`
                : membership
                    ? ' Nobody listening is of your own house, so there is nothing for its ledger.'
                    : '');
        spent.facts.lines.unshift(line);
        spent.facts.prose = `${line}\n\n${spent.facts.prose}`;
        spent.calls.unshift({
            name: 'world.theyGiveTheirAttention',
            action: 'teach',
            summary:
                `${cultivator.name} at ${rankName(cultivator.realmOrdinal)} gave a talk at ${where} to `
                + `${free.length} (${ofTheHouse} of their own house) for ${lived} of ${days} day(s). `
                + `Each listener's row was written teaching with the speaker in withIds and put back `
                + `afterwards; each got ${(shareOfAttention(free.length) * 100).toFixed(0)}% of `
                + `what a sole student would. Contribution credited: ${credit}, being a duty's rate `
                + 'at the speaker\'s own rung over the days, times the house listeners counted as '
                + 'the share of attention each got.',
            ok: lived > 0
        });
        return spent;
    }
};

/**
 * What a talk is worth to the speaker's house, in the ledger it keeps of service.
 *
 * NO NEW RATE. A duty pitched at the speaker's own rung credits
 * `CONTRIBUTION_BASE + ordinal * CONTRIBUTION_PER_ORDINAL` over
 * `ORDINARY_DUTY_DAYS` (`duties.ts`), and that is what one person's days of
 * work for the house are worth to it. A talk is those days, multiplied by how
 * much of a student the house's listeners added up to: each of them got
 * `shareOfTheirAttention` of what a sole student would, so a talk to one
 * disciple for twenty days is one duty, and a talk to forty for a day is a few
 * points - the figure saturating as the room grows, for the same reason what
 * each listener gets thins.
 */
export function whatATalkIsWorthToTheHouse(
    speakerOrdinal: number,
    days: number,
    listenersOfTheHouse: number,
    listeners: number
): number {
    if (listenersOfTheHouse <= 0 || days <= 0) return 0;
    const dutyRate = CONTRIBUTION_BASE + speakerOrdinal * CONTRIBUTION_PER_ORDINAL;
    const studentsWorth = listenersOfTheHouse * shareOfAttention(listeners);
    return Math.round(dutyRate * (days / ORDINARY_DUTY_DAYS) * studentsWorth);
}

// ─────────────────────────────────────────────────────────────────────────
// WHETHER A STRANGER'S FACE STANDS OUT
// ─────────────────────────────────────────────────────────────────────────

/**
 * How many people a house really has, which is not how many are on its roll.
 *
 * `a-house-and-who-is-in-it.md`: the roll is who a player could come to know,
 * and a sect has hundreds of outer disciples nobody models. The one figure the
 * world holds for the rest is the room the house sleeps them in - the
 * dormitory, cut by `architecture.ts` for the heads the compound was built for.
 * A house that takes nobody in has no dormitory and no unmodelled hundreds, and
 * for that house the roll IS the house.
 */
export function howManyAHouseReallyHas(
    world: Pick<WorldState, 'locations' | 'npcs'>,
    houseId: string
): number {
    const slept = world.locations
        .filter(place => place.data?.factionId === houseId && purposeOf(place) === 'dormitory')
        .reduce((sum, place) => sum + Math.max(0, Number(place.data?.capacity ?? 0)), 0);
    if (slept > 0) return slept;
    return world.npcs.filter(npc => npc.status === 'alive' && npc.factionId === houseId).length;
}

export interface AFaceBeingLookedAt {
    /** Whether the face registers at all, from the witness's rung. */
    registers: boolean;
    /** Whether the witness has dealt with this person and knows who they are. */
    knowsThem: boolean;
    /** Whether they wear this house's robes. */
    inTheRobes: boolean;
    /** The rung the witness takes them for, which a concealment can lower. */
    takenForRung: number;
    /** The strongest living person of the house, or null for a house of nobody. */
    strongestOfTheHouse: number | null;
    /** `howManyAHouseReallyHas`. */
    houseSize: number;
    /** Whether the ground is having a bad year. */
    groundUnderDuress: boolean;
}

/**
 * Whether a stranger's face stands out to one person of the house, and why.
 *
 * Every clause is one of the trust model's axes, kept apart, and they are asked
 * in the order a look reaches them. Nothing here is a chance: the reads it is
 * made of are facts, and a stranger either fits the room or does not.
 *
 *   no register      a face the witness does not register cannot stand out
 *   known            somebody who has dealt with you knows you are not of it
 *   no robes         the house's people dress as the house; a stranger in
 *                    their own clothes is the first thing anybody sees
 *   above the house  a face taken for a rung nobody of the house stands at
 *   a small house    `A_ROLL_A_PLAYER_COULD_KNOW` is how many faces one person
 *                    holds; a house no bigger than that knows all of its own
 *   a bad year       a house in trouble looks twice at every face
 *
 * Past all six an unfamiliar face in the right robes is ordinary.
 */
export function whetherAFaceIsRemarkable(face: AFaceBeingLookedAt): { remarkable: boolean; because: string } {
    if (!face.registers) {
        return { remarkable: false, because: 'the face does not register from where they stand.' };
    }
    if (face.knowsThem) {
        return { remarkable: true, because: 'they have dealt with you and know you are not of the house.' };
    }
    if (!face.inTheRobes) {
        return { remarkable: true, because: 'you are not in the house\'s robes, and everybody else is.' };
    }
    if (face.strongestOfTheHouse !== null && face.takenForRung > face.strongestOfTheHouse) {
        return {
            remarkable: true,
            because: `you are taken for ${rankName(face.takenForRung)}, and nobody of the house stands `
                + 'that high.'
        };
    }
    if (face.houseSize <= A_ROLL_A_PLAYER_COULD_KNOW) {
        return {
            remarkable: true,
            because: `the house is ${face.houseSize} people, few enough that every face in it is known.`
        };
    }
    if (face.groundUnderDuress) {
        return { remarkable: true, because: 'the place is having a bad year, and every face is looked at twice.' };
    }
    return {
        remarkable: false,
        because: `an unfamiliar face in the robes of a house of ${face.houseSize} is nobody in particular.`
    };
}
