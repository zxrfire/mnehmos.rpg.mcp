/**
 * Saying a house's name and getting a road, a town and a door.
 *
 * ── THE DEFECT, MEASURED ─────────────────────────────────────────────────
 *
 * Three pinned worlds, a starting player on day 0, 38 seated houses in each:
 * `I travel to the <house>` reached **0 of 38** in every one, and the answer
 * was *"You ask after Azure Cloud Pavilion and get the look people give a name
 * that is not a place."*
 *
 * Both halves were already built and neither knew about the other.
 * `seedSectGround` puts a `sect_seat` row in the world - a whole compound of
 * rooms hanging off it, with a gatehouse and a forecourt - and calls it
 * `<house> grounds`. `somewhereReal` matches a typed name against location
 * NAMES. So the compound existed, the road existed, and the only string that
 * reached either was one no player would ever type.
 *
 * And reaching the ground was not the same as meeting a door. The seat opens at
 * an entry threshold of zero - anybody may walk up to a gate - so the compound's
 * own walls did their work three courts further in and nothing at all happened
 * at the gate itself. `the-town-at-the-foot-of-a-house.ts` and
 * `standing-at-the-gate-of-a-house.ts` are the two halves of what was missing,
 * both derived from the house's own columns the way its rooms are.
 *
 * After: **38 of 38 in all three worlds.**
 *
 * ── WHAT IS PINNED HERE, AND WHAT IS NOT ─────────────────────────────────
 *
 * The three roads and the shape of the refusal, never a name, a count or a
 * house. Which house this world puts where is an artefact of the catalog
 * and of the seed, and both move. So every arm asks the ENGINE which house it
 * is about, reads the names out of the world, and asserts what the player would
 * notice:
 *
 *   turned away  the journey happens, the player ends up at the gate in the
 *                forecourt, and the refusal names the town outside the wall and
 *                what would change the answer rather than hiding the house.
 *                NOT HAVING THE STANDING TO GO IN IS NOT THE SAME AS SEEING
 *                NOTHING.
 *   belongs      this used to be "somebody on the roll is not stopped", read
 *                off the roll. A gate cannot see a roll: it reads a token,
 *                which is cut at the house (`what-your-house-has-issued-you.ts`).
 *                So a member arriving with nothing to show is stopped and
 *                asked, told there is no token to read and what would give
 *                them one. Nobody told the house to expect this one, so they
 *                are not entered either (`a-house-expects-somebody-it-took-
 *                on.ts`).
 *                `your-house-issues-you-its-token-at-its-seat.test.ts` holds
 *                the rest: a member carrying their token is not stopped.
 *   a guest      somebody who is owed by a host walks in behind them. Who may
 *                host is read off `ELDER_RUNG_FLOOR` - the rung below which no
 *                house makes an elder of anybody - and is not a new field.
 *
 * RED-CHECKED. With the redirect in `move` removed, the first arm fails on the
 * player never having left home; with `couldHostAGuest` widened to everybody on
 * the roll, the guest arm's control (an outer disciple who owes you cannot walk
 * you in) fails. And with the guest arm's settling turn made free again rather
 * than costly, the guest arm fails - which is the defect below.
 *
 * ── AND THE ARRANGEMENT HAS TO BE MADE IN THE WORLD THE ACT WILL SEE ─────
 *
 * The guest arm went red for a while and nothing about the guest road had
 * moved. It read its host out of the world on day 0 and then played a sentence,
 * and the first costly turn drags the world through a pass of its own before
 * the verb runs: the house it had chosen sent nine of its eleven modelled
 * people out on an errand that day and the other two died of old age, so the
 * gate read `0 could host` and a claim with nothing wrong with it failed.
 *
 * Two things were wrong here and both are fixed above: the house was taken by
 * ARRAY POSITION rather than asked for by the property the arm needs, and the
 * property was read one pass early. Measured after: the guest road walks the
 * player in at 12 of the 12 houses that still have somebody on the gate.
 *
 * The emptying itself is a live defect and is not this file's subject: 5 of 38
 * seated houses, on this world and on `strip-a`, have every living member in
 * one place that is not their own seat after the first advanced day. It is
 * reported where the sendings live. Written down here rather than left as a
 * silence, because the next person to see this arm go red should know what
 * else is in the neighbourhood.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { couldHostAGuest } from '../../src/engine/world/standing-at-the-gate-of-a-house';
import { writeOneObligation } from '../../src/storage/repos/obligation.repo';
import { createDebt } from '../../src/engine/social/grudges';
import { npcsStandingIn } from '../../src/engine/world/where-inside-a-house-somebody-is-standing';

const WORLD = 'a-house-you-can-walk-to';

/** A seated house, asked of the engine rather than named. */
function aSeatedHouse(world: { locations: any[]; factions: any[] }) {
    for (const house of everySeatedHouse(world)) return house;
    return null;
}

