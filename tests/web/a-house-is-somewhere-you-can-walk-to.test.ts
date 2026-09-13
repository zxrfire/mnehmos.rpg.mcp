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
 * And there was nowhere to be turned away TO. The map went province, then wall,
 * so a gate that refused somebody would have left them standing on a road with
 * the house as a name again. `the-town-at-the-foot-of-a-house.ts` is the
 * missing square, derived from the house's own columns the way its rooms are.
 *
 * After: **38 of 38 in all three worlds.**
 *
 * ── WHAT IS PINNED HERE, AND WHAT IS NOT ─────────────────────────────────
 *
 * The three roads and the shape of the refusal, never a name, a rung, a count
 * or a town. Which house this world puts where is an artefact of the catalog
 * and of the seed, and both move. So every arm asks the ENGINE which house it
 * is about, reads the names out of the world, and asserts what the player would
 * notice:
 *
 *   turned away  the journey happens, the player ends up OUTSIDE, and the
 *                refusal names what would change it rather than hiding the
 *                house. NOT HAVING THE STANDING TO GO IN IS NOT THE SAME AS
 *                SEEING NOTHING.
 *   belongs      somebody on the roll is not stopped, and their road ends on
 *                the ground itself and not in the market below it.
 *   a guest      somebody who is owed by a host walks in behind them. Who may
 *                host is `authorityTier` above `ordered` and not a new field.
 *
 * RED-CHECKED. With the redirect in `move` removed, the first arm fails on the
 * player never having left home; with `couldHostAGuest` widened to everybody on
 * the roll, the guest arm's control (an outer disciple who owes you cannot walk
 * you in) fails.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { footTownId } from '../../src/engine/world/the-town-at-the-foot-of-a-house';
import { couldHostAGuest } from '../../src/engine/world/standing-at-the-gate-of-a-house';
import { writeOneObligation } from '../../src/storage/repos/obligation.repo';
import { createDebt } from '../../src/engine/social/grudges';

const WORLD = 'a-house-you-can-walk-to';

/** A seated house this world actually built a town for, asked of the engine. */
function aHouseWithATown(world: { locations: any[]; factions: any[] }) {
    for (const faction of world.factions) {
        const town = world.locations.find(row => row.id === footTownId(faction.id));
        const seat = world.locations.find(
            row => row.kind === 'sect_seat' && row.data?.factionId === faction.id
        );
        if (town && seat) return { faction, town, seat };
    }
    return null;
}

describe('a house is somewhere you can walk to', () => {
    it('lands a stranger in the town below the gate and says what would open it', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'gate-stranger', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Stranger');
        const world = await game.loadWorld();
        const found = aHouseWithATown(world);
        expect(found, 'this world seeded no house with a town below it').not.toBeNull();
        const { faction, town, seat } = found!;

        const home = cultivator.location;
        const turn = await game.act(`I travel to the ${faction.name}`);
        const after = repos.cultivators.getById(cultivator.id)!.location;

        // THE JOURNEY HAPPENED. The defect this replaces refused it outright.
        expect(after, 'saying a house\'s name still went nowhere').not.toBe(home);
        // AND IT ENDED OUTSIDE. A stranger does not walk into a compound.
        expect(after).toBe(town.name);
        expect(after).not.toBe(seat.name);

        const prose = turn.narration ?? '';
        // The house is named rather than hidden, the door is placed, and the
        // refusal carries what would change it. Asserted as claims and not as
        // sentences: the wording is the narrator's and may move.
        expect(prose).toContain(faction.name);
        expect(prose).toContain(seat.name);
        expect(prose.toLowerCase()).toContain('gate');
        expect(
            /roll|applicant/i.test(prose),
            'the refusal said no and did not say what a place on the roll would do'
        ).toBe(true);
    }, 180_000);

    it('does not stop somebody of the house, and their road ends on the ground', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'gate-member', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Disciple');
        const world = await game.loadWorld();
        const { faction, town, seat } = aHouseWithATown(world)!;

        // Arranged fast, which `AGENTS.md` permits: what is being measured is
        // the gate's answer to somebody on a roll, not how they got on it.
        repos.sects.addMember(faction.id, cultivator.id, 0);

        const turn = await game.act(`I travel to the ${faction.name}`);
        const after = repos.cultivators.getById(cultivator.id)!.location;
        expect(after, 'a member was routed to the market instead of home').toBe(seat.name);
        expect(after).not.toBe(town.name);

        const prose = turn.narration ?? '';
        expect(
            /not stop|does not stop|reads you as/i.test(prose),
            'the gate refused one of its own'
        ).toBe(true);
    }, 180_000);

    it('walks somebody in behind a host who owes them, and not behind anybody else', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'gate-guest', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Guest');
        const world = await game.loadWorld();
        const { faction, seat } = aHouseWithATown(world)!;

        // WHO MAY HOST IS A RANK READING. Asked of the same function the gate
        // asks, so the test cannot disagree with the engine about which rung it
        // is - which is the ordering this repo has been bitten by before.
        const ranks: string[] = faction.ranks;
        // Read off the people the house actually has AT its gate, so the test
        // never has to move anybody and never disagrees with what the verb sees.
        const atTheGate = world.npcs.filter((n: any) =>
            n.factionId === faction.id
            && n.locationId === seat.id
            && typeof n.factionRankIndex === 'number'
            && n.factionRankIndex >= 0);
        const host = atTheGate.find((n: any) => couldHostAGuest(n.factionRankIndex, ranks.length));
        expect(host, 'this house has nobody at its gate who could host').toBeTruthy();

        // THE CONTROL IS THE BOTTOM RUNG, picked by its rung and not by the
        // rule, so widening the rule cannot quietly delete the control. The
        // rung IS what this test is about, which is the one case AGENTS.md
        // allows a rank index to be pinned.
        const junior = [...atTheGate].sort(
            (a: any, b: any) => a.factionRankIndex - b.factionRankIndex
        )[0];
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
            holderId: host.id,
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
