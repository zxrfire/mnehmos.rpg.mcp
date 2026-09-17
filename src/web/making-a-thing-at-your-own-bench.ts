/**
 * Making a thing at your own bench, which nobody could do.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE READ THAT ONLY RAN ONE WAY
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `commissioning-a-craft.ts` answers "would THEY make it for me" and has since
 * it was written. Nothing answered "could I make it myself", and AGENTS.md names
 * that as its own class of defect: a read built in one direction looks complete,
 * because the question it answers is the question it was written for.
 *
 * Measured on the pattern table before this: "I craft a talisman", "I cut a
 * slip", "I make myself a talisman" and "I forge an earth-grade sword" all
 * parsed to `unclear`, while "I build a carriage" reached the yard. The whole of
 * `a-talisman-is-one-act-somebody-already-paid-for.ts` - the gate, the fold, the
 * mint, the burn - had exactly one caller in `src/`, and that caller was world
 * seeding. A player could hold a slip somebody else had put in a ruin and could
 * never cut one.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND IT IS THE PLACE THE RECIPE FINALLY BITES
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner: *"recipes should take stuff out of your inventory."* Until
 * this file there was nowhere for that to happen. The commission asks and
 * answers and hands over nothing; the yard mints from the conveyance bill and
 * never touches the artifact recipe; alchemy burns its own ingredients. So the
 * artifact recipe gated a question nobody could act on.
 *
 * Here it gates a thing that comes into existence, and
 * `taking-the-materials-off-the-bench.ts` takes what it named.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT IT COSTS: THE MATERIALS AND THE DAYS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The materials, and the days the grade asks of this hand: `daysAtTheWork` in
 * `commissioning-a-craft.ts`, the one curve a cauldron and a commission read,
 * spent by the verb through `shortSkip`. A third of a day for a mortal slip and
 * years for heaven-grade work at the gate. The yard is its own shape and
 * spends what the catalog gives a hull.
 *
 * NO ROLL EITHER, and that is a stated absence rather than an oversight. The
 * rung and the bench ARE the difficulty here - `whetherTheirHandsCanDoIt` is two
 * gates and both of them can refuse - and whether a hand that clears both should
 * also be able to waste the materials is a design question, not a tuning
 * constant. `building-a-conveyance...` rolls one because somebody ruled that a
 * hull can fail on the slipway. Nobody has ruled on paper.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHERE THE FINISHED THING LANDS, AND THE GAP IN IT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A row in the world, at the significance its grade earns
 * (`howMuchAGradeIsWorthTracking`), whatever the grade. That is right for a
 * heaven-grade thing and it is a KNOWN GAP below the line: the design owner's
 * rule is that *"a commissioned talisman is counted if its not heaven rank"*,
 * and a counted thing is a stack keyed by a CATALOG id. A thing somebody made
 * and named themselves has no catalog id, so there is nothing for a stack to
 * count. The row carries `significance: 'mundane'` where the grade says counted,
 * which is the honest statement of which tier it belongs in, and the store it
 * belongs in does not exist yet.
 */

import type Database from 'better-sqlite3';

import { whetherTheirHandsCanDoIt } from '../engine/social-leverage/commissioning-a-craft.js';
import type { WhatYouAskedThemToMake } from '../engine/social-leverage/index.js';
import {
    cutATalisman,
    whatWasFoldedIn
} from '../engine/world/a-talisman-is-one-act-somebody-already-paid-for.js';
import { isAWorkedGrade } from '../data/cultivation/what-an-artifact-is-made-of.js';
import {
    howMuchAGradeIsWorthTracking,
    makeObject,
    transferPossession,
    type ObjectRecord
} from '../engine/world/possessions.js';
import { rankName } from '../engine/cultivation/realms.js';
import type { Cultivator } from '../schema/cultivation.js';
import { takeWhatTheRecipeNames } from './taking-the-materials-off-the-bench.js';
import { whatTheyWereAskedToMake } from './what-somebody-was-asked-to-make.js';
import {
    theIdsOnTheBench,
    whatThisPersonHasOnTheBench,
    type AUnitOnTheBench
} from './what-is-on-the-bench.js';

/**
 * Why a ring is not made at a bench.
 *
 * A ring is folded space rather than worked material - which is why no recipe
 * reaches one and why `couldFoldARing` rather than `canRefineGrade` answers for
 * it - and nothing in this engine folds one yet. Said out loud because a refusal
 * that names the honest route is worth more than a silent absence, and because
 * the absence is real: `whatARingCosts` prices one and nothing mints one.
 */