/** Every house with a seat, in the order the world holds them. */
function everySeatedHouse(world: { locations: any[]; factions: any[] }) {
    const out: { faction: any; seat: any }[] = [];
    for (const faction of world.factions) {
        const seat = world.locations.find(
            row => row.kind === 'sect_seat' && row.data?.factionId === faction.id
        );
        if (seat) out.push({ faction, seat });
    }
    return out;
}

/**
 * Who of a house is standing at its own gate, alive, on a rung.
 *
 * Read the way the gate reads it, down to the room: somebody of the house at a
 * talk is in the lecture hall and not at the gate, though their row names the
 * seat. See `where-inside-a-house-somebody-is-standing.ts`.
 */
function onTheGateOf(world: any, faction: any, seat: any) {
    return npcsStandingIn(world, seat.id).filter((n: any) =>
        n.factionId === faction.id
        && n.status !== 'physically_dead'
        && typeof n.factionRankIndex === 'number'
        && n.factionRankIndex >= 0);
}

/**
 * A house whose gate has both a host and an outer disciple standing at it.
 *
 * THE ARRANGEMENT IS ASKED FOR BY ITS PROPERTIES, NOT TAKEN BY POSITION, and
 * it is asked AFTER the world has moved. Both halves were defects and the
 * second one is the one that bit.
 *
 * `aSeatedHouse` returns the first faction in the array that has a seat, which
 * is an ordering the seeder chose. That house was Azure Cloud Pavilion, and on
 * the first advanced day the world sent nine of its eleven modelled people -
 * the pavilion master included - out on an errand, while the other two died of
 * old age. So the host this arm had picked out of the world a moment earlier
 * was three provinces away by the time the act ran, the gate read `0 could
 * host`, and the arm failed on a claim about the guest road that had nothing
 * wrong with it.
 *
 * MEASURED, on this world and on `strip-a`: 5 of 38 seated houses have every
 * living member in one place that is not their own seat after the first
 * advanced day, and the guest road itself walks the player in at 12 of the 12
 * houses that still have somebody on the gate when the sentence runs. The
 * emptying is a real defect and it is reported where the sendings live; it is
 * not this file's subject, and pinning it here would have made the guest road
 * untestable rather than testing the sending.
 */
function aHouseWhoseGateIsStaffed(world: any) {
    for (const { faction, seat } of everySeatedHouse(world)) {
        const atTheGate = onTheGateOf(world, faction, seat);
        const ranks: string[] = faction.ranks;
        const host = atTheGate.find(n => couldHostAGuest(n.factionRankIndex, ranks.length));
        const junior = [...atTheGate].sort(
            (a, b) => a.factionRankIndex - b.factionRankIndex)[0];
        if (host && junior && junior.factionRankIndex === 0) {
            return { faction, seat, atTheGate, host, junior };
        }
    }
    return null;
}

