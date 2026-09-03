/**
 * A wrong nobody knows about is a wrong nobody holds.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE MEASUREMENT THIS EXISTS FOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Played, on a pinned world, before this existed: a deed was written into the
 * world's own history naming a cultivator as the person it was done to, and
 * the obligation table held ZERO rows. That was correct - the cultivator had no
 * idea it had happened, and a grudge is held against somebody by somebody who
 * knows there is anything to hold. And there was no path anywhere in `src/`
 * from finding out to holding it, so the account was never going to open at
 * all. The deed was on the record and permanently inert.
 *
 * `hearing-of-a-wrong.ts` is the join, and the `news` verb is its live caller:
 * asking around is how a person in this world finds out anything, and finding
 * out is the event that supplies somebody who can act.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY THIS IS PLAYED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * AGENTS.md, *a module nothing calls is not a feature*. The first test here
 * types the sentence a player types and then reads the ledger out of SQLite.
 * The deed itself is written through `aDeedEntersTheWorld` - the same call
 * `combat-verbs.ts` makes when a played bout goes too far - because arranging
 * a wrong that the player is genuinely unaware of is a precondition, and there
 * is no verb for having something done to you behind your back.
 *
 * `worldEnabled: true` throughout, and the world is pinned. A rumour is drawn
 * off the world's own ledger, so a test that does not pin its world is
 * measuring whatever world the file before it left behind.
 */

import { makeGameInWorld } from './harness';
import { aDeedEntersTheWorld } from '../../src/engine/world/a-deed-enters-the-world-as-a-fact';
import { retell, regionOf } from '../../src/engine/world/what-people-are-saying';
import { askAround } from '../../src/web/asking-what-people-are-saying';
import type { WorldState } from '../../src/engine/world/world-state';
import type { RosterEntry } from '../../src/storage/repos/cultivator.repo';
import { NO_NAME_ON_IT, NO_NAME_TAG } from '../../src/engine/social/accounts-with-no-name';

interface LedgerRow {
    id: string;
    kind: string;
    cause: string;
    severity: string;
    holder_id: string;
    subject_id: string;
    incurred_on_day: number;
    triggering_event_id: string | null;
    from_belief: number;
    tags: string;
}

function ledger(db: { prepare(sql: string): { all(): unknown } }): LedgerRow[] {
    return db.prepare(
        'SELECT id, kind, cause, severity, holder_id, subject_id, incurred_on_day, '
        + 'triggering_event_id, from_belief, tags FROM obligations'
    ).all() as LedgerRow[];
}

/**
 * A wrong done to this cultivator that they were never told about.
 *
 * Loud on purpose - `world` scale, at the top band - because a rumour has to
 * out-weigh everything else in a world's ledger before anybody in a square
 * repeats it, and this test is about what happens when somebody does.
 */
function somethingDoneToThemBehindTheirBack(
    world: WorldState,
    doerId: string,
    doerName: string,
    victimId: string,
    victimName: string
) {
    return aDeedEntersTheWorld(world, {
        kind: 'betrayal',
        weight: 'unforgivable',
        day: Math.floor(world.currentDay),
        locationId: null,
        place: 'the low road',
        scale: 'world',
        actors: [
            { id: doerId, name: doerName, role: 'did it' },
            { id: victimId, name: victimName, role: 'it was done to' }
        ],
        summary: `${doerName} took something off ${victimName} on the low road.`,
        unattributed: 'Somebody came off the low road carrying what they went up without.',
        workedOut: true
    });
}