const A_RING_IS_NOT_FOLDED_AT_A_BENCH =
    'A storage ring is not worked out of materials at all. Somebody folds a space and holds it '
    + 'folded, which is why the ones that exist are counted in single figures and why a house '
    + 'that has one knows exactly who folded it. Nothing in this world folds one to order.';

/**
 * The player's own words, in a sentence that needs an article.
 *
 * `ask.named` is echoed rather than looked up - it is what they called it and
 * that is the right name for it - and it arrives with whatever article they
 * typed or none at all, so "a talisman is finished" and "talisman is finished"
 * were both reachable. The catalog has the same problem from the other end and
 * solves it the same way, stripping the article the name carries.
 */
function theThing(named: string): string {
    return `the ${named.replace(/^(?:an?|the)\s+/i, '')}`;
}

export interface MakingPlan {
    kind: 'refused' | 'make';
    headline: string;
    lines: string[];
    structure: string[];
    /**
     * The ask and the bench it was read against, both present or neither: a
     * plan carrying one without the other would let `landTheMaking` spend a
     * bench the gate never looked at.
     */
    ask?: WhatYouAskedThemToMake;
    bench?: readonly AUnitOnTheBench[];
}

export interface PlanTheMaking {
    db: Database.Database;
    objects: readonly ObjectRecord[];
    cultivator: Cultivator;
    /** What they said after the verb. */
    said: string;
}

/**
 * Decide what this turn at the bench is, writing nothing.
 *
 * Every gate is somebody else's function asked a question, and the material one
 * is asked with the player standing in the maker's place - which is the whole
 * point of `whetherTheirHandsCanDoIt` taking an ordinal and not a person: one
 * ladder, read from both ends, and what somebody would have to bring you is what
 * you have to bring yourself.
 */
export function planTheMaking(input: PlanTheMaking): MakingPlan {
    const said = (input.said ?? '').trim();
    const { cultivator } = input;

    if (said.length < 2) {
        return {
            kind: 'refused',
            headline: 'Make what?',
            lines: [
                'You sit down at the bench with nothing in mind. A bench turns materials into one '
                + 'thing at a time, and it wants to be told which.',
                'Name it and its grade: "I cut an earth-grade talisman", "I forge a heaven-grade '
                + 'blade".'
            ],
            structure: ['craft at a bench with no object named. Nothing spent, no time passed.']
        };
    }

    const ask = whatTheyWereAskedToMake(said);

    // A RING IS NOT WORKED. Ahead of the hands gate, because `couldFoldARing`
    // would refuse most people on the rung and say nothing about the fact that
    // nobody at any rung can do this here.
    if (ask.aRing) {
        return {
            kind: 'refused',
            headline: 'Nobody folds a ring to order.',
            lines: [A_RING_IS_NOT_FOLDED_AT_A_BENCH],
            structure: [
                'Refused a ring at a bench: no recipe reaches one and nothing mints one. '
                + 'whatARingCosts prices a ring and has no maker behind it.'
            ]
        };
    }

    const bench = whatThisPersonHasOnTheBench(input.db, input.objects, cultivator.id);
    // YOURS, which is the only thing that differs between the two directions.
    // The gates are the same three gates.
    const hands = whetherTheirHandsCanDoIt(
        ask, cultivator.realmOrdinal, theIdsOnTheBench(bench), 'yours'
    );

    if (!hands.theyCan) {
        // TWO REFUSALS, NOT ONE. A rung somebody has to climb and a morning's
        // gathering are different things to go and do, and a line that said
        // "your hands cannot" about a bare bench would send them after the wrong
        // one entirely. `askingSomebodyToMakeYouSomething` splits them the same
        // way and for the same reason.
        const bare = hands.theBenchIsShortOf.length > 0;
        return {
            kind: 'refused',
            headline: bare
                ? 'Your hands can, and the stuff is not here.'
                : `${rankName(cultivator.realmOrdinal)} is not the hand for it.`,
            lines: [hands.why ?? 'It cannot be made.'],
            structure: [
                `craft at a bench refused: ${ask.grade} grade at ordinal `
                + `${cultivator.realmOrdinal}. `
                + (bare
                    ? `Short ${hands.theBenchIsShortOf.length} slot(s): `
                      + hands.theBenchIsShortOf.map(s => s.slot.what).join('; ') + '. '
                      + `Bench held ${bench.length} piece(s).`
                    : `Best grade these hands work: ${hands.insteadTheyCouldMake ?? 'none'}.`)
            ]
        };
    }

    return {
        kind: 'make',
        headline: `You set to work on ${theThing(ask.named)}.`,
        lines: [],
        structure: [
            `craft at a bench: ${ask.grade} grade, ${ask.slip ?? 'a made thing'}, at ordinal `
            + `${cultivator.realmOrdinal}. Bench held ${bench.length} piece(s)`
            + (isAWorkedGrade(ask.grade) ? ' and the recipe is whole.' : '; the grade asks for no recipe.')
        ],
        ask,
        bench
    };
}

