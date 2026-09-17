/**
 * Who takes the player on, and whether anybody is taking people on here at all.
 *
 * The design owner, on joining a house with nobody of it there: *"How is that
 * possible? Houses hold selection ceremonies at their sect grounds too. They
 * aren't open 365 days a year. They send people out looking for seedlings, and
 * open up recruitment once every x years."*
 *
 * So `sect_manage.join` is refused before the house weighs anybody, unless one
 * of two things is true where the player is standing today:
 *
 *   in person      somebody of the house out looking for disciples is here
 *                  (`isOutLookingForDisciples`)
 *   a selection    the house's grounds are open (`theSelectionOpenOn`) and the
 *                  player is in them, or the intake its paper named for this
 *                  place is being held (`anIntakeHeldHere`)
 *
 * Whoever that is took them on: they owe the house the report
 * `a-house-expects-somebody-it-took-on.ts` is about, exactly as a recruiter of
 * the world's own does, and the player knows their name, which is what they say
 * at the gate. Outside both, the refusal says when and where the house next
 * takes people, so there is somewhere to go.
 *
 * Only where a world is open. With none there is nothing to read the house's
 * people or grounds off, and the join is weighed as it always was.
 */

import {
    deliverWhatTheyOweTheHouse,
    theyOweTheHouseAReport,
    whoTookThemOn
} from '../engine/world/a-house-expects-somebody-it-took-on.js';
import { worldIdForCatalogPerson } from '../engine/world/a-catalog-person-and-their-world-row.js';
import {
    anIntakeHeldHere,
    housesThatHaveToAdvertise
} from '../engine/world/houses-that-have-to-advertise-for-disciples.js';
import { isTheWorldsToMove, type NpcRecord } from '../engine/world/npc-state.js';
import { isInsideTheCompound } from '../engine/world/a-recruit-is-given-their-lamp-at-the-house.js';
import {
    A_SELECTION_RUNS_FOR_DAYS,
    isOutLookingForDisciples,
    theNextSelection,
    theSelectionOpenOn
} from '../engine/world/when-a-house-takes-people-on.js';
import { getLocation, type WorldState } from '../engine/world/world-state.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { placeName } from './facts.js';
import type { GameService } from './turn-engine.js';
import { openDoorsInTheWorld, postingGroundOf, provinceOfPlace } from './what-is-posted-on-the-wall-here.js';

export type HowYouWereTakenOn = 'in person' | 'at its selection' | 'at its intake';

export type WhoIsTakingPeopleOnHere =
    | { taking: true; how: HowYouWereTakenOn; recruiter: { npcId: string; knownAs: string; name: string } }
    | { taking: false; refusal: string; structure: string };

/**
 * Whether anybody of this house is taking people on where this cultivator is
 * standing today, and who. Null where there is no world to read it off.
 */
export function whoIsTakingPeopleOnHere(
    game: GameService,
    cultivator: Cultivator,
    run: Pick<Run, 'seed' | 'elapsedDays'>,
    houseId: string
): WhoIsTakingPeopleOnHere | null {
    const world = game.atHand;
    if (!world) return null;
    const house = world.factions.find(f => f.id === houseId && f.dissolvedOnDay === null) ?? null;
    if (!house) return null;

    const onDay = Math.floor(run.elapsedDays);
    const here = game.worldPlaceOf(cultivator);
    const byId = new Map(world.locations.map(l => [l.id, l]));
    const ofTheHouseHere = presentOfTheHouse(game, cultivator, world, houseId);
    const mostSenior = (rows: typeof ofTheHouseHere) => [...rows].sort((a, b) =>
        b.npc.factionRankIndex - a.npc.factionRankIndex || (a.npc.id < b.npc.id ? -1 : 1))[0] ?? null;

    // IN PERSON: somebody out looking for disciples, standing here.
    const looking = mostSenior(ofTheHouseHere.filter(row => isOutLookingForDisciples(row.npc.activity)));
    if (looking) return { taking: true, how: 'in person', recruiter: recruiterOf(looking) };

    // A SELECTION: its grounds open and the player in them, or its intake here.
    const seat = house.seatLocationId;
    const atItsGrounds = seat !== null && here !== null && isInsideTheCompound(byId, here, seat);
    const selection = atItsGrounds ? theSelectionOpenOn(run.seed, houseId, onDay) : null;
    const place = placeName(cultivator);
    const ground = postingGroundOf(place);
    const wall = {
        field: openDoorsInTheWorld(), placeName: place, ground,
        placeProvinceId: provinceOfPlace(place), onDay, seed: run.seed
    };
    const intake = selection === null && ground !== 'unplaceable'
        ? anIntakeHeldHere(wall, houseId, A_SELECTION_RUNS_FOR_DAYS)
        : null;
    if (selection !== null || intake !== null) {
        const runner = mostSenior(ofTheHouseHere);
        const fromTheHouse = runner === null
            ? whoTookThemOn(world.npcs, {
                houseId,
                personId: cultivator.id,
                placeId: here,
                // Whoever the house sent to run it, which is anybody of it:
                // the ranking puts somebody at its grounds first.
                inReach: () => true,
                atTheHouse: id => seat !== null && isInsideTheCompound(byId, id, seat)
            })
            : null;
        const recruiter = runner !== null
            ? recruiterOf(runner)
            : fromTheHouse !== null
                ? { npcId: fromTheHouse.id, knownAs: fromTheHouse.id, name: fromTheHouse.name }
                : null;
        if (recruiter !== null) {
            return { taking: true, how: selection !== null ? 'at its selection' : 'at its intake', recruiter };
        }
    }

    // NOBODY, AND WHERE TO GO INSTEAD.
    const next = theNextSelection(run.seed, houseId, onDay);
    const seatName = seat === null ? null : getLocation(world, seat)?.name ?? null;
    const posts = housesThatHaveToAdvertise(wall.field).some(h => h.id === houseId && h.postsInPublic);
    const parts = [`Nobody of ${house.name} is taking anybody on here today.`];
    if (seatName !== null) {
        parts.push(next.opensOnDay <= onDay
            ? `Its grounds at ${seatName} are open to people who want to be taken on until `
              + `${daysFrom(next.closesOnDay - onDay)}.`
            : `It next opens its grounds at ${seatName} to people who want to be taken on in `
              + `${next.opensOnDay - onDay} days, for ${A_SELECTION_RUNS_FOR_DAYS} days.`);
    }
    if (posts) parts.push('It also holds intakes in towns in its province, and says where on the paper it puts up.');
    parts.push('Its people go out looking for disciples, and one of them can take you on wherever they find you.');
    return {
        taking: false,
        refusal: parts.join(' '),
        structure: `whoIsTakingPeopleOnHere(${houseId}): nobody. ${ofTheHouseHere.length} of the house here, none `
            + `out looking for disciples; at its grounds: ${atItsGrounds}; next selection opens day `
            + `${next.opensOnDay}; posts intakes: ${posts}.`
    };
}