describe('a wrong the person it was done to has not heard of', () => {
    it('is on the record, and opens nothing until they are told', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'told-1', worldSeed: 'told-world', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        // An ordinary turn, which is what puts the player on the world roster.
        await game.act('I look around');

        const world = (await game.loadWorld())!;
        const doer = world.npcs.find(n => n.status === 'alive' && n.id !== cultivator.id)!;
        const deed = somethingDoneToThemBehindTheirBack(
            world, doer.id, doer.name, cultivator.id, cultivator.name);

        // The record and the account are two questions. The world holds it.
        expect(deed.fact.data.deedWeight).toBe('unforgivable');
        expect(world.history.facts.some(f => f.id === deed.fact.id)).toBe(true);
        // And nobody holds anything about it, because nobody who could has
        // been told. That is the ruling, and it is what makes doing a thing
        // quietly worth doing.
        expect(ledger(db)).toHaveLength(0);

        // Now somebody says it out loud in front of them.
        const said = await game.act('what news is there');
        expect(said.narration).toContain(cultivator.name);

        const after = ledger(db);
        expect(after, 'being told is what opened it').toHaveLength(1);
        expect(after[0].holder_id).toBe(cultivator.id);
        expect(after[0].triggering_event_id).toBe(deed.fact.id);
        // The weight the deed was priced at, unchanged. Finding out late makes
        // a thing held, not heavier.
        expect(after[0].severity).toBe('unforgivable');
        // Held on what somebody said, not on anything they saw.
        expect(after[0].from_belief).toBe(1);
        const tags = JSON.parse(after[0].tags) as string[];
        expect(tags).toContain('opened-on-being-told');
        expect(tags).toContain('heard:market');
        // Who told them. The question a house asks first has an answer.
        expect(tags.some(t => t.startsWith('told-by:'))).toBe(true);
    }, 180000);

    /**
     * The date is the ruling, so it gets its own assertion.
     *
     * The deed is dated in the WORLD's clock, five hundred years deep. The
     * account is dated in the run's, which is where every other obligation in
     * this table is dated, and it is the day they were told.
     */
    it('dates the account to the day they found out', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'told-1', worldSeed: 'told-world', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        await game.act('I look around');
        const world = (await game.loadWorld())!;
        const doer = world.npcs.find(n => n.status === 'alive' && n.id !== cultivator.id)!;
        const deed = somethingDoneToThemBehindTheirBack(
            world, doer.id, doer.name, cultivator.id, cultivator.name);

        await game.act('what news is there');
        const row = ledger(db)[0];
        expect(row).toBeDefined();
        expect(row.incurred_on_day).not.toBe(deed.fact.day);
        expect(row.incurred_on_day).toBeLessThan(deed.fact.day);
    }, 180000);

    /** Being told a second time is not a second account. */
    it('does not open a second account for the same telling', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'told-1', worldSeed: 'told-world', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        await game.act('I look around');
        const world = (await game.loadWorld())!;
        const doer = world.npcs.find(n => n.status === 'alive' && n.id !== cultivator.id)!;
        somethingDoneToThemBehindTheirBack(
            world, doer.id, doer.name, cultivator.id, cultivator.name);

        await game.act('what news is there');
        expect(ledger(db)).toHaveLength(1);
        await game.act('what news is there');
        expect(ledger(db), 'asking twice is not being wronged twice').toHaveLength(1);
    }, 180000);
});

