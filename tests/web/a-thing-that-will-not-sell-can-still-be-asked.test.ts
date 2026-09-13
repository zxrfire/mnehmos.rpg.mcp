/**
 * A thing that speaks holds no stock, and can still be asked.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE GAP THIS CLOSES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `THREE_ROADS_TO_WHAT_A_PERSON_CARRIES` has stated for some time that above
 * `BEAST_CHANGE_ORDINAL` a beast is a person, so its material may be asked for
 * rather than cut off a corpse, and that this is the only road to the
 * heaven-grade version a righteous house can walk at all. Nothing put the
 * question. Measured before this landed: every speaking entry in the catalog
 * carries `materialIds: []`, `whatComesOffTheBody` therefore returns an empty
 * harvest for all three, and the only sentence that reached one of them was
 * the hunt's refusal to swing.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IS PINNED HERE, AND WHY NOT THE OTHER THINGS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   a refusal names the rung   The ask sits below the cash line, so money is
 *                              refused before any arithmetic. The refusal has
 *                              to say what WOULD have worked, which is the
 *                              standing rule for every refusal in this engine.
 *   a grant costs the giver    A piece pulled out is a wound with a severity
 *                              and a number of years, and both are said.
 *
 * Neither assertion names a rung, a figure or a species. The rung is read back
 * out of the offer ladder, the years out of the regrowth ladder, and the
 * creature out of what the ground actually holds - a test that hard-coded any
 * of the three would fail on a catalog edit two subsystems away.
 *
 * RED-CHECKED. Removing the ladder's refusal from the price path leaves the
 * first case saying only the figure, and the first `it` fails on the rung.
 * Collapsing `whatGivingItCosts` to the mildest band leaves the second saying
 * 1 year rather than the grade's own figure, and the second `it` fails on the
 * years.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND ONE PRECONDITION THAT CANNOT BE REACHED BY PLAYING YET
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The FAVOUR rung is where a kindness puts you, and the kindness road runs
 * through `whatADeedLeaves`, which needs both sides to be a `Party` - an id, a
 * house, an alignment. A changed beast has no row in the world today, so there
 * is no way to do one a kindness by playing, and the account below is written
 * directly. That is a gap somebody has written down, not a licence: when a
 * changed beast carries a row, the kindness is an ordinary deed through the
 * ordinary ledger and this arrangement becomes a shortcut rather than the only
 * road.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld } from './harness';
import { resetCultivationWorlds } from '../../src/server/state/cultivation-world';
import { writeOneObligation } from '../../src/storage/repos/obligation.repo';
import { createObligation } from '../../src/engine/social/grudges';
import { BEASTS } from '../../src/data/cultivation/beasts';
import { beastsOnThisGround } from '../../src/engine/world/hunting-a-spirit-beast';
import {
    thePieceTheyAskedFor,
    whatGivingItCosts,
    theAskThisIs
} from '../../src/engine/world/what-it-costs-to-give-away-a-piece-of-yourself';
import {
    whatTheyWillTakeFor,
    whereTheOfferLanded
} from '../../src/engine/social-leverage/what-they-will-take-instead-of-money';

const read = (turn: { narration?: string | null }): string => turn.narration ?? '';

/**
 * The speaking thing this ground actually holds, read the way the verb reads
 * it. Naming one here would pin a catalog row rather than the behaviour.
 */
function theOneStandingHere() {
    const speaking = beastsOnThisGround({ sealed: false, onAVein: false })
        .filter(beast => beast.speaks);
    expect(speaking.length, 'no speaking thing is reachable from open ground')
        .toBeGreaterThan(0);
    return speaking[0];
}

async function standingInFrontOfIt(seed: string) {
    resetCultivationWorlds();
    const harness = await makeGameInWorld({ seed, worldSeed: `world-${seed}` });
    const { cultivator } = await harness.game.newRun('Lin Baoqing');
    harness.db
        .prepare('UPDATE cultivators SET spirit_stones = 5000 WHERE id = ?')
        .run(cultivator.id);
    return { ...harness, cultivatorId: cultivator.id };
}

