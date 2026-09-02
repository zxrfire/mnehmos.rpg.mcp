/**
 * THE ACCEPTANCE TEST FOR THE BARTER TIER, PLAYED.
 *
 * Every heaven-grade and above cure in the catalog was unobtainable in play,
 * and the game said so in a sentence nothing accepted. `see a physician` on a
 * crippling meridian tear named the medicine, named its grade, and ended:
 *
 *   Nobody sells one of these for stones. Not at a high price, not at an
 *   absurd one... what they will listen to is a favour owed, something out of
 *   a hole nobody else has been down, or an art.
 *
 * `request` sends anything that is not an art to `interact`, whose own comment
 * says the honest thing - it does not invent a way to hand objects over - so
 * there was no verb for stating a need and asking what it would take, and none
 * for putting down something that was not money.
 *
 * WHAT THIS ASSERTS IS THE WHOLE CHAIN, IN ONE RUN, THROUGH `game.act`: the
 * world holds one, somebody speaks for the house that holds it, the price can
 * be asked, money is worth nothing against it, an art of the right height is
 * worth exactly enough, and the pill ends up in the pouch. Anything less than
 * the last clause is a module with tests rather than a feature - `AGENTS.md`
 * is explicit that the definition of done is somebody reaching it by doing
 * something.
 *
 * THE WORLD SEED IS PINNED AND SO IS THE RUN SEED, because a run seed without
 * a world seed pins a coincidence. What is NOT pinned is which house or which
 * person: those are found by reading the world, so a catalog or seeder change
 * moves the names and the test still measures the claim.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { TECHNIQUES } from '../../src/data/cultivation/techniques';
import { heldByTheirHouse } from '../../src/web/what-a-holder-would-take-for-it';

const WORLD = 'a-cure-that-is-not-for-sale';
const THE_CURE = 'pill-meridian-rebirth';

interface Said { narration?: string; error?: string }

/** The whole of what the player reads, however the layer wrapped it. */
function heard(said: Said): string {
    return said.error ?? said.narration ?? JSON.stringify(said);
}

/**
 * NOT EVERY HOLDER IS A SELLER, AND THAT IS THE DESIGN RATHER THAN A NUISANCE.
 *
 * Found by running this test. The first person who speaks for a house holding
 * one, on the first seed tried, answered:
 *
 *   They are not holding this against a day that may come. They need it, and
 *   they need it now, so there is no figure and no trade.
 *
 * That is `will_not_part_with_it_at_any_price` out of the want model, driven by
 * a deadline derived from that person's own clocks - the case `AGENTS.md` says
 * the design cares about most, and which the model's author measured as
 * impossible to reach before the derivation landed. Somebody whose own need is
 * present is not a seller at any figure.
 *
 * So a test that grabbed the first holder would be pinning which of the two
 * arms that seed happened to draw. This walks them until it finds one whose
 * claim can wait, which is the population the claim is actually about, and
 * fails with a real finding if there is nobody like that anywhere.
 */
async function somebodyWhoWouldTradeAtAll(
    db: { prepare(sql: string): { run(...args: unknown[]): unknown } },
    game: { act(input: string): Promise<unknown> },
    cultivatorId: string,
    speakers: readonly { name: string; locationId: string | null }[],
    knownTechniqueIds: string
): Promise<{ name: string; locationId: string | null; answer: string } | null> {
    for (const speaker of speakers) {
        db.prepare(
            'update cultivators set location = ?, realm_ordinal = ?, spirit_stones = ?, '
            + 'known_techniques = ? where id = ?'
        ).run(speaker.locationId, 20, 50_000, knownTechniqueIds, cultivatorId);

        const answer = heard(await game.act(
            `ask ${speaker.name} what they would take for a Meridian Rebirth Pill`
        ) as Said);
        if (answer.includes('not for money')) {
            return { name: speaker.name, locationId: speaker.locationId, answer };
        }
    }
    return null;
}

