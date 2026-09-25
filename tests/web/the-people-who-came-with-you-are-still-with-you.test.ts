/**
 * A player could not go anywhere with anybody.
 *
 * Measured before the change, across `ACTION_NAMES`: fifty-eight verbs, four of
 * which cover distance - `move`, `ride`, `fold`, `passage` - and not one of them
 * had any notion of a second person on the road. `ride` passed `heads: 1` to
 * `priceJourney` as a literal, `passage` passed `heads: 1` and the player's own
 * rung as `worstPassengerOrdinal`, and `move` never asked. The world's own
 * parties were rich by comparison: `whoTheHouseCanSend` picks one, the world sim
 * writes `out_with_a_party` on everybody in it, and `bringHomeWhoeverIsDue`
 * brings them home on the term. The player was outside all of it.
 *
 * ── WHAT THESE ASSERT, AND WHAT THEY DELIBERATELY DO NOT ─────────────────
 *
 * The claim is behavioural and is the whole of the ruling: the people travelling
 * with you are still with you when you arrive. So the assertion is that they are
 * STANDING THERE - the same `locationId` read `othersPresent` uses to decide who
 * is in a square - and not that any particular sentence was printed or that any
 * record exists. There is no party record to assert on by design: who is with
 * you is read off each companion's own `out_with_a_party` activity, which is the
 * fact the world already keeps.
 *
 * ── WHAT THEY CAUGHT, AND IT WAS A CLOCK ────────────────────────────────
 *
 * Two of the three went red and stayed red, on a defect neither of them names:
 * the party's term was written on `Run.elapsedDays` and every reader of it runs
 * on `WorldState.currentDay`. A world opens at day 365,000 and a run at day 0,
 * so a party the player raised was 364,600 days overdue the moment it existed;
 * `bringHomeWhoeverIsDue` sent everybody home and cleared the activity on the
 * world advance inside that same turn, and the player walked to Ren's Stair
 * alone with the companions' rows still standing at Bronze Gong Cliff.
 *
 * It is the failure this repo keeps finding: the party was built correctly and
 * the thing it was routed through could not reach it. The verbs now take the
 * world's day and no caller states one - `theDayAPartyIsOn` in
 * `travel-verbs.ts` is the single answer, and a term in days is what a caller
 * passes.
 *
 * RED-CHECKED. With the `theyArrivedWithYou` call removed from `move`, the
 * arrival assertion fails on the companion still standing at the place they
 * started from; with `whoIsWithYouOnTheRoad` returning `[]` in `fold`, the fold
 * refusal test goes green-to-red the other way and the fold resolves.
 *
 * ── THE SEAM THIS DOES NOT COVER, SAID PLAINLY ───────────────────────────
 *
 * `goWhereTheHouseSentYou` accepts an escort and immediately spends the whole
 * term in one `shortSkip`, so an escort that runs to completion puts a party on
 * the road and takes it off again inside one turn. The party is only travellable
 * with when the term is cut short, which `aTermCutShort` says is common and
 * which nothing here forces. That is a gap in the escort verb rather than in the
 * party, and it is written down in `OPEN-QUESTIONS.md`.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { SECTS } from '../../src/data/cultivation/index';
import { summonsPool } from '../../src/engine/encounters/duties';
import { dutyFromOffer, membershipFor } from '../../src/web/encounters';
import { rememberSummons } from '../../src/web/pending-summons';
import { whoASeniorIsAskedToTakeOut } from '../../src/engine/encounters/who-a-senior-is-asked-to-take-out';
import { whoIsOnTheRoadWith } from '../../src/engine/world/who-is-on-the-road-with-you';

const HOUSE = SECTS
    .filter(sect => sect.recruits)
    .reduce((best, sect) =>
        sect.admissionOrdinal < best.admissionOrdinal
        || (sect.admissionOrdinal === best.admissionOrdinal && sect.id < best.id)
            ? sect : best);

/** The world row for wherever this cultivator is standing. */
function placeRow(game: any, location: string | null) {
    const here = (location ?? '').trim().toLowerCase();
    return (game.atHand?.locations ?? [])
        .find((row: { name: string }) => row.name.toLowerCase() === here) ?? null;
}

/** Somewhere in the world that is not here. */
function somewhereElse(game: any, location: string | null): string {
    const here = (location ?? '').toLowerCase();
    // A PLACE SOMEBODY STANDS IN. This took the first row of any kind, which is
    // a province, and a province is a container nobody stands on: travelling to
    // one now ends at its largest town (`whereTheRoadEndsIn`), so the party is
    // standing in the town and not on the row this picked.
    const found = (game.atHand?.locations ?? [])
        .filter((row: { kind: string }) => row.kind === 'settlement')
        .map((row: { name: string }) => row.name)
        .find((name: string) => name.toLowerCase() !== here);
    expect(found, 'the world has nowhere else in it').toBeDefined();
    return found as string;
}