describe('a thing that speaks holds no stock and can still be asked', () => {
    /**
     * MONEY IS THE WRONG KIND OF THING, AND THE REFUSAL SAYS SO.
     *
     * A purse of five thousand is deliberate: the figure is never what is
     * short, so a refusal that read as "you cannot afford it" would be a
     * different defect wearing this one's clothes.
     */
    it('refuses money for a piece of a body and names the rung that would have worked',
        async () => {
            const { game } = await standingInFrontOfIt('asked-and-refused');
            const beast = theOneStandingHere();
            const piece = thePieceTheyAskedFor(beast, null)!;

            const turn = await game.act(
                `I haggle with ${beast.name} for a ${piece.material.name}`
            );
            const said = read(turn);

            // The rung comes out of the ladder rather than out of this file,
            // and the sentence the ladder writes is the one that has to reach
            // the player.
            const wants = whatTheyWillTakeFor(beast.id, {
                ask: theAskThisIs(),
                hasACashPrice: false,
                theyNeedSomethingDone: beast.veinRelation === 'indifferent'
            });
            expect(wants, 'money bought a piece of somebody, which is the whole defect')
                .not.toBe('stones');
            const landed = whereTheOfferLanded(wants, 'stones');

            expect(said, 'the thing asked for was never named back').toContain(piece.material.name);
            expect(said, 'a refusal that does not say what would have worked')
                .toContain(landed.line);
        }, 180_000);

    /**
     * AND WHAT IT COSTS THE GIVER IS SAID, IN YEARS AND IN A WOUND.
     *
     * The years are read off the regrowth ladder rather than typed, because
     * that ladder is shared with what a district's ground takes to come back
     * and moving it must move this.
     */
    it('grants to an open account, and says what pulling it out cost', async () => {
        const { game, db, cultivatorId } = await standingInFrontOfIt('asked-and-granted');
        const beast = theOneStandingHere();
        const piece = thePieceTheyAskedFor(beast, null)!;

        // A favour is held BY whoever paid it. This one is the player's.
        writeOneObligation(db as never, createObligation({
            kind: 'favor',
            holderId: cultivatorId,
            subjectId: beast.id,
            cause: 'debt_unpaid',
            severity: 'serious',
            onDay: 0,
            description: 'Did it a kindness it could not do for itself.'
        }));

        const turn = await game.act(
            `I haggle with ${beast.name} for a ${piece.material.name}`
        );
        const said = read(turn);

        const cost = whatGivingItCosts({
            beast, piece, turn: 0, onDay: 0, seenBy: []
        });
        expect(said, 'nothing was handed over').toContain(piece.material.name);
        expect(said, 'the years it stays gone were not said')
            .toContain(`${cost.growsBackInYears} year`);

        // AND IT IS REALLY IN THEIR HANDS. A sentence saying so is not the
        // thing changing hands, which is the failure this half exists against.
        const held = db
            .prepare('SELECT quantity FROM cultivator_pouch WHERE holder_id = ? AND item_id = ?')
            .get(cultivatorId, piece.material.id) as { quantity: number } | undefined;
        expect(held?.quantity ?? 0, 'the material was narrated and never minted')
            .toBeGreaterThan(0);

        // THE ACCOUNT IS SPENT. One kindness must not buy a body twice.
        const open = db
            .prepare("SELECT status FROM obligations WHERE holder_id = ? AND subject_id = ?")
            .all(cultivatorId, beast.id) as Array<{ status: string }>;
        expect(open.every(row => row.status === 'settled'),
            'the favour is still open after it bought something').toBe(true);
    }, 180_000);

    /**
     * EVERY SPEAKING ENTRY CAN ANSWER THE QUESTION, which is the half a single
     * played turn cannot see. The contract is that they hold no stock; the
     * consequence has to be that they can still produce something, or the road
     * exists for one row and not for the kind.
     */
    it('has something to give for every speaking entry in the catalog', () => {
        for (const beast of BEASTS.filter(b => b.speaks)) {
            const piece = thePieceTheyAskedFor(beast, null);
            expect(piece, `${beast.id} could part with nothing at all`).not.toBeNull();
            expect(piece!.material.value, `${beast.id} has a piece worth nothing`)
                .toBeGreaterThan(0);
        }
    });
});
