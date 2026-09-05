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
 */
export function theirHalfOfTheRite(repos: CultivationRepos, personId: string): HalfOfTheRite {
    const known = repos.techniques.listKnown(personId);
    const fuel = (row: typeof known[number]) => (row as unknown as { runsOn?: string }).runsOn;
    const taking = known.find(row => fuel(row) === RUNS_ON_ANOTHER) ?? null;
    const spending = known.find(row => fuel(row) === RUNS_ON_OWN_LIFESPAN) ?? null;
    const held = taking ?? spending;
    const stage = held ? Number((held as unknown as { stage?: number }).stage ?? 1) : 0;
    return {
        takingArt: taking?.id ?? null,
        spendingArt: spending?.id ?? null,
        stage: Number.isFinite(stage) ? Math.max(0, stage) : 0
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
 */
export function whyTheRiteWillNotOpen(
    actor: HalfOfTheRite,
    subject: HalfOfTheRite,
    subjectName: string
): WhyNot | null {
    if (actor.takingArt === null) {
        return {
            headline: 'You have no art that runs on another person.',
            said: 'The rite draws through a method, and you are cultivating none that takes. '
                + 'Whatever you meant to draw off them has nothing in you to run into.',
            account: `actor holds no art with runsOn='${RUNS_ON_ANOTHER}'; the rite does not open.`
        };
    }
    if (subject.spendingArt === null) {
        return {
            headline: `${subjectName} is not cultivating the half that answers it.`,
            said: `The rite runs between two arts, not one. Yours draws; the other spends the `
                + `body it is cultivated in, and ${subjectName} is cultivating no such thing. `
                + 'A body that has never opened that half is not fuel - it is a person '
                + 'standing there. Somebody made into a furnace was made into one over years, '
                + 'and the making is the road you are actually looking at.',
            account: `subject holds no art with runsOn='${RUNS_ON_OWN_LIFESPAN}'; the rite `
                + 'does not open. What a furnace is worth is their own stage in that half, so '
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
 * NOT YET REACHABLE: the half a subject cultivates has no row in
 * `techniques.ts`, so this reads zero for everybody. See the design note in
 * `docs/world/normal-in-the-cultivation-world.md` - splitting the rite into two
 * linked arts is the design owner's ruling and the second row is the missing
 * half of it.
 */
export function whatThisFurnaceIsWorth(subject: HalfOfTheRite): number {
    return subject.spendingArt === null ? 0 : subject.stage;
}
