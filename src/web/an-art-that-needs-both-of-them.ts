/**
 * Who may draw somebody off, and who may be drawn.
 *
 * The rite is two halves and they are not the same art. One person cultivates
 * the taking half - `runsOn: 'the_others'`, which is the catalog's own word for
 * an art fuelled by somebody else - and the other cultivates the half that makes
 * them fuel. Reading the roles off the technique list rather than off the call
 * site is what makes them legible: a person's arts say which side of a rite they
 * are, and anybody who can read a technique list can see it.
 *
 * Neither half is a weapon. Both carry `damage: null`: the taker gets qi, not
 * combat power, and has to cultivate something else to fight with.
 */
import type { CultivationRepos } from '../server/consolidated/cultivation-support.js';
import { getTechnique } from '../data/cultivation/index.js';
import type { FurnaceUseType } from '../engine/social-leverage/an-art-that-needs-two-people.js';

/** The taker's fuel: an art that runs on another person. */
export const RUNS_ON_ANOTHER = 'the_others';
/** The furnace's fuel: an art that spends the holder's own lifespan and qi. */
export const RUNS_ON_OWN_LIFESPAN = 'own_lifespan';

export interface HalfOfTheRite {
    /** An art they hold that runs on somebody else. Null when they hold none. */
    takingArt: string | null;
    /** An art they hold that spends their own lifespan. The furnace half. */
    spendingArt: string | null;
    /** How far they have taken whichever half they hold. Zero when neither. */
    stage: number;
}

/**
 * What somebody brings to a rite: the taking art they hold, if any.
 *
 * Read off `runsOn` rather than a named id. Three arts carry it today and a
 * fourth added tomorrow is covered without this file being edited.
 *
 * `runsOn` is read from the CATALOG. The repo row never carries it - the table
 * has no column and the parse defaults it to `'self'` - so reading it off the
 * row refused every rite for everybody. `alsoHolds` is the technique list on a
 * world row, for somebody who has no `cultivators` row to list.
 */
export function theirHalfOfTheRite(
    repos: CultivationRepos,
    personId: string,
    alsoHolds: readonly string[] = []
): HalfOfTheRite {
    const ids = [...repos.techniques.listKnown(personId).map(row => row.id), ...alsoHolds];
    const fuel = (id: string) => getTechnique(id)?.runsOn;
    const taking = ids.find(id => fuel(id) === RUNS_ON_ANOTHER) ?? null;
    const spending = ids.find(id => fuel(id) === RUNS_ON_OWN_LIFESPAN) ?? null;
    // No stored stage exists for an art yet, so holding one is stage 1.
    return {
        takingArt: taking,
        spendingArt: spending,
        stage: (taking ?? spending) !== null ? 1 : 0
    };
}

export interface WhyNot {
    headline: string;
    said: string;
    account: string;
}

/**
 * The refusal, or null when the rite can open.
 *
 * Names WHICH half is missing: "you cannot" and "they have not cultivated the
 * art" are different facts, and only the second says what road somebody is
 * actually looking at.
 *
 * A FORCED RITE ASKS FOR ONE HALF. The owner: *"you force the subject to
 * cultivate the half."* The taker's art opens the second channel in whoever
 * it is worked on, so a subject beaten into submission needs no art of their
 * own. The taking half is still required: the draw has to run into something.
 * A willing rite still needs both, because nobody is forcing anything open.
 */
export function whyTheRiteWillNotOpen(
    actor: HalfOfTheRite,
    subject: HalfOfTheRite,
    subjectName: string,
    how: FurnaceUseType
): WhyNot | null {
    if (actor.takingArt === null) {
        return {
            headline: 'You have no art that runs on another person.',
            said: 'The rite draws through a method, and you are cultivating none that takes. '
                + 'Whatever you meant to draw off them has nothing in you to run into.',
            account: `actor holds no art with runsOn='${RUNS_ON_ANOTHER}'; the rite does not open.`
        };
    }
    if (subject.spendingArt === null && how === 'offered') {
        return {
            headline: `${subjectName} is not cultivating the half that answers it.`,
            said: `The rite runs between two arts, not one. Yours draws; the other spends the `
                + `body it is cultivated in, and ${subjectName} is cultivating no such thing. `
                + 'A body that has never opened that half is not fuel - it is a person '
                + 'standing there. Somebody made into a cultivation furnace was made into one over '
                + 'years, '
                + 'and the making is the road you are actually looking at.',
            account: `subject holds no art with runsOn='${RUNS_ON_OWN_LIFESPAN}'; the rite `
                + 'does not open. What a cultivation furnace is worth is their own stage in that '
                + 'half, so '
                + 'a subject holding none is worth none.'
        };
    }
    return null;
}

/**
 * What a furnace is worth, as a multiple of the base draw.
 *
 * The SUBJECT's own depth, not the taker's - a furnace is worth what has been
 * grown in them, which is what makes keeping one a long road rather than an
 * afternoon.
 *
 * Read by `the-furnace-rite-once-somebody-has-yielded.ts`, multiplied with the
 * physique's `drawnOff`. No stored stage exists yet, so it reads 1 for anybody
 * holding the half (the Lotus-Nurturing Canon is its row).
 *
 * A forced rite opens the half in somebody who never cultivated it, and a
 * channel opened that day is at the first stage - the same 1 that holding the
 * half reads as while no stage is stored. So forcing it and having cultivated
 * it draw the same today; the day a stage is stored, the cultivated half is
 * the one that grows.
 */
export function whatThisFurnaceIsWorth(subject: HalfOfTheRite, how: FurnaceUseType): number {
    if (subject.spendingArt !== null) return subject.stage;
    return how === 'coerced' ? 1 : 0;
}
