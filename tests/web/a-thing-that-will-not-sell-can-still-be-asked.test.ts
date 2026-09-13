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
 * question. Measured before this landed: every open-world speaking entry
 * carries `materialIds: []`, so `whatComesOffTheBody` returns an empty harvest
 * for all of them, and the only sentence that reached one was the hunt's
 * refusal to swing.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE TWO ARMS, AND THE ONE THING THAT DIFFERS BETWEEN THEM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Both arms play the SAME sentence, on the same ground, against the same
 * creature, with the same purse. The only difference is whether the player has
 * an open account it owes them. Refused in one, granted in the other, which is
 * the design: asking is cheap to say and expensive to grant, and what moves it
 * is what you are to them rather than what you are holding.
 *
 * Nothing here names a rung, a figure, a species or a place. The rung is read
 * back out of the offer ladder, the years out of the regrowth ladder, and the
 * creature out of what the ground actually holds - a test that hard-coded any
 * of them would fail on a catalog edit two subsystems away.
 *
 * RED-CHECKED, both arms, by breaking the thing each protects:
 *   - dropping the ladder's line from the refusal path leaves the first arm
 *     with the figure and nothing about what would have worked, and it fails
 *     on the rung;
 *   - collapsing `whatGivingItCosts` to the mildest band leaves the second arm
 *     saying 1 year instead of the grade's own figure, and it fails on the
 *     years;
 *   - and returning the grant without minting leaves the pouch empty, which
 *     the second arm fails on separately from the prose.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND ONE PRECONDITION NOTHING CAN REACH BY PLAYING YET
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The FAVOUR rung is where a kindness puts you, and the kindness road runs
 * through `whatADeedLeaves`, which needs both sides to be a `Party` - an id, a
 * house, an alignment. A changed beast has no row in the world today, so there
 * is no way to do one a kindness by playing and the account below is written
 * straight into the ledger. That is a gap written down rather than licensed:
 * once a changed beast carries a row, the kindness is an ordinary deed through
 * the ordinary ledger and this arrangement becomes a shortcut instead of the
 * only road.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld } from './harness';
import { resetCultivationWorlds } from '../../src/server/state/cultivation-world';
import { writeOneObligation } from '../../src/storage/repos/obligation.repo';
import { createObligation } from '../../src/engine/social/grudges';
import { BEASTS, type Beast } from '../../src/data/cultivation/beasts';
import { beastsOnThisGround } from '../../src/engine/world/hunting-a-spirit-beast';
import { whatGroundThisIs } from '../../src/engine/world/what-ground-a-place-is';
import { thePieceTheyAskedFor } from '../../src/engine/world/what-it-costs-to-give-away-a-piece-of-yourself';
import { REGROWTH_YEARS_BY_GRADE } from '../../src/engine/world/what-a-place-still-has-in-the-ground';
import { whereTheOfferLanded } from '../../src/engine/social-leverage/what-they-will-take-instead-of-money';
import { idOfTheOneOnThisGround } from '../../src/engine/world/a-beast-with-a-core-is-somebody-in-particular';
import { theRungTheyAreOn } from '../../src/web/asking-something-that-can-refuse-for-a-piece-of-it';

const read = (turn: { narration?: string | null }): string => turn.narration ?? '';

/**
 * Standing on ground a speaking thing lives on, in front of one that a favour
 * would actually reach.
 *
 * THE RUNG IS WHAT PICKS THE CREATURE, not a name. The ladder puts a thing
 * that holds ground on the favour rung and a thing that wants nothing from the
 * earth on the service rung, and the second is a road this file does not
 * exercise because there is no ledger of services to stand on yet.
 */
async function standingInFrontOfSomethingThatSpeaks(seed: string) {
    resetCultivationWorlds();
    const harness = await makeGameInWorld({ seed, worldSeed: `world-${seed}` });
    const { cultivator } = await harness.game.newRun('Lin Baoqing');

    const world = (await harness.game.loadWorld())!;
    const onAVein = world.locations.filter(place => place.qiDensity >= 60);
    expect(onAVein.length, 'the pinned world has no ground rich enough to hold one')
        .toBeGreaterThan(0);

    // ── THE ARRANGEMENT HAS TO READ THE GROUND THE WAY THE VERB DOES ─────
    //
    // It used to take the first rich square and then ask the catalog what
    // speaks, with no ground in the question at all. That was the same answer
    // the verb gave while nothing passed a ground; it stopped being once
    // `whatGroundThisIs` landed, and the file failed as though the routing had
    // broken. A test that arranges a thing the verb cannot find is a second
    // opinion about where something lives.
    //
    // So it searches: the first rich square whose OWN ground holds something
    // that speaks and would take a favour. Nothing here is named - not the
    // place, not the species - which is what keeps it from going stale again.
    const standing = onAVein
        .map(place => {
            const speaking = beastsOnThisGround({
                sealed: place.sealed,
                onAVein: true,
                grounds: whatGroundThisIs(world, place) ?? undefined
            }).filter(one => one.speaks);
            const found = speaking
                .map(one => ({ one, id: idOfTheOneOnThisGround(one.id, place.id) }))
                .find(row => theRungTheyAreOn(row.id, row.one) === 'a favour');
            return found ? { place, found } : null;
        })
        .find((row): row is NonNullable<typeof row> => row !== null);
    expect(standing, 'no rich ground in the pinned world holds something that would take a favour')
        .toBeDefined();

    harness.db
        .prepare('UPDATE cultivators SET location = ?, spirit_stones = 5000 WHERE id = ?')
        .run(standing!.place.name, cultivator.id);

    return {
        ...harness,
        cultivatorId: cultivator.id,
        beast: standing!.found.one,
        partyId: standing!.found.id
    };
}