describe('a house is somewhere you can walk to', () => {
    it('lands a stranger at the gate and says what would open it', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'gate-stranger', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Stranger');
        const loaded = await game.loadWorld();
        expect(loaded, 'the run opened without a world').toBeTruthy();
        const world = loaded!;
        const found = aSeatedHouse(world);
        expect(found, 'this world seeded no house with a seat').not.toBeNull();
        const { faction, seat } = found!;

        const home = cultivator.location;
        const turn = await game.act(`I travel to the ${faction.name}`);
        const after = repos.cultivators.getById(cultivator.id)!.location;

        // THE JOURNEY HAPPENED. The defect this replaces refused it outright.
        expect(after, 'saying a house\'s name still went nowhere').not.toBe(home);
        // AND IT ENDED AT THE DOOR. The seat is the gate and the forecourt.
        expect(after).toBe(seat.name);

        const prose = turn.narration ?? '';
        // The house is named rather than hidden, the door is placed, the town
        // outside the wall is there to stand in, and the refusal carries what
        // would change it. Asserted as claims and not as sentences: the wording
        // is the narrator's and may move.
        expect(prose).toContain(faction.name);
        expect(prose.toLowerCase()).toContain('gate');
        expect(
            /forecourt/i.test(prose),
            'the player was refused and not told where that leaves them standing'
        ).toBe(true);
        expect(
            /outside the wall/i.test(prose),
            'there was nothing outside the wall to be turned away among'
        ).toBe(true);
        expect(
            /roll|applicant/i.test(prose),
            'the refusal said no and did not say what a place on the roll would do'
        ).toBe(true);
    }, 180_000);

    it('stops somebody of the house who has nothing to show, and does not enter them on nobody\'s word', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'gate-member', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Disciple');
        const loaded = await game.loadWorld();
        expect(loaded, 'the run opened without a world').toBeTruthy();
        const world = loaded!;
        const { faction, seat } = aSeatedHouse(world)!;

        // Arranged fast, which `AGENTS.md` permits: what is being measured is
        // the gate's answer to somebody on a roll, not how they got on it.
        repos.sects.addMember(faction.id, cultivator.id, 0);

        const turn = await game.act(`I travel to the ${faction.name}`);
        const after = repos.cultivators.getById(cultivator.id)!.location;
        expect(after, 'a member did not reach their own house').toBe(seat.name);

        const prose = turn.narration ?? '';
        expect(
            /no token to read/i.test(prose),
            'the gate let a member through on a roll it cannot see'
        ).toBe(true);
        expect(
            /turned away|takes no applicants|A place on the roll would open it/i.test(prose),
            'a member was read as a stranger rather than stopped as one of the house'
        ).toBe(false);
        expect(/Nobody at the gate was told to expect you/.test(prose), 'the gate did not say it had no word of them').toBe(true);
        expect(/Entered on the roll/.test(prose), 'entered on nobody\'s word').toBe(false);
    }, 180_000);

    it('walks somebody in behind a host who owes them, and not behind anybody else', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'gate-guest', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Guest');
        const opened = await game.loadWorld();
        expect(opened, 'the run opened without a world').toBeTruthy();

        // A DAY SPENT BEFORE ANYTHING IS ARRANGED, and it has to be a day the
        // world sees. The first costly turn drags the world through its own
        // first pass, which moves people; a host read out of the world before
        // that has happened is a host who may not be there when the sentence
        // runs. A free look will not do it - it spends nothing, so the world
        // stands still and the arrangement is made against a world one pass
        // behind the act. See `aHouseWhoseGateIsStaffed`.
        await game.act(`I travel to the ${aSeatedHouse(opened!)!.seat.name}`);
        const world = (await game.loadWorld())!;

        // WHO MAY HOST IS A RANK READING. Asked of the same function the gate
        // asks, so the test cannot disagree with the engine about which rung it
        // is - which is the ordering this repo has been bitten by before. And
        // read off the people the house actually has AT its gate, so the test
        // never has to move anybody and never disagrees with what the verb sees.
        const found = aHouseWhoseGateIsStaffed(world);
        expect(found, 'no house in this world has a staffed gate to be a guest at').toBeTruthy();
        const { faction, seat, host, junior } = found!;
        const ranks: string[] = faction.ranks;

        // THE CONTROL IS THE BOTTOM RUNG, picked by its rung and not by the
        // rule, so widening the rule cannot quietly delete the control. The
        // rung IS what this test is about, which is the one case AGENTS.md
        // allows a rank index to be pinned.
        expect(junior.factionRankIndex, 'no outer disciple is at this gate').toBe(0);
        expect(
            couldHostAGuest(junior.factionRankIndex, ranks.length),
            'the bottom rung of a house was allowed to walk an outsider in'
        ).toBe(false);
        const cannotHost = junior;

        const day = 0;
        repos.cultivators.update(cultivator.id, { location: seat.name });

        // ── THE CONTROL. The one who cannot host owes you, and it changes
        // nothing: a favour buys a request upward, not a door.
        if (cannotHost) {
            writeOneObligation(repos.db as any, createDebt({
                holderId: cannotHost.id,
                subjectId: cultivator.id,
                cause: 'saved_life',
                severity: 'serious',
                onDay: day,
                description: 'A debt owed by somebody who cannot open a door.'
            }));
            const control = await game.act(`I travel to the ${faction.name} grounds`);
            expect(
                // 'guest' alone will not do: the REFUSAL says the word too,
                // in the sentence naming the road. What only an opened door
                // says is somebody walking you through it.
                /walks you past|owes you, and it is that/i.test(control.narration ?? ''),
                'a junior who owes you walked you through a gate they cannot open'
            ).toBe(false);
        }

        // ── AND THE ROAD ITSELF. A host who owes you brings you in.
        writeOneObligation(repos.db as any, createDebt({
            holderId: host!.id,
            subjectId: cultivator.id,
            cause: 'saved_life',
            severity: 'serious',
            onDay: day,
            description: 'A debt owed by somebody who can open a door.'
        }));
        const turn = await game.act(`I travel to the ${faction.name} grounds`);
        const prose = turn.narration ?? '';
        expect(
            /walks you past|owes you, and it is that/i.test(prose),
            'a host who owes you did not bring you through'
        ).toBe(true);
    }, 180_000);
});
