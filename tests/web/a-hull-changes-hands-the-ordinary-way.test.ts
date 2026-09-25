/**
 * A hull is bought the way anything else is bought.
 *
 * ── THE RULING ───────────────────────────────────────────────────────────
 *
 * The design owner, asked whether a craft wanted a verb of its own: *"no, the
 * regular barter/sale/trade process."* So there is no craft verb, no craft
 * intent, and no second code path - a hull goes down the road a blade and a
 * sealed medicine already go down, and if it needed its own road the ruling was
 * broken.
 *
 * ── WHAT WAS MISSING, AND IT WAS NOT THE ENGINE ──────────────────────────
 *
 * The engine half was complete. Four hulls are seeded, `whatACraftWouldFetch`
 * prices one against the dearest craft the commission table prices, and
 * `boughtFromItsOwner` moves the register. Nothing a player could SAY reached
 * any of it:
 *
 *   theThingAskedFor   asked five catalogs and not the conveyance one, so
 *                      "what would you take for a spirit boat" came back
 *                      "nothing in the world is called that a person would
 *                      barter over" - a false sentence about the catalog.
 *   thisRowIs          knew four id conventions and not `data.conveyanceId`,
 *                      so even a resolved ask found no holder.
 *   the close          called `transferPossession` under a comment saying it
 *                      was a sale: no `purchase` claim was ever minted, and
 *                      `possessorId` was set to the buyer unconditionally.
 *
 * That last one is why a craft mattered more than a fifth catalog. A moored
 * hull has `possessorId === null` on purpose - `craft()` and `mintCraft` both
 * set it, because a hull with a possessor is one `bestObjectHeldBy` would arm
 * somebody with - and the bare move would have towed it onto the buyer's back.
 * `boughtFromItsOwner` DERIVES it: a thing nobody was carrying is a thing
 * nobody is carrying now.
 *
 * ── WHAT IS PINNED ───────────────────────────────────────────────────────
 *
 * Played, on a pinned world and a pinned run, end to end: ask a house's price
 * for a hull, be told the bar AND the figure, put something down that reaches
 * it, and come away owning a boat that has not moved an inch.
 *
 * The social roll IS seeded and the outcome here was stable over three
 * consecutive runs of the same two seeds. If it drifts, the thing that moved is
 * `resolveAttempt` or what feeds it, not this file's subject - the register
 * assertions are the point and the `taken` is the fixture.
 *
 * Red-checked, run and reverted: putting `transferPossession` back at the close
 * fails on *the hull was towed onto the buyer*, with `possessorId` holding the
 * player's id. The claim assertions sit after it and never ran, so what that arm
 * proves is the possession half; the claim half is held by
 * `a-house-sells-what-it-built.test.ts`, which owns `boughtFromItsOwner` and is
 * the only thing that mints one.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { parseIntent } from '../../src/web/actions.js';
import { ARTIFACTS } from '../../src/data/cultivation/artifacts.js';
import { makeObject } from '../../src/engine/world/possessions.js';
import { whatACraftWouldFetch } from '../../src/engine/world/a-house-sells-what-it-built.js';
import {
    theThingAskedFor,
    thisRowIs,
    heldByTheirHouse
} from '../../src/web/what-a-holder-would-take-for-it.js';

const WORLD = 'a-hull-changes-hands';
const RUN = 'hull-a';
const HULL = 'conv-spirit-boat';

describe('a hull is reachable by a sentence', () => {
    /**
     * THE KIND, NOT THE FIVE NAMES. A hull the world builds during a run is
     * minted as `obj-craft-<house>-<year>` with a name no catalog holds, so an
     * ask that could only resolve the five seeded names would answer for the
     * furniture and not for the world.
     */
    it('answers for a craft by its kind and by a hull\'s own name', () => {
        const byKind = theThingAskedFor('a spirit boat', null);
        expect(byKind, 'the conveyance catalog is still not asked').not.toBeNull();
        expect(byKind!.id).toBe(HULL);
        expect(byKind!.pastTheCashLine, 'no counter in the world carries one').toBe(true);
        // The article is off, because every sentence downstream writes `a ${name}`.
        expect(byKind!.name.toLowerCase()).not.toMatch(/^an? /);

        // And the same words with the other article, which is what a player
        // says about the one they were just told about.
        expect(theThingAskedFor('the spirit boat', null)?.id).toBe(HULL);

        const byName = theThingAskedFor('The Cloud Ladder', null);
        expect(byName, 'a named hull in the catalog answers to its own name').not.toBeNull();
        expect(byName!.id).toBe('craft-the-long-answer');
    });

    /** What it would fetch is read off the commission table, never typed here. */
    it('quotes the figure the engine derives and not one of its own', () => {
        const fetches = whatACraftWouldFetch(HULL);
        expect(fetches).not.toBeNull();
        const said = theThingAskedFor('a spirit boat', null)!.whatMovesOne;
        expect(said, 'a player is told the bar and never the price').toBeDefined();
        expect(said).toContain(fetches!.toLocaleString('en-US'));
    });

    /**
     * The one field every craft row carries, seeded or built. Without it a
     * resolved ask finds no holder and the refusal says nobody in the world has
     * one while four houses are sitting on hulls.
     */
    it('finds a craft row by the conveyance it is', () => {
        const row = makeObject({
            id: 'obj-craft-somebody-1200',
            name: 'A hull with no catalog row',
            kind: 'artifact',
            significance: 'significant',
            ownerId: 'a-house',
            ownerName: 'A house',
            possessorId: null,
            data: { conveyanceId: HULL }
        });
        expect(thisRowIs(row, HULL)).toBe(true);
        expect(thisRowIs(row, 'conv-carriage-heaven')).toBe(false);
        // AND A MOORED THING IS STILL ON THEIR SHELF. Nobody carrying it is not
        // somebody else carrying it.
        expect(heldByTheirHouse({ objects: [row] } as never, 'a-house', HULL)).toBe(row);
    });
});