describe('and it can arrive wrong', () => {
    /**
     * The best thing in this design, and it needed no mechanism.
     *
     * `retell` already swaps the doer under `misattributed`. So a hearer who
     * asks the wrong person opens the account against the wrong person, at the
     * same weight, with the same conviction, and nothing anywhere compares the
     * name to the ledger's - because a hearer who could is a hearer with the
     * engine's omniscient view.
     *
     * Driven at the module seam rather than through the verb because which
     * teller a square hands you is a draw, and this is a claim about what
     * happens when it hands you that one.
     */
    it('opens the account against the name the teller used', async () => {
        const { game } = await makeGameInWorld({
            seed: 'told-1', worldSeed: 'told-world', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        await game.act('I look around');
        const world = (await game.loadWorld())!;
        const run = (await game.state()).run!;

        const doer = world.npcs.find(n => n.status === 'alive' && n.id !== cultivator.id)!;
        const deed = somethingDoneToThemBehindTheirBack(
            world, doer.id, doer.name, cultivator.id, cultivator.name);
        const day = Math.floor(world.currentDay);

        // Somebody who tells this story with the wrong man in it. Their version
        // is stable for ever - the draw is seeded on (world, fact, teller) -
        // which is what makes checking a rumour possible at all.
        const wrong = world.npcs.find(n => {
            if (n.status !== 'alive' || n.id === cultivator.id) return false;
            return retell(world, deed.fact, {
                id: n.id, name: n.name, realmOrdinal: n.cultivation.realmOrdinal,
                regionId: regionOf(world, n.locationId), factionId: n.factionId ?? null
            }, day).distortion === 'misattributed';
        });
        expect(wrong, 'this world produces a misattributed telling of it').toBeDefined();

        const asked = askAround({
            cultivator,
            run,
            present: [{
                id: wrong!.id,
                name: wrong!.name,
                realmOrdinal: wrong!.cultivation.realmOrdinal,
                sectId: wrong!.factionId ?? null
            } as RosterEntry],
            world,
            occasion: 'news',
            carriesFor: { hearerId: cultivator.id, ids: [cultivator.id] }
        });

        expect(asked.opens, 'the telling opened an account').toHaveLength(1);
        const opened = asked.opens[0];
        expect(opened.row.holderId).toBe(cultivator.id);
        expect(opened.row.severity).toBe('unforgivable');
        // And it is against somebody who did not do it. That is the design
        // working, and there is deliberately no branch anywhere that could
        // notice.
        expect(opened.row.subjectId).not.toBe(doer.id);
        expect(opened.row.triggeringEventId).toBe(deed.fact.id);
    }, 180000);

    /**
     * A consequence with nobody attached to it opens nothing at all.
     *
     * `docs/world/houses/discovery.md`'s own rule - "the world may act on a
     * player who cannot name what acted" - stated in the ledger. A fact naming
     * nobody reaches them as a thing that happened and leaves them with no
     * account, because a grudge is held against somebody.
     */
    it('opens nothing when the telling carries no name', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'told-1', worldSeed: 'told-world', worldEnabled: true
        });
        await game.newRun('Prober');
        await game.act('I look around');
        const world = (await game.loadWorld())!;

        aDeedEntersTheWorld(world, {
            kind: 'catastrophe',
            weight: 'unforgivable',
            day: Math.floor(world.currentDay),
            locationId: null,
            place: 'the low road',
            scale: 'world',
            actors: [],
            summary: 'Something went through the low road and left it changed.',
            unattributed: 'Something was heard a long way off, and the birds went.',
            workedOut: true
        });

        await game.act('what news is there');
        expect(ledger(db), 'nobody to hold it against').toHaveLength(0);
    }, 180000);
});

// ─────────────────────────────────────────────────────────────────────────
// THE MIDDLE STATE, PLAYED
// ─────────────────────────────────────────────────────────────────────────

/**
 * A wrong the world holds and has no author for.
 *
 * `deedNamesNobody` is the record for a body found on the low road: the deed is
 * on the ledger, priced, repeatable, and nobody is named for it. A telling of it
 * reaches the person it was done to as *something was done to you*, which is
 * state 2 - an open account with no name on it, and a reason to go asking.
 */
function somethingDoneToThemByNobodyNamed(
    world: WorldState,
    victimId: string,
    victimName: string
) {
    return aDeedEntersTheWorld(world, {
        kind: 'betrayal',
        weight: 'unforgivable',
        day: Math.floor(world.currentDay),
        locationId: null,
        place: 'the low road',
        scale: 'world',
        actors: [{ id: victimId, name: victimName, role: 'it was done to' }],
        summary: `Something was done to ${victimName} on the low road.`,
        unattributed: 'Somebody came off the low road carrying what they went up without.',
        workedOut: true,
        data: { deedNamesNobody: true }
    });
}

