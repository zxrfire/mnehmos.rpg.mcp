/**
 * The board is what the house needs doing, and the loop it feeds turns.
 *
 * The design owner: *"missions, they need to rank up to inner by completing
 * missions that gives rewards. autogenerate them."*
 *
 * MEASURED THROUGH THE BOARD'S OWN API BEFORE ANY OF THIS WAS WRITTEN, because
 * a claim about a gap is worth nothing without the number. `sectBoardFor` read
 * the hand-authored catalogue and handed a player:
 *
 *     ordinal  0  Qi Condensation            1 offer, worth 10 contribution
 *     ordinal 12  Qi Condensation            3 offers
 *     ordinal 13  Foundation Establishment   2 offers
 *     ordinal 16  Foundation Establishment   1 offer
 *     ordinal 17  Core Formation             NOTHING
 *     ... and nothing at every rung above that, all the way to Immortal.
 *
 * Against a first promotion that costs 100 contribution. So the loop could not
 * turn at the bottom and did not exist at all above Foundation Establishment.
 *
 * What fixed it was not a bigger catalogue. A house in this world ALREADY
 * decides to put people on the road, for reasons gated on its own state, and a
 * mission is one of those sendings offered to the player instead of to an NPC.
 */

import { describe, expect, it } from 'vitest';
import { makeGame } from './harness';
import { sectBoardFor } from '../../src/web/encounters';
import { REALM_TIERS } from '../../src/engine/cultivation/realms';
import {
    whatAHouseHasOnItsBoard,
    whichPostingTheyMeant
} from '../../src/engine/encounters/what-a-house-has-on-its-board';
import type { HouseAsItStands } from '../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back';

const A_HOUSE = 'sect-azure-cloud-pavilion';

async function aMemberReadingTheBoard(seed: string) {
    const { game, repos, db } = makeGame({ seed, worldEnabled: true });
    const { cultivator } = await game.newRun('Aspirant');
    repos.sects.addMember(A_HOUSE, cultivator.id, 0);
    const world = await game.loadWorld();
    const deps = {
        repos,
        world,
        knowledge: { knows: () => true, learn: () => undefined }
    } as never;
    return {
        game, repos, db, deps, cultivatorId: cultivator.id,
        boardAt(ordinal: number) {
            db.prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?')
                .run(ordinal, cultivator.id);
            return sectBoardFor(deps, repos.cultivators.getById(cultivator.id)!);
        }
    };
}

describe('a house posts what it needs doing', () => {
    it('has work on it at every rung of the ladder', async () => {
        // THE WHOLE POINT. Not "more offers" - offers AT ALL, above the rung
        // where the catalogue stopped. Two thirds of the ladder had none.
        const reading = await aMemberReadingTheBoard('board-every-rung');
        for (const tier of REALM_TIERS) {
            for (const ordinal of [tier.ordinalStart, tier.ordinalEnd]) {
                const board = reading.boardAt(ordinal);
                expect(
                    board.offers.length,
                    `nothing to do at ordinal ${ordinal} (${tier.key})`
                ).toBeGreaterThan(0);
            }
        }
    }, 300_000);

    it('and what it pays rises with the rung it is pitched at', async () => {
        // A posting is pitched at whoever is reading it, which is why the board
        // does not run out - and it is also why the pay has to move, or an
        // elder and a novice are paid the same for the house's hardest work.
        const reading = await aMemberReadingTheBoard('board-pay');
        const best = (ordinal: number) => Math.max(
            ...reading.boardAt(ordinal).offers.map(o => o.terms.contribution)
        );
        expect(best(20)).toBeGreaterThan(best(0));
        expect(best(40)).toBeGreaterThan(best(20));
    }, 300_000);

    it('and every posting is priced by the same rule as the catalogue', async () => {
        // One pricing path. A second one here would be a second opinion about
        // what work is worth, and the two would drift within a month.
        const reading = await aMemberReadingTheBoard('board-priced');
        const board = reading.boardAt(6);
        for (const offer of board.offers) {
            expect(offer.terms.contribution).toBeGreaterThan(0);
            expect(offer.terms.stones).toBeGreaterThan(0);
            expect(offer.terms.days).toBeGreaterThan(0);
            expect(offer.terms.refusal.kind).toBe('grudge');
        }
    }, 300_000);

    it('and a rogue on nobody\'s roll reads the catalogue and nothing else', async () => {
        // A posting is a HOUSE asking. Somebody on no roll is not being asked
        // by anybody, and the board says so by being the thin thing it was.
        const { game, repos } = makeGame({ seed: 'board-rogue', worldEnabled: true });
        const { cultivator } = await game.newRun('Rogue');
        const world = await game.loadWorld();
        const deps = { repos, world, knowledge: { knows: () => true } } as never;
        const board = sectBoardFor(deps, cultivator);
        expect(board.membership).toBeNull();
        expect(board.offers.every(o => !o.entry.id.startsWith('posted-'))).toBe(true);
    }, 300_000);
});