describe('played: a hull changes hands through the ordinary trade path', () => {
    it('is asked after, priced, and bought, with no verb of its own', async () => {
        const { game, repos } = await makeGameInWorld({ seed: RUN, worldSeed: WORLD });
        const { cultivator } = await game.newRun('Shipwright');
        const world = (await game.loadWorld())!;

        // WHOSE HULL, ASKED OF THE WORLD. A name here would pin the catalog.
        const hull = world.objects.find(
            row => row.data?.conveyanceId === HULL && row.ownerId !== null)!;
        expect(hull, 'this world seeded no owned hull').toBeTruthy();
        expect(hull.possessorId, 'a hull is moored, never carried').toBeNull();
        const house = world.factions.find(f => f.id === hull.ownerId)!;
        const speaker = world.npcs.find(
            n => n.factionId === house.id && n.status === 'alive'
                && n.locationId === house.seatLocationId)!;
        expect(speaker, 'nobody of that house is standing on its own ground').toBeTruthy();
        const where = world.locations.find(l => l.id === speaker.locationId)!;

        repos.cultivators.update(cultivator.id, {
            location: where.name,
            // Somebody a house will sit down with. The ask is refused on
            // standing otherwise, which is a different rule and not this one.
            realmOrdinal: 30
        });

        // ── NO NEW VERB ──────────────────────────────────────────────────
        const sentence = `ask ${speaker.name} what they would take for a spirit boat`;
        expect(parseIntent(sentence).action, 'a hull reached a verb of its own').toBe('request');

        const asked = await game.act(sentence);
        const heard = asked.narration ?? '';
        expect(heard, 'the house cannot say what it would take').toMatch(/what it would take/i);
        expect(heard, 'the player was given a bar and no price').toContain(
            whatACraftWouldFetch(HULL)!.toLocaleString('en-US'));

        // ── AND SOMETHING THAT REACHES THE BAR ───────────────────────────
        const heavy = [...ARTIFACTS]
            .filter(a => (a.power ?? 0) >= 30 && a.significance !== 'mundane')
            .sort((a, b) => (b.power ?? 0) - (a.power ?? 0))[0]!;
        world.objects.push(makeObject({
            id: heavy.id,
            name: heavy.name,
            kind: 'artifact',
            significance: 'legendary',
            power: heavy.power ?? 40,
            ownerId: cultivator.id,
            ownerName: cultivator.name,
            possessorId: cultivator.id
        }));

        const traded = await game.act(
            `I offer ${speaker.name} ${heavy.name} for a spirit boat`);
        expect(traded.narration ?? '', 'the trade did not land on this seed').toMatch(
            /takes what you offered/i);

        // ── THE REGISTER MOVED AND THE HULL DID NOT ──────────────────────
        const after = (await game.loadWorld())!.objects.find(row => row.id === hull.id)!;
        expect(after.ownerId, 'the register did not move').toBe(cultivator.id);
        expect(
            after.possessorId,
            'the hull was towed onto the buyer - possession was passed, not derived'
        ).toBeNull();

        const claim = after.claims.find(c => c.basis === 'purchase');
        expect(claim, 'a sale minted no claim').toBeTruthy();
        expect(claim!.claimantId).toBe(cultivator.id);
        expect(
            claim!.acknowledgedByIds,
            'a sale needs exactly one party\'s word and has it: the seller\'s'
        ).toContain(house.id);
        // A sale that was not for stones says so rather than recording a price
        // of nothing.
        expect(claim!.note).not.toMatch(/for 0 stones/);

        // AND THE PROSE AGREES WITH THE ROW IT JUST WROTE.
        expect(traded.narration ?? '').not.toMatch(/spirit boat is in your pouch/i);
    }, 300_000);
});