describe('an account can be open with no name on it', () => {
    /**
     * Standing high enough that a wrong done to them is worth repeating.
     *
     * Not a thumb on the scale: `airtimeOf` weights a fact by how far above the
     * teller the people in it stand, and a nameless wrong has only the person it
     * was done to in it. A nobody's misfortune loses the square to a house
     * putting a gate up, which is the market working, and it means the fixture
     * has to be somebody the market would talk about.
     */
    const A_NAME_THE_MARKET_REPEATS = 38;

    it('opens against nobody when the telling names the loss and no doer', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'told-1', worldSeed: 'told-world', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        db.prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?')
            .run(A_NAME_THE_MARKET_REPEATS, cultivator.id);
        await game.act('I look around');
        const world = (await game.loadWorld())!;
        const deed = somethingDoneToThemByNobodyNamed(world, cultivator.id, cultivator.name);

        expect(ledger(db)).toHaveLength(0);
        const said = await game.act('what news is there');

        const after = ledger(db);
        expect(after, 'knowing it was done is enough to open one').toHaveLength(1);
        expect(after[0].holder_id).toBe(cultivator.id);
        expect(after[0].triggering_event_id).toBe(deed.fact.id);
        // Against nobody. Not knowing who did it does not make it lighter -
        // that is the whole reason the middle state is worth having rather
        // than deferring the account until a name turns up.
        expect(after[0].subject_id).toBe(NO_NAME_ON_IT);
        expect(after[0].severity).toBe('unforgivable');
        expect(JSON.parse(after[0].tags) as string[]).toContain(NO_NAME_TAG);

        // And the game says so, and says what would produce a name. A refusal
        // names a route, and "you have no name for this" is a refusal.
        expect(said.narration).toMatch(/nobody has put a name to it/i);
        // The telling itself does not accuse the person it was done to. Every
        // template in `sentenceFor` renders a single name as the sentence's
        // subject, so without an authorless line the news would have told the
        // player they did it themselves.
        expect(said.narration).toContain(`Something was done to ${cultivator.name}`);
    }, 180000);

    /**
     * State 2 to 3, and the thing it must not do is fork the row.
     *
     * The account they have been carrying acquires a subject. Same id, same
     * weight, same day it opened - what changes is who it is against, and when
     * they found that out.
     */
    it('puts a name on the account they were already carrying', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'told-1', worldSeed: 'told-world', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        db.prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?')
            .run(A_NAME_THE_MARKET_REPEATS, cultivator.id);
        await game.act('I look around');
        const world = (await game.loadWorld())!;
        const deed = somethingDoneToThemByNobodyNamed(world, cultivator.id, cultivator.name);

        await game.act('what news is there');
        const unnamed = ledger(db);
        expect(unnamed).toHaveLength(1);
        expect(unnamed[0].subject_id).toBe(NO_NAME_ON_IT);

        // Somebody better placed puts a name to it. The same fact, told by
        // somebody who names an actor for it.
        const named = world.history.facts.find(f => f.id === deed.fact.id)!;
        named.actors.unshift({
            id: world.npcs.find(n => n.status === 'alive' && n.id !== cultivator.id)!.id,
            name: 'The one who did it',
            role: 'did it'
        });
        named.data.deedNamesNobody = false;

        await game.act('what news is there');
        const attached = ledger(db);
        expect(attached, 'one account, not two').toHaveLength(1);
        expect(attached[0].id).toBe(unnamed[0].id);
        expect(attached[0].subject_id).not.toBe(NO_NAME_ON_IT);
        // The day it opened does not move. The day a name arrived is a
        // different fact and lands in the tags.
        expect(attached[0].incurred_on_day).toBe(unnamed[0].incurred_on_day);
        expect((JSON.parse(attached[0].tags) as string[]).some(t => t.startsWith('name-attached:')))
            .toBe(true);
    }, 180000);
});