/** What a player types when they want a thing off somebody who has no stall. */
const theAsk = (beast: Beast, piece: string) => `I haggle with ${beast.name} for a ${piece}`;

describe('a thing that speaks holds no stock and can still be asked', () => {
    /**
     * MONEY IS THE WRONG KIND OF THING, AND THE REFUSAL SAYS SO.
     *
     * A purse of five thousand is deliberate: the figure is never what is
     * short, so a refusal reading as "you cannot afford it" would be a
     * different defect wearing this one's clothes.
     */
    it('refuses money for a piece of a body and names the rung that would have worked',
        async () => {
            const { game, beast, partyId } =
                await standingInFrontOfSomethingThatSpeaks('asked-and-refused');
            const piece = thePieceTheyAskedFor(beast, null)!;

            const said = read(await game.act(theAsk(beast, piece.material.name)));

            const wants = theRungTheyAreOn(partyId, beast);
            expect(wants, 'money bought a piece of somebody, which is the whole defect')
                .not.toBe('stones');

            expect(said, 'the thing asked for was never named back')
                .toContain(piece.material.name);
            expect(said, 'a refusal that does not say what would have worked')
                .toContain(whereTheOfferLanded(wants, 'stones').line);
        }, 180_000);

    /**
     * AND AN OPEN ACCOUNT IS WHAT MOVES IT, AT A PRICE PAID BY THE GIVER.
     *
     * The years come off the regrowth ladder rather than being typed here,
     * because that ladder is shared with what a district's ground takes to
     * come back and moving it has to move this.
     */
    it('grants to an open account, and says what pulling it out cost', async () => {
        const { game, db, cultivatorId, beast, partyId } =
            await standingInFrontOfSomethingThatSpeaks('asked-and-granted');
        const piece = thePieceTheyAskedFor(beast, null)!;

        // A favour is held BY whoever paid it. This one is the player's.
        writeOneObligation(db as never, createObligation({
            kind: 'favor',
            holderId: cultivatorId,
            subjectId: partyId,
            cause: 'debt_unpaid',
            severity: 'serious',
            onDay: 0,
            description: 'Did it a kindness it could not do for itself.'
        }));

        const said = read(await game.act(theAsk(beast, piece.material.name)));

        // AGAINST THE SHARED LADDER, NEVER AGAINST THE FUNCTION UNDER TEST.
        // Reading the figure back out of `whatGivingItCosts` made this
        // assertion move with the defect - the red check for it passed while
        // the cost had been collapsed to the mildest band.
        const years = REGROWTH_YEARS_BY_GRADE[piece.material.grade];
        expect(said, 'nothing was handed over').toContain(piece.material.name);
        expect(said, 'the years it stays gone were not said')
            .toContain(`${years} year`);

        // AND IT IS REALLY IN THEIR HANDS. A sentence saying so is not the
        // thing changing hands, which is the failure this half exists against.
        const held = db
            .prepare('SELECT quantity FROM cultivator_pouch WHERE holder_id = ? AND item_id = ?')
            .get(cultivatorId, piece.material.id) as { quantity: number } | undefined;
        expect(held?.quantity ?? 0, 'the material was narrated and never minted')
            .toBeGreaterThan(0);

        // THE ACCOUNT IS SPENT. One kindness must not buy a body twice.
        const rows = db
            .prepare('SELECT status FROM obligations WHERE holder_id = ? AND subject_id = ?')
            .all(cultivatorId, partyId) as Array<{ status: string }>;
        expect(rows.length, 'the account was never written').toBeGreaterThan(0);
        expect(rows.every(row => row.status === 'settled'),
            'the favour is still open after it bought something').toBe(true);
    }, 180_000);

    /**
     * EVERY SPEAKING ENTRY CAN ANSWER THE QUESTION, which is the half a played
     * turn cannot see. The contract is that they hold no stock; the
     * consequence has to be that they can still produce something, or the road
     * exists for one row rather than for the kind.
     */
    it('has something to give for every speaking entry in the catalog', () => {
        for (const beast of BEASTS.filter(one => one.speaks)) {
            const piece = thePieceTheyAskedFor(beast, null);
            expect(piece, `${beast.id} could part with nothing at all`).not.toBeNull();
            expect(piece!.material.value, `${beast.id} has a piece worth nothing`)
                .toBeGreaterThan(0);
        }
    });
});