describe('and it posts only what it actually needs', () => {
    const bare: HouseAsItStands = {
        id: 'house-bare', name: 'A Bare House',
        holdsGround: false, standing: {}, hasAFind: false
    };

    it('nothing about ground, from a house that holds none', () => {
        const posted = whatAHouseHasOnItsBoard({ house: bare, ordinal: 10 });
        expect(posted.length).toBeGreaterThan(0);
        expect(posted.some(e => e.id.includes('stand-to'))).toBe(false);
    });

    it('and something about a rival, the moment it has one', () => {
        const withARival: HouseAsItStands = { ...bare, standing: { 'house-other': -0.8 } };
        const before = whatAHouseHasOnItsBoard({ house: bare, ordinal: 10 }).length;
        const after = whatAHouseHasOnItsBoard({ house: withARival, ordinal: 10 }).length;
        expect(after).toBeGreaterThan(before);
    });

    it('and it never posts above the ceiling the reason itself carries', () => {
        // A reason with a ceiling is one nobody above that rung is sent on.
        // Pitching it at a reader who is past it would be the board inventing
        // work the house does not have.
        const high = whatAHouseHasOnItsBoard({
            house: { ...bare, holdsGround: true }, ordinal: 40
        });
        for (const entry of high) {
            expect(entry.threatOrdinal).not.toBeNull();
            expect(entry.threatOrdinal!).toBeLessThanOrEqual(40);
        }
    });
});

describe('and somebody can say which one they meant', () => {
    const house = { id: 'house-a', name: 'A House' };
    const offers = whatAHouseHasOnItsBoard({
        house: {
            id: house.id, name: house.name, holdsGround: true,
            standing: { other: -0.8 }, hasAFind: true
        },
        ordinal: 6
    });

    it('by the reason, which is the part of the name that is the job', () => {
        // "An escort at Autumn Gate, for Azure Cloud Pavilion" is what the board
        // holds. "I take the escort" is what a person says.
        const chosen = whichPostingTheyMeant('the escort', offers);
        expect(chosen).not.toBeNull();
        expect(chosen!.id).toContain('escort');
    });

    it('and answers nothing rather than guessing between two', () => {
        // Two reasons in one sentence is somebody who has not said which. The
        // board asking again is a better answer than the board choosing.
        //
        // Named in full, both of them: a reason is matched on its own name, so
        // "the materials" is not the escort competing with anything - it is a
        // sentence that names one job and a word.
        expect(whichPostingTheyMeant('the escort and after materials', offers)).toBeNull();
    });

    it('and nothing at all for a sentence naming no reason', () => {
        expect(whichPostingTheyMeant('the sword on the table', offers)).toBeNull();
    });
});

describe('and the loop the board feeds turns', () => {
    it('take work, get paid, rise', async () => {
        // Played through `act`, because a loop that only closes when a test
        // calls the repositories is not a loop a player can walk.
        const { game, repos, db } = makeGame({ seed: 'loop-played', worldEnabled: true });
        const { cultivator } = await game.newRun('Aspirant');
        repos.sects.addMember(A_HOUSE, cultivator.id, 0);
        db.prepare('UPDATE cultivators SET realm_ordinal = 6 WHERE id = ?').run(cultivator.id);

        const held = () => repos.sects.getMembership(cultivator.id)!;
        expect(held().contribution).toBe(0);

        await game.act('I look around');
        for (let round = 0; round < 4; round++) {
            await game.act('I take the escort');
            await game.act('I cultivate for 70 days anyway');
        }

        // PAID. This was 0 before the board had anything on it worth taking.
        expect(held().contribution).toBeGreaterThan(100);
        expect(held().rankIndex).toBe(0);

        // And the rung is the other half of the ladder, so the promotion is
        // refused until both are met and then granted.
        const refused = await game.act('I ask to be promoted') as unknown as {
            toolCalls: { name: string; summary: string }[];
        };
        expect(refused.toolCalls.some(c => /requirements_unmet/.test(c.summary))).toBe(true);
        expect(held().rankIndex).toBe(0);

        db.prepare('UPDATE cultivators SET realm_ordinal = 8 WHERE id = ?').run(cultivator.id);
        await game.act('I ask to be promoted');

        expect(held().rankIndex).toBe(1);
        // Spent, not merely reached. The ladder costs what it says it costs.
        expect(held().contribution).toBeLessThan(212);
    }, 900_000);
});
