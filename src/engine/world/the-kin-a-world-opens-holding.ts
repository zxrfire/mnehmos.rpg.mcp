/**
 * The ties of blood between catalog people that a world already has on the day
 * it opens.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS CLOSES
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `the-marriages-a-world-opens-holding.ts` made who somebody is married to a
 * fact about them. Who somebody's SISTER is was left to the draw, and the draw
 * cannot reach it: `seedTheFamiliesStandingInAPlace` writes parents and
 * siblings out of who happens to be standing in the same settlement, so a
 * catalog figure got a different family in every world or none at all.
 *
 * Measured on four fresh worlds, seeds `wed-a..d`, before this pass: Ru Anxi
 * was the Grand Sword Elder's daughter in two of them and nobody's relative in
 * the other two, and in no world was she related to Ru Anwei - whose own entry
 * opens *"The younger sister"* and whose `wants` is to be asked about something
 * other than her sister. Three ties were asserted in the writing and stated by
 * no row anywhere. {@link AUTHORED_KIN} states them; this writes them.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * STATED KIN AND DRAWN CHILDREN ARE NOT IN TENSION
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The ruling next door looks like it forbids this and does not. Marriages are
 * stated and children are drawn, because a fixed roster of children would close
 * the one door that lets a life open inside a household the catalog wrote - 24
 * of three thousand births do.
 *
 * The line is between the two: a tie among the catalog's OWN people is a fact
 * about them, and whether an authored figure also has drawn, non-catalog
 * children is a fact about a world. Nothing here touches the second. The birth
 * draw reads ages and `child` ties (`couldHaveBeenAParentTo`) and never looks
 * at a `kin` row, so every seat stays open.
 *
 * ORDERING IS LOAD-BEARING. This runs AFTER the marriages and BEFORE the
 * families, so `nothingElseBetween` sees a stated cousin and declines to make
 * her a drawn daughter. Run the other way round it would be the seeder arguing
 * with the writing.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * A TIE WHOSE OTHER END IS ABOVE THE LID
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `seedNamedFigures` instantiates `MEMBERS` and nobody else. The guest elders,
 * the wanderers, the sealed ancestors and everybody who crossed are named in
 * the catalogs and have no world row, so a stated tie with one of them on the
 * end cannot be written and never will be.
 *
 * That is a rule about the Lid and not a note about one woman, which is why
 * {@link KinSeeded.aboveTheLid} is a counter rather than a special case: the
 * next immortal tie somebody authors lands in the same bucket with no new code.
 * BOTH ENDS OR NEITHER, the ruling the marriage pass already makes about a
 * mortal spouse - a tie written from one side has `whoTheyCarryFor` answering
 * that somebody carries for a person the world cannot say is alive.
 *
 * Ru Anjing is the one row in it today, and she is stated anyway. Who somebody's
 * sister is does not stop being a fact about them because the engine has
 * nowhere to put her, and a row dropped in silence is how a thing ends up
 * asserted in prose and absent from the data.
 */

import { AUTHORED_KIN, KIN_THE_OTHER_WAY_ROUND } from '../../data/cultivation/members.js';
import { isCatalogPerson, worldIdForCatalogPerson } from './a-catalog-person-and-their-world-row.js';
import { bindKin, rosterOf, type Roster } from './the-ties-an-ordinary-life-produces.js';
import type { NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';

export interface KinSeeded {
    /** Ties written. Each is two rows. */
    written: number;
    /**
     * Stated ties both of whose ends are people the world instantiates, and
     * which it nonetheless holds no row for.
     *
     * A catalog and a seeder disagreeing about who exists. The test asserts
     * this is nought; {@link aboveTheLid} is the case that is not this.
     */
    unwritten: number;
    /**
     * Stated ties with somebody the world never instantiates on one end.
     *
     * Not a failure and not fixable here. See the banner.
     */
    aboveTheLid: number;
    /**
     * Stated ties written over a row `seedFactions` had derived.
     *
     * Counted because it is a real loss and has to stay small and visible: a
     * pair holds exactly one relationship row, so a stated cousin displaces the
     * `ally` that rank order had put there. The rank order itself is untouched
     * and the derived row can be recomputed from it; the blood cannot be
     * derived from anything, which is why it wins.
     */
    overDerived: number;
}

const capitalised = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * Write the ties of blood the catalog states.
 *
 * No place grouping, no rate and no draw: the two people are named, and the
 * only questions are whether the world holds them and whether writing the tie
 * would destroy another.
 *
 * DATED FROM THE DAY BOTH OF THEM EXISTED, which for every row here is the
 * junior end's birth. The catalog gives these people no birthday - their age is
 * derived from the rung they stand at and moves with the seed - so the same
 * reasoning the marriages use applies: WHO is the fact, and how long is what
 * this world made of it.
 */
export function seedTheKinTheCatalogStates(
    state: WorldState,
    roster: Roster = rosterOf(state)
): KinSeeded {
    const { at } = roster;
    let written = 0;
    let unwritten = 0;
    let aboveTheLid = 0;
    let overDerived = 0;

    for (const kin of AUTHORED_KIN) {
        const oneAt = at.get(worldIdForCatalogPerson(kin.oneId));
        const otherAt = at.get(worldIdForCatalogPerson(kin.otherId));
        if (oneAt === undefined || otherAt === undefined) {
            // Which of the two absences this is. Somebody the catalog names and
            // `seedNamedFigures` does not instantiate was never going to have a
            // row; anybody else missing is a disagreement worth failing on.
            if (!isCatalogPerson(kin.oneId) || !isCatalogPerson(kin.otherId)) aboveTheLid++;
            else unwritten++;
            continue;
        }

        const one = state.npcs[oneAt];
        const other = state.npcs[otherAt];
        if (heldAnythingElse(one, other) || heldAnythingElse(other, one)) overDerived++;

        bindKin(
            state, at, one, other,
            `${capitalised(KIN_THE_OTHER_WAY_ROUND[kin.tie])}.`,
            `${capitalised(kin.tie)}.`,
            Math.max(one.identity.bornOnDay, other.identity.bornOnDay)
        );
        written++;
    }

    return { written, unwritten, aboveTheLid, overDerived };
}

const heldAnythingElse = (holder: NpcRecord, about: NpcRecord): boolean =>
    holder.relationships.some(r => r.targetId === about.id && r.kind !== 'kin');