export interface MadeAtTheBench {
    lines: string[];
    structure: string[];
    calls: { name: string; summary: string }[];
    /** The thing, for the caller to put in the world. Null where nothing was made. */
    minted: ObjectRecord | null;
}

export interface LandTheMaking {
    db: Database.Database;
    /** The world's rows. Materials that went in are ruined in place. */
    objects: ObjectRecord[];
    cultivator: Cultivator;
    plan: MakingPlan;
    today: number;
}

/**
 * Take the materials, and then make the thing.
 *
 * THAT ORDER, and it is the whole of the partial-spend rule from this end. The
 * take is all-or-nothing and says so by returning nothing at all when it takes
 * nothing; a mint that ran first would be a thing in somebody's hands that the
 * bench then failed to pay for.
 *
 * ONLY EVER CALLED ON A `make` PLAN, so there is no arrangement in which a
 * caller renders a finished thing over a world that did not move.
 */
export function landTheMaking(input: LandTheMaking): MadeAtTheBench {
    const { cultivator, plan, today } = input;
    if (plan.kind !== 'make') {
        throw new Error(`landTheMaking wants a make plan, got ${plan.kind}.`);
    }
    const ask = plan.ask!;

    const paid = takeWhatTheRecipeNames({
        db: input.db,
        objects: input.objects,
        grade: ask.grade,
        bench: plan.bench!,
        onDay: today,
        intoWhat: theThing(ask.named)
    });

    if (paid === null) {
        return {
            lines: [
                'You reach for the first of it and it is not where it was. Nothing went into the '
                + 'work and nothing came out of your hands.'
            ],
            structure: [
                `craft at a bench: the ${ask.grade} recipe could not be paid out of the bench `
                + 'after the gate passed. Nothing was taken and nothing was made.'
            ],
            calls: [],
            minted: null
        };
    }

    const standsAt = whatWasFoldedIn(cultivator.realmOrdinal);
    const blank = ask.slip
        ? cutATalisman({
            id: `obj-made-${cultivator.id}-${today}`,
            name: ask.named,
            grade: ask.grade,
            what: ask.slip,
            crafterId: cultivator.id,
            crafterName: cultivator.name,
            crafterOrdinal: cultivator.realmOrdinal,
            onDay: today
        })
        // NOT A SECOND CATALOG. The same factory the artifact table itself is
        // built with, at the significance its grade earns, standing at the rung
        // of the hand that made it - which is `possessions.ts`'s own rule that a
        // finished thing carries an ordinal and the stuff it came from carries a
        // grade.
        : makeObject({
            id: `obj-made-${cultivator.id}-${today}`,
            name: ask.named,
            kind: 'artifact',
            significance: howMuchAGradeIsWorthTracking(ask.grade),
            description: `${ask.grade}-grade work, made by ${cultivator.name}.`,
            power: standsAt,
            tags: ['made', `grade:${ask.grade}`]
        });

    const minted = transferPossession(blank, {
        onDay: today,
        toHolderId: cultivator.id,
        toHolderName: cultivator.name,
        how: 'crafted',
        source: cultivator.location ?? 'a bench nobody has named',
        transfersOwnership: true,
        note: paid.took.length === 0
            ? 'Made out of nothing anybody counts.'
            : `Made out of ${paid.took.map(one => one.name).join(', ')}.`
    });

    return {
        lines: [
            ...paid.lines,
            `T${theThing(ask.named).slice(1)} is finished, and it stands where you stand: `
            + `${rankName(standsAt)}. Its record starts with you.`
        ],
        structure: [
            ...paid.structure,
            `${minted.id}: ${ask.grade} grade, ${minted.significance}, rated ${minted.power}, `
            + `made by ${cultivator.id} on day ${today}. Provenance link 1 of 1.`
        ],
        calls: [
            ...paid.calls,
            {
                name: ask.slip ? 'world.cutATalisman' : 'world.makeObject',
                summary: `${minted.id} (${ask.named}, ${ask.grade} grade, rated ${minted.power}) `
                    + `minted to ${cultivator.id}.`
            }
        ],
        minted
    };
}
