/**
 * On what authority an order is given.
 *
 * `handleOrder` tested `powersAt` and `canOrder` - whether this rung reaches
 * that rung - and nothing else, so every order in the game was the same order.
 * An elder who held the punishment hall and an elder who held nothing gave
 * identical instructions at identical prices, and *"on what authority?"* had no
 * answer because nothing had been claimed.
 *
 * The engine tests the CLAIM the sentence makes rather than consulting a
 * legitimacy table, which is what lets the player's own words decide which
 * question gets asked. `what-an-elder-is-in-charge-of.ts` had every piece of the
 * answer and no caller outside its own barrel and test.
 */

import { describe, it, expect } from 'vitest';
import { parseIntent } from '../../src/web/actions';
import { makeGameInWorld } from './harness';
import { SECTS } from '../../src/data/cultivation/index';
import { readJsonFlag } from '../../src/server/consolidated/cultivation-support';
import {
    theRoomsThisHouseHas,
    whetherTheyMayGiveThisOrder
} from '../../src/engine/social-leverage/authority-for-an-order';

const LOCAL_SECT = SECTS
    .filter(sect => sect.recruits)
    .reduce((best, sect) =>
        sect.admissionOrdinal < best.admissionOrdinal ||
        (sect.admissionOrdinal === best.admissionOrdinal && sect.id < best.id) ? sect : best);

function standingOf(harness: any, id: string): number {
    return readJsonFlag<{ standing: number }>(
        harness.db, id, `house:${LOCAL_SECT.id}`
    )?.standing ?? 50;
}

async function memberAtRung(rankIndex: number, seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: 'authority-w' }) as any;
    const { cultivator } = await harness.game.newRun('Wen Shu');
    harness.db.prepare('UPDATE cultivators SET realm_ordinal = 21 WHERE id = ?')
        .run(cultivator.id);
    harness.repos.sects.addMember(LOCAL_SECT.id, cultivator.id, rankIndex);
    return { harness, id: cultivator.id };
}

// ─────────────────────────────────────────────────────────────────────────
// THE CLAIM IS WHAT THE SENTENCE SAID
// ─────────────────────────────────────────────────────────────────────────

describe('the player\'s own words decide which question is asked', () => {
    it('separates an order from a decree', () => {
        expect(parseIntent('I order the disciples to gather herbs').intent).toBe('order');
        // No ordering VERB in this one at all - the claim is the verb. Routed
        // on the verb alone it reached `gather` and had the player picking the
        // herbs personally.
        const decree = parseIntent('By order of the Sect, the disciples are to gather herbs');
        expect(decree.action).toBe('sect');
        expect(decree.intent).toBe('decree');
        expect(decree.topic).toBe('gather');
    });

    it('routes the question that has to be answerable first', () => {
        for (const text of ['on what authority', 'what do I run', 'which rooms are mine']) {
            const plan = parseIntent(text);
            expect(plan.action, text).toBe('sect');
            expect(plan.intent, text).toBe('authority');
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE PREDICATE
// ─────────────────────────────────────────────────────────────────────────

describe('whether they may give it', () => {
    const rooms = [
        { purpose: 'punishment_hall' as const, holderId: 'elder', depth: 3 },
        { purpose: 'treasury' as const, holderId: 'head', depth: 4 }
    ];

    it('lets a personal order through on the ladder alone', () => {
        const said = whetherTheyMayGiveThisOrder({
            claim: 'personal', giverId: 'nobody', portfolios: rooms
        });
        // Not a loophole: the ladder already priced this and `resolveAct`
        // already charges for it. What a personal order buys is less.
        expect(said.legitimate).toBe(true);
    });

    it('refuses somebody claiming the house who runs none of it', () => {
        const said = whetherTheyMayGiveThisOrder({
            claim: 'delegated', giverId: 'nobody', portfolios: rooms
        });
        expect(said.legitimate).toBe(false);
        expect(said.held).toHaveLength(0);
    });

    it('allows a holder speaking generally, and refuses them another room', () => {
        expect(whetherTheyMayGiveThisOrder({
            claim: 'delegated', giverId: 'elder', portfolios: rooms
        }).legitimate).toBe(true);

        const overreach = whetherTheyMayGiveThisOrder({
            claim: 'delegated', giverId: 'elder', portfolios: rooms, under: 'treasury'
        });
        expect(overreach.legitimate).toBe(false);
        expect(overreach.heldInstead).toBe('head');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// PLAYED, BOTH SIDES
// ─────────────────────────────────────────────────────────────────────────

describe('played', () => {
    it('reads a house\'s rooms off the compound the world actually built', async () => {
        const { harness } = await memberAtRung(1, 'authority-rooms');
        const world = await harness.game.loadWorld();
        const rooms = theRoomsThisHouseHas(world.locations, LOCAL_SECT.id);
        // If this is ever empty the portfolio layer is measuring nothing, so it
        // is a precondition rather than a silent pass.
        expect(rooms.length).toBeGreaterThan(0);
    }, 300_000);

    it('obeys a legitimate order and ignores an unrecognised decree, charging both', async () => {
        const { harness, id } = await memberAtRung(1, 'authority-low');

        const ran = await harness.game.act('I order the disciples to gather herbs');
        const afterOrder = standingOf(harness, id);
        expect(afterOrder).toBeLessThan(50);
        expect(ran.narration ?? '').toContain('went out');

        const decreed = await harness.game.act(
            'By order of the Sect, the disciples are to gather herbs'
        );
        const afterDecree = standingOf(harness, id);
        const said = decreed.narration ?? '';

        // NOTHING WAS COLLECTED, and the prose says so as what it is rather
        // than as bad luck. A nought meaning "they went and found nothing" and
        // a nought meaning "nobody went" are different facts.
        expect(said.toLowerCase()).toContain('nothing was collected');
        expect(said).toContain('speak for');
        expect(said.toLowerCase()).not.toContain('came back with');

        // THE GIVER STILL SPENT IT. `resolveAct` is explicit: "the standing is
        // spent whether or not the act lands - an order that was ignored was
        // still given, and the giving is what cost."
        expect(afterDecree).toBeLessThan(afterOrder);

        // AND IT COST THE PEOPLE WHO DECLINED NOTHING. They were not refusing
        // the house; there was no house in it to refuse.
        expect(said.toLowerCase()).toContain('nobody was punished');
    }, 300_000);

    it('tells a member what they run before they can claim it', async () => {
        const { harness } = await memberAtRung(1, 'authority-read');
        const said = (await harness.game.act('what do I run')).narration ?? '';
        // The read has to be honest in the empty case, because that is the case
        // where claiming would be false.
        expect(said.toLowerCase()).toContain('run none of it');
        // AND IT MUST NOT NAME THE PROTECTOR. `Sect.office` is a different
        // field from a portfolio and the design owner ruled that a member does
        // not know whether their house has one.
        expect(said.toLowerCase()).not.toContain('protector');
    }, 300_000);
});
