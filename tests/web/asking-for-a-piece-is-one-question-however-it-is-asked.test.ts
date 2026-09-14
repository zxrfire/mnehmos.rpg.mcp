/**
 * Asking a thing that can refuse for a piece of itself, in the words people use.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The encounter was built - the offer ladder, the refusal that names the rung,
 * the grant, the wound that takes centuries to close, the shame in front of
 * whoever watched - and exactly one shape of sentence reached it: a haggle. So
 * the road was only open to a player who had already named a figure, and the
 * whole content of the encounter is that a figure is the wrong thing to name.
 *
 * Measured on the deterministic reader before this landed:
 *
 *     "I offer the <one> thirty stones for a <piece>"  -> interact / trade
 *     "I ask the <one> for a <piece>"                  -> request / a_thing
 *
 * and only the first reached it. The second fell through `request` into
 * `interact` with the intent `negotiate` - which is in `ATTEMPT_INTENTS`, so
 * the sentence that is the encounter's own name for itself pressed the
 * creature and spent a day of the player's life on a road that could never
 * arrive.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THE FIX IS, AND WHY IT IS NOT A BRANCH ON A VERB
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `src/web/README.md` forbids reading a parsed intent to pick a result. So the
 * door is not opened by the word the player reached for: it is opened by WHO
 * IS ACROSS THE TABLE AND WHAT WAS NAMED - a thing that speaks, standing on
 * ground it lives on, asked for a piece of its own body - all of which are
 * read out of the world. Both roads ask that same question, so the test below
 * plays both and requires the SAME ANSWER rather than checking that a
 * particular branch ran.
 *
 * AND IT STAYS OFF `ATTEMPT_INTENTS`, on the reasoning `trade` is off it. This
 * presses nobody: what decides is the rung the creature is on, which moves on
 * an open account and not on how hard anybody pushed, and nothing is taken off
 * the asker. The cost is real and it is paid on the other side of the table -
 * a wound that does not close, and being known for having taken itself apart
 * because it was asked - which is the giver's, not the asker's clock.
 *
 * RED-CHECKED by removing the door from `GameService.request`: the ask falls
 * back to a negotiation, the two roads disagree, and the grant arm hands over
 * nothing.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld } from './harness';
import { resetCultivationWorlds } from '../../src/server/state/cultivation-world';
import { writeOneObligation } from '../../src/storage/repos/obligation.repo';
import { createObligation } from '../../src/engine/social/grudges';
import { parseIntent } from '../../src/web/verb-pattern-table';
import {
    beastsOnThisGround,
    readsAsSomebody
} from '../../src/engine/world/hunting-a-spirit-beast';
import { whatGroundThisIs } from '../../src/engine/world/what-ground-a-place-is';
import { thePieceTheyAskedFor } from '../../src/engine/world/what-it-costs-to-give-away-a-piece-of-yourself';
import { idOfTheOneOnThisGround } from '../../src/engine/world/a-beast-with-a-core-is-somebody-in-particular';
import { whereTheOfferLanded } from '../../src/engine/social-leverage/what-they-will-take-instead-of-money';
import { theRungTheyAreOn } from '../../src/web/asking-something-that-can-refuse-for-a-piece-of-it';

const read = (turn: { narration?: string | null }): string => turn.narration ?? '';

/** Standing in front of one that a favour would reach. Same shape as the sibling file. */
async function standingInFrontOfSomethingThatSpeaks(seed: string) {
    resetCultivationWorlds();
    const harness = await makeGameInWorld({ seed, worldSeed: `world-${seed}` });
    const { cultivator } = await harness.game.newRun('Lin Baoqing');

    const world = (await harness.game.loadWorld())!;

    // THE GROUND IS READ THE WAY THE VERB READS IT, biome included. Picking a
    // location off `qiDensity` alone and asking what lives there without the
    // biome selects a creature the running engine then does not put on that
    // ground - the arrangement and the play disagree, and the failure reads as
    // the routing being broken. Measured: the first cut of this file arranged
    // a White Ape at Cold Spring and played a blank look.
    const standing = world.locations
        .filter(place => place.qiDensity >= 60 || place.environment.resources.includes('qi'))
        .map(place => ({
            place,
            on: beastsOnThisGround({
                sealed: place.sealed,
                onAVein: true,
                grounds: whatGroundThisIs(world, place) ?? undefined
            }).filter(readsAsSomebody)
        }))
        .flatMap(({ place, on }) => on.map(one => ({
            place,
            one,
            id: idOfTheOneOnThisGround(one.id, place.id)
        })))
        .find(row => theRungTheyAreOn(row.id, row.one) === 'a favour');
    expect(standing, 'nowhere in the pinned world holds one a favour would reach')
        .toBeDefined();

    harness.db
        .prepare('UPDATE cultivators SET location = ?, spirit_stones = 5000 WHERE id = ?')
        .run(standing!.place.name, cultivator.id);

    return {
        ...harness,
        cultivatorId: cultivator.id,
        beast: standing!.one,
        partyId: standing!.id
    };
}

/** The account a kindness leaves. Held BY whoever paid it. */
function theyOweYou(db: unknown, holderId: string, subjectId: string): void {
    writeOneObligation(db as never, createObligation({
        kind: 'favor',
        holderId,
        subjectId,
        // `other` and not a named one: the catalog lists no cause for a
        // kindness of this shape, and nothing on this path branches on the
        // cause. It used to say `debt_unpaid`, which is not a cause this
        // engine has ever had.
        cause: 'other',
        severity: 'serious',
        onDay: 0,
        description: 'Did it a kindness it could not do for itself.'
    }));
}