describe('reaching a cure that is not for sale', () => {
    it('walks the chain from the price question to the pill in the pouch', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'a-cure-run', worldSeed: WORLD, adminMode: true
        });
        const { cultivator } = await game.newRun('Probe');
        const world = await game.loadWorld();
        expect(world, 'the world has to be on for any of this').not.toBeNull();

        // ── THE WORLD IS HOLDING SOME ───────────────────────────────────
        //
        // Read rather than arranged. `seedPillStock` puts a barter pill on any
        // house working near the band it is pitched at, so this is the seeder's
        // own answer and not a fixture. If it ever reads zero, the verb below
        // is unreachable and that is the finding.
        const holders = world!.objects.filter(o =>
            o.kind === 'pill' && o.data?.pillId === THE_CURE && o.data?.spent !== true);
        expect(holders.length, 'no house in the world is holding one').toBeGreaterThan(0);

        // ── AND SOMEBODY SPEAKS FOR ONE OF THOSE HOUSES ─────────────────
        //
        // The object is the house's and the decision is a person's, which is
        // why the barter verb is put to somebody rather than filed at a vault.
        const speakers = world!.npcs.filter(n =>
            n.locationId !== null && holders.some(h => h.ownerId === n.factionId));
        expect(speakers.length, 'nobody in the world speaks for a house holding one')
            .toBeGreaterThan(0);

        // Preconditions, arranged rather than asserted, which is what the admin
        // surface is for: stand the asker in front of them, at a height where
        // the conversation is possible, holding one thing worth having.
        const road = TECHNIQUES.find(t => t.grade === 'heaven');
        expect(road, 'no heaven-grade art in the catalog to offer').toBeDefined();

        // ── ONE: THE PRICE CAN BE ASKED, AND SOMEBODY WILL NAME ONE ─────
        const willing = await somebodyWhoWouldTradeAtAll(
            db, game, cultivator.id, speakers.slice(0, 12), JSON.stringify([road!.id])
        );
        expect(willing, 'every holder in reach had a present need - see the helper')
            .not.toBeNull();
        const speaker = { name: willing!.name };

        /**
         * RE-PINNED BEFORE EVERY SENTENCE, AND THE REASON IS A REAL ONE.
         *
         * Each of these attempts spends days - an offer whose price is not met
         * weighs `against_their_interest`, which is fourteen of them - and the
         * world moves in that time. Measured: by the third sentence the person
         * had walked off and the answer was the roster refusal, *"you have a
         * name for none of them"*, which is `interact` being exactly right
         * about a room the test had not meant to change.
         *
         * Standing the asker back in front of them is arranging the situation,
         * which is what the admin surface is for. Nothing here asserts an
         * outcome.
         */
        const standWithThem = (): void => {
            db.prepare('update cultivators set location = ? where id = ?')
                .run(willing!.locationId, cultivator.id);
        };

        // The refusal carries the figure, which is the whole point of the verb.
        expect(willing!.answer).toMatch(/rung \d+/);
        expect(willing!.answer).toContain('Name what you have, not what you can pay.');

        // The exact row that is about to change hands, so the once-only guard
        // below can name it rather than counting.
        const theirHouse = world!.npcs.find(n => n.name === willing!.name)?.factionId ?? null;
        const traded = holders.find(h => h.ownerId === theirHouse);
        expect(traded, 'the willing speaker speaks for no house holding one').toBeDefined();

        // The sentence the design owner actually wrote, which names nobody and
        // is said to whoever you are dealing with.
        // The sentence the design owner actually wrote. It names nobody, so it
        // lands on whoever the player could walk up to - which is the person
        // just spoken to, standing in the same square.
        standWithThem();
        const nameless = heard(await game.act(
            "I need a Meridian Rebirth Pill, what's your price?"
        ));
        expect(nameless).toMatch(/rung \d+|need it now|simply say yes/);

        // ── TWO: AN ART OF THE RIGHT HEIGHT PAYS FOR IT ────────────────────
        const outcomes: string[] = [];
        let took = false;
        for (let attempt = 0; attempt < 12 && !took; attempt++) {
            standWithThem();
            const text = heard(await game.act(
                `I offer ${speaker.name} the ${road!.name} for a Meridian Rebirth Pill`
            ));
            // The price is met on every one of these, whatever the roll did.
            expect(text).toContain('serves them at least as well as keeping it does');
            took = /is in your pouch/.test(text);
            outcomes.push(
                took ? 'took'
                    : /does not close the door/.test(text) ? 'countered' : 'refused'
            );
        }

        // ── AND THE OBJECT ACTUALLY MOVED ───────────────────────────────
        //
        // The clause that separates this from a module with tests. A trade the
        // player is told landed and that leaves the pouch empty is the narrator
        // asserting an outcome the database never took.
        expect(took, `never landed in 12 tries: ${outcomes.join(', ')}`).toBe(true);
        const pouch = db.prepare(
            'select quantity from cultivator_pouch where cultivator_id = ? and item_id = ?'
        ).get(cultivator.id, THE_CURE) as { quantity: number } | undefined;
        expect(pouch?.quantity ?? 0).toBeGreaterThan(0);

        // ── AND IT IS WORTH IT EXACTLY ONCE ─────────────────────────────
        //
        // The defect this guards is an infinite-duplication exploit on the
        // scarcest class of object in the world. The first version of the trade
        // inserted a pouch row and left the shelf alone, so the same house
        // could be traded with again and again and the world gained a
        // heaven-grade pill each time - out of nothing, in an economy whose
        // whole shape rests on there being almost none. Measured elsewhere:
        // 2373 deaths over six seeds and forty years, none at the heaven band
        // or above, so the legitimate supply is empty as arithmetic and any
        // duplication IS the supply.
        //
        // Asserted from the world state and from what the verb says, because
        // those are two different claims and both have to hold: the row moved,
        // and the game knows it moved.
        const worldAfter = await game.loadWorld();
        const stillOnTheirShelf = worldAfter!.objects.filter(o =>
            o.kind === 'pill' && o.data?.pillId === THE_CURE && o.data?.spent !== true
            && (o.possessorId === traded!.ownerId || o.ownerId === traded!.ownerId));
        expect(stillOnTheirShelf, 'the house is still holding one after selling it')
            .toHaveLength(0);

        // The world holds exactly as many as it did. Possession moved; nothing
        // was created.
        const worldTotalAfter = worldAfter!.objects.filter(o =>
            o.kind === 'pill' && o.data?.pillId === THE_CURE && o.data?.spent !== true).length;
        expect(worldTotalAfter).toBe(holders.length);

        // And the record says whose it was, on what day, for what. An object
        // arriving with no history is the signature of something stolen.
        const mine = worldAfter!.objects.find(o => o.id === traded!.id);
        expect(mine?.possessorId).toBe(cultivator.id);
        expect(mine?.ownerId).toBe(cultivator.id);
        const link = mine!.provenance[mine!.provenance.length - 1];
        expect(link.previousHolderId).toBe(traded!.ownerId);
        expect(link.note).toContain('Not sold for stones');

        // ── AND THE VERB SAYS SO WHEN ASKED AGAIN ───────────────────────
        //
        // `heldByTheirHouse` is the function the verb itself reads to decide
        // whether there is anything to price, so this is the verb's own answer
        // rather than a paraphrase of it.
        expect(heldByTheirHouse(worldAfter, theirHouse, THE_CURE)).toBeNull();

        // ── WHY THIS LEG IS NOT ASSERTED THROUGH A TYPED SENTENCE ───────
        //
        // It was, and it was flaky for a reason that has nothing to do with
        // this verb. By the time the trade has landed, forty-odd days have gone
        // by - the helper spends one per speaker it tries and each attempt
        // spends three - and the person has walked off, so the re-ask comes
        // back as the roster refusal: *"you have a name for none of them.
        // Somebody has to be introduced, or overheard, before they can be asked
        // for anything."* That is `interact` being exactly right about a room
        // this test did not mean to change, and pinning around it would mean
        // either asserting a sentence that is not about scarcity or accepting
        // two possible answers, which is a guard that cannot fail.
        //
        // `heldByTheirHouse` above IS the verb's answer rather than a
        // paraphrase of it: it is the function `whatWouldItTake` calls to
        // decide whether there is anything to price, and null is precisely what
        // makes it say "has no Meridian Rebirth Pill to price". The claim is
        // asserted where it is decided.
    }, 300_000);

    /**
     * MONEY IS WORTH NOTHING AGAINST IT, AND IS STILL ALLOWED TO BE OFFERED.
     *
     * Its own run because an offer whose price is not met weighs
     * `against_their_interest` - fourteen days - and the person walks off in
     * them, which is `interact` being right about a room rather than anything
     * to do with this verb.
     */
    it('prices four hundred thousand stones at nothing, and says what would work', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'a-cure-money', worldSeed: WORLD, adminMode: true
        });
        const { cultivator } = await game.newRun('Probe');
        const world = await game.loadWorld();
        const holders = world!.objects.filter(o =>
            o.kind === 'pill' && o.data?.pillId === THE_CURE && o.data?.spent !== true);
        const speakers = world!.npcs.filter(n =>
            n.locationId !== null && holders.some(h => h.ownerId === n.factionId));
        const road = TECHNIQUES.find(t => t.grade === 'heaven')!;

        const willing = await somebodyWhoWouldTradeAtAll(
            db, game, cultivator.id, speakers.slice(0, 12), JSON.stringify([road.id])
        );
        expect(willing).not.toBeNull();

        const said = heard(await game.act(
            `I offer ${willing!.name} 400000 spirit stones for a Meridian Rebirth Pill`
        ));
        // `items.md`: above the line cash "is simply not the medium. Not
        // 'expensive' - not for sale." A fungible offer is priced at nothing
        // here however large, and the answer says what would work instead.
        expect(said).toContain('nothing anybody could hold');
        expect(said).toContain('Name what you have, not what you can pay.');
    }, 300_000);

    /**
     * THE FIFTH OUTCOME, REACHED BY PLAYING.
     *
     * Somebody who wants what is in front of them and does not agree has not
     * refused - they have named terms. The guard is that this outcome is
     * REACHABLE, because an outcome nothing produces is the same defect as a
     * module nothing calls.
     *
     * The asker is stood LOW on purpose, so the standing term keeps most
     * attempts from landing and the failure mode under test is the one that
     * comes back.
     */
    it('answers a met price that did not land with terms rather than a no', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'a-cure-counter', worldSeed: WORLD, adminMode: true
        });
        const { cultivator } = await game.newRun('Probe');
        const world = await game.loadWorld();
        const holders = world!.objects.filter(o =>
            o.kind === 'pill' && o.data?.pillId === THE_CURE && o.data?.spent !== true);
        const speakers = world!.npcs.filter(n =>
            n.locationId !== null && holders.some(h => h.ownerId === n.factionId));
        const road = TECHNIQUES.find(t => t.grade === 'heaven')!;

        const willing = await somebodyWhoWouldTradeAtAll(
            db, game, cultivator.id, speakers.slice(0, 12), JSON.stringify([road.id])
        );
        expect(willing).not.toBeNull();

        let countered = false;
        for (let attempt = 0; attempt < 14 && !countered; attempt++) {
            db.prepare(
                'update cultivators set location = ?, realm_ordinal = ? where id = ?'
            ).run(willing!.locationId, 6, cultivator.id);
            const text = heard(await game.act(
                `I offer ${willing!.name} the ${road.name} for a Meridian Rebirth Pill`
            ));
            countered = /does not close the door/.test(text);
            if (countered) {
                // A counter-offer is an opening. It must not read as a rebuff.
                expect(text).toContain('They want something, they have said so');
            }
        }
        expect(countered, 'the fifth outcome never fired in play').toBe(true);
    }, 300_000);
});