function daysFrom(days: number): string {
    return days <= 0 ? 'the end of today' : `${days} day${days === 1 ? '' : 's'} from now`;
}

function presentOfTheHouse(
    game: GameService,
    cultivator: Cultivator,
    world: WorldState,
    houseId: string
): { knownAs: string; name: string; npc: NpcRecord }[] {
    const out: { knownAs: string; name: string; npc: NpcRecord }[] = [];
    for (const row of game.present(cultivator)) {
        if (row.sectId !== houseId || row.id === cultivator.id) continue;
        const npc = world.npcs.find(n => n.id === row.id)
            ?? world.npcs.find(n => n.id === worldIdForCatalogPerson(row.id));
        if (!npc || npc.status !== 'alive' || npc.factionId !== houseId || !isTheWorldsToMove(npc)) continue;
        out.push({ knownAs: row.id, name: row.name, npc });
    }
    return out;
}

function recruiterOf(row: { knownAs: string; name: string; npc: NpcRecord }) {
    return { npcId: row.npc.id, knownAs: row.knownAs, name: row.name };
}

export interface WhoTookYouOn {
    /** Facts for the player. */
    lines: string[];
    /** Inspector only. */
    structure: string;
}

/**
 * They were taken on: whoever took them on owes the house a report of it - made
 * at once where that happened inside the house's compound - and the player knows
 * who took them on.
 */
export function whoTookYouOn(
    game: GameService,
    cultivator: Cultivator,
    houseId: string,
    taken: Extract<WhoIsTakingPeopleOnHere, { taking: true }>
): WhoTookYouOn | null {
    const world = game.atHand;
    if (!world || !cultivator.alive) return null;
    const house = world.factions.find(f => f.id === houseId) ?? null;
    if (!house) return null;

    const day = Math.floor(world.currentDay);
    const here = game.worldPlaceOf(cultivator);
    const { recruiter } = taken;
    theyOweTheHouseAReport(world, recruiter.npcId, {
        houseId,
        person: { id: cultivator.id, name: cultivator.name },
        placeId: here,
        onDay: day
    });
    const byId = new Map(world.locations.map(l => [l.id, l]));
    // Made at once only where they were taken on inside the house's compound:
    // a selection at its grounds is in front of the house.
    const atTheHouse = house.seatLocationId !== null && isInsideTheCompound(byId, here, house.seatLocationId);
    const reported = atTheHouse ? deliverWhatTheyOweTheHouse(world, recruiter.npcId, houseId, day) : 0;

    game.knowledge.learnIfNew({
        holderId: cultivator.id,
        kind: 'cultivator',
        id: recruiter.knownAs,
        name: recruiter.name,
        onDay: day,
        sourceKind: 'witnessed',
        sourceNote: 'They took this cultivator on for their house.',
        stage: 'encountered',
        statement: `${recruiter.name} of ${house.name} took them on.`
    });
    game.theWorldMoved();

    const where = here === null ? null : byId.get(here)?.name ?? null;
    const line = `${recruiter.name} took you on for ${house.name} ${taken.how}${where ? ` at ${where}` : ''}. `
        + (reported > 0
            ? 'They told the house\'s Internal Affairs office, here in its compound.'
            : 'They owe the house\'s Internal Affairs office word of it, and the house has none yet.');
    return {
        lines: [line],
        structure: `theyOweTheHouseAReport: ${recruiter.npcId} for ${cultivator.id} to ${houseId} ${taken.how}`
            + (reported > 0 ? '; delivered at once (theHouseExpects).' : '; owed.')
    };
}