describe('asking for a piece of somebody is one question however it is asked', () => {
    /**
     * THE TWO SENTENCES ARE DIFFERENT VERBS, and that is the point of pinning
     * it: if they ever converge on one verb the test below stops proving
     * anything and this line is what says so.
     */
    it('reaches the encounter from two different verbs', () => {
        expect(parseIntent('I ask the White Ape of the Gorge for a tuft of its fur').action)
            .toBe('request');
        expect(parseIntent('I haggle with the White Ape of the Gorge for a tuft').action)
            .toBe('interact');
    });

    it('answers a plain ask the same way it answers a haggle', async () => {
        // ONE SEED FOR BOTH ARMS. Two seeds arrange two creatures on two
        // pieces of ground, and the sentences would then differ for a reason
        // that has nothing to do with the road they took.
        const seed = 'two-roads-one-question';
        const asked = await standingInFrontOfSomethingThatSpeaks(seed);
        const piece = thePieceTheyAskedFor(asked.beast, null)!;
        const said = read(await asked.game.act(
            `I ask ${asked.beast.name} for a ${piece.material.name}`
        ));

        const haggled = await standingInFrontOfSomethingThatSpeaks(seed);
        expect(haggled.partyId, 'the two arms are not standing in the same place')
            .toBe(asked.partyId);
        const heard = read(await haggled.game.act(
            `I haggle with ${haggled.beast.name} for a ${piece.material.name}`
        ));

        // THE SAME QUESTION, so the same refusal, naming the same rung. Read
        // out of the ladder rather than typed here, for the reason the sibling
        // file gives: a figure with no provenance is a figure somebody edits.
        const wants = theRungTheyAreOn(asked.partyId, asked.beast);
        expect(wants, 'money bought a piece of somebody').not.toBe('stones');

        expect(said, 'the thing asked for was never named back')
            .toContain(piece.material.name);
        expect(said, 'the ask did not reach the encounter, so nothing named the rung')
            .toContain(whereTheOfferLanded(wants, 'stones').line);
        expect(said, 'the two roads answered the same question differently').toBe(heard);
    }, 180_000);

    /**
     * AND THE WHOLE ENCOUNTER IS REACHABLE FROM THE ASK, not just its refusal.
     * A road that can only be refused is not a road.
     */
    it('grants to an open account and puts the piece in the asker\'s hands', async () => {
        const { game, db, cultivatorId, beast, partyId } =
            await standingInFrontOfSomethingThatSpeaks('ask-road-granted');
        const piece = thePieceTheyAskedFor(beast, null)!;
        theyOweYou(db, cultivatorId, partyId);

        const said = read(await game.act(`I ask ${beast.name} for a ${piece.material.name}`));
        expect(said, 'nothing was handed over').toContain(piece.material.name);

        const held = db
            .prepare('SELECT quantity FROM cultivator_pouch WHERE holder_id = ? AND item_id = ?')
            .get(cultivatorId, piece.material.id) as { quantity: number } | undefined;
        expect(held?.quantity ?? 0, 'the material was narrated and never minted')
            .toBeGreaterThan(0);
    }, 180_000);

    /**
     * AND IT DOES NOT SWALLOW EVERY OTHER ASK PUT TO THE SAME CREATURE.
     *
     * `request` carries every ask there is, so a door on it that inferred the
     * thing would answer *"teach me an art"* and *"travel with me"* as
     * questions about the creature's fur. The guard is that the sentence has
     * to NAME a piece - which is the same guard read from the other end: what
     * is being asked decides where it goes, and a generic ask is not this one.
     */
    it.each([
        'to teach me an art',
        'to travel with me'
    ])('leaves "%s" to the road it belongs on', async tail => {
        const { game, beast } =
            await standingInFrontOfSomethingThatSpeaks('ask-road-not-every-ask');
        const piece = thePieceTheyAskedFor(beast, null)!;

        const said = read(await game.act(`I ask ${beast.name} ${tail}`));
        expect(said, 'an ask that named no piece was answered as an ask for one')
            .not.toContain(piece.material.name);
    }, 180_000);

    /**
     * AND IT COSTS THE ASKER NO TIME. The encounter is a question put and an
     * answer given; the price is a wound and a shame, and both are the
     * giver's. Putting the ask on the road that presses somebody and spends a
     * day would charge the asker for the other party's decision.
     */
    it('spends no day of the asker\'s life', async () => {
        const { game, db, cultivatorId, beast } =
            await standingInFrontOfSomethingThatSpeaks('ask-road-costs-nothing');
        const piece = thePieceTheyAskedFor(beast, null)!;

        const before = db
            .prepare('SELECT elapsed_days AS d FROM runs WHERE cultivator_id = ?')
            .get(cultivatorId) as { d: number };
        await game.act(`I ask ${beast.name} for a ${piece.material.name}`);
        const after = db
            .prepare('SELECT elapsed_days AS d FROM runs WHERE cultivator_id = ?')
            .get(cultivatorId) as { d: number };

        expect(after.d, 'asking pressed somebody and charged a day for it').toBe(before.d);
    }, 180_000);
});