/**
 * Somewhere this world says two other people are standing.
 *
 * WHAT THIS REPLACES, AND WHY IT IS NOT A WEAKER FIXTURE. The helper below used
 * to take whoever the birth draw opened beside and require two of them. That is
 * a coincidence, and it broke when the world moved: measured across 480 (world,
 * birth) pairs at the population `createWorld` actually uses, the opening square
 * holds nobody at all in 0.6% of them, exactly one other body in 10%, and fewer
 * than three in 25%. `world-road-party-move` drew one of the single-body ones
 * and this file went red on the draw rather than on the party.
 *
 * So the square is read off the world and the cultivator is stood in it. Where
 * a run happens to open is not what anything below asserts; who is still with
 * you when you arrive is.
 */
function standWhereTwoOthersAre(game: any, cultivator: any): any {
    const world = game.atHand;
    const heads = new Map<string, number>();
    for (const npc of world.npcs) {
        if (npc.status !== 'alive' || npc.id === cultivator.id) continue;
        if (npc.locationId === null) continue;
        heads.set(npc.locationId, (heads.get(npc.locationId) ?? 0) + 1);
    }
    // The square they are already in, when it will do - a test that moves when
    // it does not have to is a test measuring a different situation than the
    // one a player meets.
    const standing = placeRow(game, cultivator.location);
    if (standing && (heads.get(standing.id) ?? 0) >= 2) return cultivator;

    // Otherwise the smallest square that holds two, by id so the choice does
    // not depend on the order `locations` came back in - and of the same KIND
    // as the one a run opens in, because a `region` row is a container nobody
    // stands in rather than a square, and putting the player on one arranges a
    // situation no player is ever in.
    const kind = standing?.kind ?? 'settlement';
    const chosen = (world.locations ?? [])
        .filter((row: { id: string; kind: string }) =>
            row.kind === kind && (heads.get(row.id) ?? 0) >= 2)
        .sort((a: { id: string }, b: { id: string }) =>
            (heads.get(a.id)! - heads.get(b.id)!) || (a.id < b.id ? -1 : 1))[0];
    expect(chosen, 'this world holds no square with two people standing in it')
        .toBeDefined();
    game.repos.cultivators.update(cultivator.id, { location: chosen.name });
    return game.repos.cultivators.getById(cultivator.id)!;
}

/**
 * Two people from the world, standing where the player is, put on the road with
 * them.
 *
 * Arranged by calling the producer rather than by playing an escort, per
 * AGENTS.md on preconditions: the escort path is played in its own test below,
 * and a fixture that needs a 2.8% summons roll to land is a fixture that goes
 * flaky.
 */
function twoOfThemOnTheRoad(game: any, starting: any, forDays = 400) {
    const cultivator = standWhereTwoOthersAre(game, starting);
    const here = placeRow(game, cultivator.location);
    expect(here, 'the player is standing nowhere the world holds').not.toBeNull();
    const locals = game.atHand.npcs
        .filter((npc: any) => npc.locationId === here.id && npc.status === 'alive'
            && npc.id !== cultivator.id)
        .slice(0, 2);
    expect(locals.length, 'nobody is standing here to take along').toBe(2);

    const names = game.putThemOnTheRoadWithYou(
        cultivator,
        locals.map((npc: any) => ({ id: npc.id, name: npc.name })),
        { note: 'Out on the road together.', forDays }
    );
    expect(names.length).toBe(2);
    // The cultivator row as it now stands, because the helper may have moved
    // them and a caller reading the pre-move one would travel from the wrong
    // square.
    return { here, party: locals, names, cultivator };
}

