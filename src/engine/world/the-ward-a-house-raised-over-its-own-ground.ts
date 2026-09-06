/**
 * THE WARD A HOUSE RAISED OVER ITS OWN GROUND.
 *
 * The design owner: *"a sect can construct their own formation [...] which
 * depends on who made it [...] on top of all their buildings."*
 *
 * Without this, no compound in the world had anything standing over it, so
 * `whatAHouseIsMadeOf` read every seat as bare masonry and a body at the bottom
 * of the ladder could walk into the seat of a body at the top.
 *
 * ── WHY THIS DOES NOT GO THROUGH `raiseFormation`, WHICH LOOKS LIKE ITS JOB ──
 *
 * Because that function is about a PERSON, and this is not a person's act.
 *
 * `a-formation-stands-at-the-lower-of-the-art-and-the-builder.ts` prices a
 * formation somebody raises out of an art they practise, and its own test holds
 * a design ruling in the owner's words - *"not every sword art is also a
 * formation art. maybe one or two is"* - with an instruction attached: two arts
 * in the whole catalog, *change it deliberately, with the rows, never as a side
 * effect.* The `formation` road there means a sword DOMAIN, a standing field a
 * swordsman projects, and roughly one or two people in a generated world can
 * raise one at all.
 *
 * A house's standing ward is a different object with the same name. It is not
 * practised, it is not on anybody's sheet, and no living person necessarily
 * knows how it was laid: it is masonry-and-array, cut into the ground over a
 * season, inherited by whoever heads the house next and renewed when the house
 * has somebody who can renew it. Routing it through the personal machinery
 * would have meant adding warding arts to the catalog, which widens that road
 * from two rows to five and quietly makes the rare thing common - the exact
 * failure the ruling forbids. It was tried; the ruling caught it; this is the
 * other way round.
 *
 * So the two stay apart. A player raising a formation out of a sword domain is
 * rare and goes through `raiseFormation`. A house having a wall around its seat
 * is ordinary and goes through here. What they share is the OBJECT: both write
 * a `kind: 'formation'` row with `power` and `data.ratedWhole` on it, so
 * everything downstream - the decay model, the damage model, the read that asks
 * what is standing over a place - sees one kind of thing and needs no branch.
 *
 * ── AND "WHO MADE IT" IS STILL THE WHOLE OF ITS STRENGTH ─────────────────
 *
 * A house's ward stands at what the house could FIELD when it was laid, which
 * is `sectThreat(...).acting` - the same figure a declaration is weighed
 * against, and not `powerOrdinal`, which includes a one-off nobody would spend
 * on masonry. A great house has a great wall because great people cut it.
 *
 * ── AND WHEN, WHICH IS THE OTHER HALF ────────────────────────────────────
 *
 * A ward thins, and `effectiveWardOrdinal` already models it. A house's ward is
 * dated to its own last peak - the last time it had somebody worth calling one,
 * which is when a house lays or renews its warding - so a house that has
 * produced nobody in an age is standing behind something laid in that age. That
 * is exactly the house whose walls turn out to be thinner than its name, and it
 * is why upkeep is worth paying.
 */

import { SECTS } from '../../data/cultivation/index.js';
import { getFactionCharacter } from '../../data/cultivation/faction-character.js';
import { sectThreat } from '../../data/cultivation/sects.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { makeObject, type ObjectRecord } from './possessions.js';
import type { WorldState } from './world-state.js';

/**
 * How far a house's own reach carries into the ground it stands on.
 *
 * One, and it is not a dial. A wall cut by people who work at a rung IS a wall
 * at that rung: there is no reason a house's masonry should come out weaker
 * than the hands that cut it, and no reason it should come out stronger. Any
 * figure but one here would be a balance decision wearing a physical claim.
 */
const A_WALL_IS_AS_GOOD_AS_THE_HANDS_THAT_CUT_IT = 1;

/**
 * A ward over every seated house, at what that house could field when it laid one.
 *
 * Called from `seeding.ts` beside the other things a house is sitting on, and
 * shaped exactly like them: pure, deterministic, and producing rows for
 * `state.objects` rather than writing anything itself.
 */
export function seedHouseWards(state: WorldState): ObjectRecord[] {
    const out: ObjectRecord[] = [];
    const today = Math.floor(state.currentDay);

    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null) continue;
        if (house.seatLocationId === null) continue;

        const acting = sectThreat(house.id)?.acting ?? 0;
        if (acting <= 0) continue;
        const standsAt = Math.round(acting * A_WALL_IS_AS_GOOD_AS_THE_HANDS_THAT_CUT_IT);

        // Dated to the last time this house had somebody worth calling a peak.
        // Falling back to the founding is the oldest honest answer, and makes
        // the ward correspondingly thin - which is the right answer for a house
        // whose catalog says nothing about a peak at all.
        const sinceThePeak = getFactionCharacter(house.id)?.production.yearsSinceLastPeak ?? 0;
        const raisedOnDay = Math.max(
            house.foundedOnDay ?? 0,
            today - Math.round(Math.max(0, sinceThePeak) * DAYS_PER_YEAR)
        );

        const name = SECTS.find(s => s.id === house.id)?.name ?? house.name;
        const row = makeObject({
            id: `ward-${house.id}`,
            name: `the standing ward of ${name}`,
            kind: 'formation',
            significance: 'notable',
            description:
                `Cut into the ground the ${name} compound stands on, in the season a house does `
                + 'this and by whoever it could put on the work. It is not on anybody\'s sheet '
                + 'and nobody alive necessarily knows how it was laid.',
            // Nobody holds it. A ward cannot be carried, which is the whole of
            // what it is: it stands where it was made or it does not stand.
            possessorId: null,
            ownerId: house.id,
            ownerName: name,
            power: standsAt,
            locationId: house.seatLocationId,
            tags: ['formation', 'defensive', 'a_house_seat'],
            data: {
                stance: 'defensive',
                raisedOnDay,
                // The rung it was whole at, in the field `object-damage.ts`
                // reads when it mends one and the decay read compares against.
                ratedWhole: standsAt,
                // Said outright, so a reader of the row is never left thinking
                // a person practised something to put this here.
                laidBy: 'the house itself'
            }
        });
        row.provenance.push({
            onDay: raisedOnDay,
            holderId: null,
            holderName: name,
            how: 'crafted',
            source: name,
            previousHolderId: null,
            previousHolderName: null,
            factId: null,
            note:
                `Laid at ${standsAt}, which is what ${name} could put on the work. A house's `
                + 'ward is as good as the hands that cut it and thins from the day it is done.'
        });
        out.push(row);
    }

    return out;
}