describe('the people who came with you', () => {
    it('are standing where you arrived, having walked it', async () => {
        const { game } = await makeGameInWorld({
            seed: 'road-party-move', worldSeed: 'world-road-party-move'
        });
        const { cultivator: born } = await game.newRun('Wen Shu');
        const { here, party, names, cultivator } = twoOfThemOnTheRoad(game as any, born);

        const going = somewhereElse(game as any, cultivator.location);
        const turn = await game.act(`I travel to ${going}`);

        const world = (game as any).atHand;
        const arrived = placeRow(game as any, going);
        expect(arrived, 'the destination has no world row').not.toBeNull();
        expect(arrived.id, 'the journey was to where they started').not.toBe(here.id);

        for (const member of party) {
            const now = world.npcs.find((npc: any) => npc.id === member.id);
            expect(now.locationId, `${member.name} did not come`).toBe(arrived.id);
        }

        // AND THE ENGINE SAID SO, in the channel a narrator cannot drop.
        const said = JSON.stringify(turn);
        for (const name of names) expect(said, `${name} was not mentioned`).toContain(name);
    }, 300_000);

    it('are not taken through a fold, and the refusal says what would take them', async () => {
        const { game } = await makeGameInWorld({
            seed: 'road-party-fold', worldSeed: 'world-road-party-fold'
        });
        const { cultivator: born } = await game.newRun('Wen Shu');
        const { here, party, cultivator } = twoOfThemOnTheRoad(game as any, born);

        const going = somewhereElse(game as any, cultivator.location);
        const turn = await game.act(`I fold space to ${going}`);

        const world = (game as any).atHand;
        for (const member of party) {
            const now = world.npcs.find((npc: any) => npc.id === member.id);
            expect(now.locationId, `${member.name} was folded`).toBe(here.id);
        }
        const after = game.repos.cultivators.getById(cultivator.id)!;
        expect((after.location ?? '').toLowerCase(), 'the player folded away from them')
            .toBe((cultivator.location ?? '').toLowerCase());

        // A REFUSAL THAT NAMES THE ROUTE. The standing rule in AGENTS.md: not
        // being able to do a thing is not the same as being told nothing.
        const said = JSON.stringify(turn).toLowerCase();
        expect(said).toContain('passenger');
        expect(said).toMatch(/road|span|put them on/);
    }, 300_000);

    it('is what saying yes to an escort actually does', async () => {
        const { game, repos, db } = await makeGameInWorld({
            seed: 'road-party-escort', worldSeed: 'world-road-party-escort'
        }) as any;
        const { cultivator } = await game.newRun('Wen Shu');
        db.prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?')
            .run(20, cultivator.id);
        repos.sects.addMember(HOUSE.id, cultivator.id, 2);
        const senior = repos.cultivators.getById(cultivator.id)!;

        // A REAL DUTY OFF THE REAL POOL, and a real party off the real roll.
        // Only the summons ROLL is bypassed; nothing here is a hand-written
        // duty shaped to make the assertion pass.
        const membership = membershipFor(
            { repos, knowledge: game.knowledge, world: game.atHand } as any, senior
        );
        const pool = summonsPool(senior.realmOrdinal, membership);
        expect(pool.length, 'the house has nothing to ask of them').toBeGreaterThan(0);
        const candidate = pool[0];
        const duty = dutyFromOffer(candidate, membership, 0);

        const roster = game.atHand.npcs
            .filter((npc: any) => npc.factionId === HOUSE.id && npc.status === 'alive')
            .map((npc: any) => ({
                id: npc.id,
                name: npc.name,
                rankIndex: npc.factionRankIndex,
                realmOrdinal: npc.cultivation.realmOrdinal
            }));
        const takingOut = whoASeniorIsAskedToTakeOut({
            pitchOrdinal: duty.pitchOrdinal,
            hands: Math.max(2, duty.cohort),
            roster,
            seniorId: senior.id,
            seniorOrdinal: senior.realmOrdinal
        });
        expect(takingOut.length, 'the house has nobody junior enough to send')
            .toBeGreaterThan(0);

        // The day they leave on, off the world's clock, which is the clock an
        // activity's term is written on. Read BEFORE the turn, because accepting
        // spends the term.
        const leftOn = Math.floor(game.atHand.currentDay);

        rememberSummons(repos, senior.id, {
            duty: { ...duty, takingOut, cohort: takingOut.length },
            entryId: candidate.entry.id,
            what: `${candidate.entry.name}, put to them by name.`,
            spokenOnDay: 0
        });

        const turn = await game.act('I accept');
        const said = JSON.stringify(turn);
        for (const member of takingOut) {
            expect(said, `${member.name} was never named`).toContain(member.name);
        }

        // The activity is the fact, and it was written on each of them. Read
        // back through the same function the travel verbs use, on the day they
        // were put on the road rather than today - the term may already have
        // been spent by the span, which is the seam this test's header names.
        const onTheRoad = whoIsOnTheRoadWith(game.atHand.npcs, senior.id, leftOn);
        expect(onTheRoad.map(npc => npc.id).sort())
            .toEqual(takingOut.map(member => member.id).sort());
    }, 300_000);
});
