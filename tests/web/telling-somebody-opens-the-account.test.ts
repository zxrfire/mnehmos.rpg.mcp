/**
 * Telling somebody that a wrong was done to them, played.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE MEASUREMENT THIS EXISTS FOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The receiving half was built and works: being told opens the account, and
 * `news` is a live caller, so a square repeating something in front of the
 * player already does all of it TO them. Nothing did it the other way. Measured
 * on the deterministic reader before this verb existed:
 *
 *   "I tell him that Cao Antao killed his brother"
 *       -> interact(target="him that Cao Antao killed his brother", intent=talk)
 *   "I tell her that Cao Antao stole from her"
 *       -> interact(..., intent=steal, leverage=force)
 *
 * The first swallowed the proposition into a party name and answered with a
 * shrug saying the sentence had a hole in it. The second read `stole` as the
 * PLAYER stealing and pointed an attempt intent at the person being warned.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * TWO TIERS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The first tier is played - the sentence a player types, then the ledger read
 * out of SQLite - because a module nothing calls is not a feature.
 *
 * The second is at the bottom and it measures at the point a player would
 * notice: of the people standing where a run opens, how many can be told
 * something that lands. Both edges, because a verb that reaches nobody and a
 * verb that opens an account against everybody in earshot are the same defect
 * from opposite sides.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THIS WORLD DOES NOT SUPPLY, MEASURED, AND WHY IT IS ARRANGED HERE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Two preconditions are written by hand below, and both are absent from a
 * freshly created world rather than merely inconvenient. Measured on the pinned
 * world `tells-world`, on the day a run opens:
 *
 *   103 historical facts, of which  0  carry `deedWeight`
 *   436 living people,     of which  0  hold a kin, spouse, parent, child,
 *                                       master or disciple tie
 *
 * (131 of them hold a tie of some kind; every one is `ally` or `rival`.)
 *
 * So neither a wrong anybody can hold an account about nor a brother to have
 * lost is in the world a player meets. There is no verb for having been born
 * into a family and none for having something done to you behind your back, so
 * both are arranged here the way `being-told-opens-the-account.test.ts`
 * arranges its deed. What that absence means for the verb in play is a finding
 * about the world rather than about this file.
 *
 * ── AND THE WORLD SUPPLIES BOTH OF THEM NOW ──────────────────────────────
 *
 * The measurement above was correct when it was taken and is no longer true.
 * `the-families-a-world-opens-holding.ts` and
 * `the-wrongs-a-world-opens-holding.ts` run at world creation, so a fresh world
 * holds households and open killings, and about a third of the living carry a
 * blood tie. The arrangements below are kept deliberately - a unit test wants a
 * situation it controls, and pinning one against a world's own draw would make
 * every assertion here hostage to a change in the seeder. What the world
 * actually produces, played and unarranged, is
 * `a-fresh-world-has-somebody-to-tell.test.ts`.
 *
 * `worldEnabled: true` throughout, and the world is pinned: the roster, who is
 * standing where and the history are all drawn from it.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { parseIntent } from '../../src/web/actions';
import { aDeedEntersTheWorld } from '../../src/engine/world/a-deed-enters-the-world-as-a-fact';
import { NO_NAME_ON_IT } from '../../src/engine/social/accounts-with-no-name';
import { worldLocationFor } from '../../src/web/entities';
import type { WorldState } from '../../src/engine/world/world-state';

interface LedgerRow {
    id: string;
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
        'SELECT id, severity, holder_id, subject_id, incurred_on_day, '
        + 'triggering_event_id, from_belief, tags FROM obligations'
    ).all() as LedgerRow[];
}

/**
 * A wrong done to somebody, at the place the player is standing.
 *
 * The location is doing two jobs. `appendWorldFact` draws the people standing
 * there into `witnessIds`, which is how the PLAYER becomes somebody who can
 * point at this deed - the honest version of "you were there" rather than
 * reaching into the knowledge tables. And it is where the hearer is, so they
 * can be spoken to.
 */
function aWrongDoneTo(
    world: WorldState,
    where: string | null,
    doer: { id: string; name: string },
    victim: { id: string; name: string }
) {
    return aDeedEntersTheWorld(world, {
        kind: 'betrayal',
        weight: 'unforgivable',
        day: Math.floor(world.currentDay),
        locationId: where,
        place: 'the low road',
        scale: 'local',
        actors: [
            { id: doer.id, name: doer.name, role: 'did it' },
            { id: victim.id, name: victim.name, role: 'it was done to' }
        ],
        summary: `${doer.name} took something off ${victim.name} on the low road.`,
        unattributed: 'Somebody came off the low road carrying what they went up without.',
        workedOut: true
    });
}

/**
 * The people the player can actually speak to, and where they are standing.
 *
 * `present` is the roster the engine itself uses to decide who is here, so a
 * test that picks people any other way is arranging a situation the verb will
 * not agree it is in.
 */
async function whoIsHere(game: any, cultivator: { id: string; location: string }) {
    const world = (await game.loadWorld())! as WorldState;
    const here = game.present(cultivator) as { id: string; name: string }[];
    const where = worldLocationFor(world, cultivator.location)?.id ?? null;
    return { world, here, where };
}

/** Give somebody a brother. See the header for why this is not already true. */
function giveThemKin(world: WorldState, holderId: string, kin: { id: string; name: string }): void {
    world.npcs.find(npc => npc.id === holderId)!.relationships.push({
        targetId: kin.id,
        targetName: kin.name,
        kind: 'kin',
        standing: 0.8,
        note: 'Same household.',
        sinceDay: Math.floor(world.currentDay) - 1,
        lastChangedDay: Math.floor(world.currentDay) - 1,
        factIds: [],
        inheritedFromId: null
    });
}

describe('telling somebody that a wrong was done to them', () => {
    it('opens the account, dated today, with the teller named on it', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'tells-1', worldSeed: 'tells-world', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        await game.act('I look around');

        const { world, here, where } = await whoIsHere(game, cultivator);
        expect(here.length, 'this world puts people where a run opens').toBeGreaterThan(1);
        const [hearer, doer] = here;

        aWrongDoneTo(world, where, doer, hearer);
        // Nobody holds anything, because nobody who could has been told.
        expect(ledger(db)).toHaveLength(0);

        const said = await game.act(`I tell ${hearer.name} that ${doer.name} stole from him`);

        const rows = ledger(db);
        expect(rows, 'the telling opened it').toHaveLength(1);
        expect(rows[0].holder_id).toBe(hearer.id);
        expect(rows[0].subject_id).toBe(doer.id);
        // The weight the deed was priced at on the day, untouched. Finding out
        // makes a thing held, not heavier.
        expect(rows[0].severity).toBe('unforgivable');
        // Held on what somebody said, not on anything they saw.
        expect(rows[0].from_belief).toBe(1);
        const tags = JSON.parse(rows[0].tags) as string[];
        expect(tags).toContain('opened-on-being-told');
        // WHO TOLD HIM. The question a house asks first has an answer, and here
        // it is the player - which is what makes carrying news an act.
        expect(tags).toContain(`told-by:${cultivator.id}`);
        expect(said.narration).toContain(hearer.name);
    }, 180000);

    /** The owner's own sentence: it is about somebody ELSE's loss. */
    it('reaches a wrong done to somebody the hearer carries for', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'tells-2', worldSeed: 'tells-world', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        await game.act('I look around');

        const { world, here, where } = await whoIsHere(game, cultivator);
        expect(here.length, 'three people to be three parties').toBeGreaterThan(2);
        const [hearer, doer, brother] = here;
        giveThemKin(world, hearer.id, brother);
        aWrongDoneTo(world, where, doer, brother);

        await game.act(`I tell ${hearer.name} that ${doer.name} killed ${brother.name}`);

        const rows = ledger(db);
        expect(rows, 'the person who carries for them holds it').toHaveLength(1);
        expect(rows[0].holder_id).toBe(hearer.id);
        expect(rows[0].subject_id).toBe(doer.id);
        // The tie is on the row, so a reader can see why this person and not
        // the four hundred others who could have been told the same thing.
        expect(JSON.parse(rows[0].tags) as string[]).toContain('carried:kin');
    }, 180000);

    /**
     * The best thing in the design, and it needed no mechanism here either.
     *
     * The account opens against the name the TELLING used. Nothing on this path
     * compares it to the ledger's, and nothing may.
     */
    it('opens against whoever the player named, not whoever did it', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'tells-3', worldSeed: 'tells-world', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        await game.act('I look around');

        const { world, here, where } = await whoIsHere(game, cultivator);
        expect(here.length).toBeGreaterThan(2);
        const [hearer, doer, innocent] = here;
        aWrongDoneTo(world, where, doer, hearer);

        await game.act(`I tell ${hearer.name} that ${innocent.name} stole from him`);

        const rows = ledger(db);
        expect(rows).toHaveLength(1);
        expect(rows[0].subject_id, 'against the man who was named').toBe(innocent.id);
        expect(rows[0].subject_id).not.toBe(doer.id);
        // And it rests on the real deed at the real weight. The wrong name is
        // the only wrong thing about it, which is what makes it held with
        // complete conviction.
        expect(rows[0].severity).toBe('unforgivable');
        expect(rows[0].from_belief).toBe(1);
    }, 180000);

    /**
     * The middle state, and then the name arriving.
     *
     * ONE ACCOUNT ACQUIRING A SUBJECT - the same row id, the same weight, the
     * same date - never a second account about the same wrong. This is the
     * shape that will regress and it is worth saying why: a relative who
     * cannot name the actor now opens an unnamed account at the deed's weight
     * on the day they work it out, so the row a telling lands on USUALLY
     * ALREADY EXISTS. A verb that opened a fresh one instead would leave the
     * hearer holding two grudges for one killing and double every count
     * downstream, and every other assertion in this file would still pass.
     *
     * `subject_id` is nullable TEXT: `NO_NAME_ON_IT` is `null` and the
     * empty-string stand-in is gone, so this tests for null rather than for ''.
     */
    it('opens with no name on it, and a later telling attaches one to that row', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'tells-4', worldSeed: 'tells-world', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        await game.act('I look around');

        const { world, here, where } = await whoIsHere(game, cultivator);
        const [hearer, doer] = here;
        aWrongDoneTo(world, where, doer, hearer);

        await game.act(`I tell ${hearer.name} what happened to him`);
        const first = ledger(db);
        expect(first, 'a telling with nobody in it still opens an account').toHaveLength(1);
        expect(first[0].subject_id).toBe(NO_NAME_ON_IT);
        expect(first[0].subject_id, 'null, not the empty string').toBeNull();

        await game.act(`I tell ${hearer.name} that ${doer.name} stole from him`);
        const second = ledger(db);
        expect(second, 'one account, not two').toHaveLength(1);
        expect(second[0].id, 'the same row').toBe(first[0].id);
        expect(second[0].subject_id).toBe(doer.id);
        expect(second[0].incurred_on_day, 'the date does not move').toBe(first[0].incurred_on_day);
        expect(second[0].severity).toBe(first[0].severity);
        // Said the other way round as well, because the failure is a COUNT and
        // an id check alone would pass against a second row that happened to
        // be written first: no unnamed row survives, and no second row exists.
        expect(second.filter(row => row.subject_id === null), 'no unnamed row left').toEqual([]);
        expect(JSON.parse(second[0].tags) as string[])
            .toContain(`name-attached:${second[0].incurred_on_day}`);
    }, 180000);

    /**
     * A coherent sentence gets an answer about the WORLD.
     *
     * The refusal this verb replaces - *"they look at you the way people look at
     * a sentence with a hole in it"* - fired on the branch where the game had
     * ALREADY resolved who the player meant, so a perfectly clear sentence was
     * answered as though it were unintelligible. Indifference is an answer; not
     * being understood is not, and a player cannot tell the two apart.
     */
    it('answers about the world when nothing lands, and never about the sentence', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'tells-5', worldSeed: 'tells-world', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        await game.act('I look around');
        const { here } = await whoIsHere(game, cultivator);
        const [hearer, other] = here;

        // No deed anywhere. The sentence is still perfectly clear.
        const said = await game.act(`I tell ${hearer.name} that ${other.name} killed his brother`);

        expect(ledger(db), 'nothing was done, so nothing opened').toHaveLength(0);
        expect(said.narration).not.toMatch(/hole in it/i);
        // The person was reached, and answered. That is the floor.
        expect(said.narration).toContain(hearer.name);
        // And the turn is not marked a failure: the words were said and heard.
        const call = said.toolCalls.find((c: any) => c.name === 'world.whatATellingLandsOn');
        expect(call?.ok).toBe(true);
    }, 180000);

    /**
     * Telling somebody a thing they already know is a RESULT, not a shrug.
     *
     * Found by playing the three tellings in a row: the second one attached the
     * name, and the third was answered with the sentence written for a telling
     * that reached no wrong at all - which is true of nothing that happened. It
     * is safe to be specific here and nowhere else: getting this far means the
     * teller could already point at the deed, so saying their news is old
     * discloses nothing they were not already carrying.
     */
    it('says so when the hearer already knew', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'tells-7', worldSeed: 'tells-world', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        await game.act('I look around');
        const { world, here, where } = await whoIsHere(game, cultivator);
        const [hearer, doer] = here;
        aWrongDoneTo(world, where, doer, hearer);

        await game.act(`I tell ${hearer.name} that ${doer.name} stole from him`);
        const again = await game.act(`I tell ${hearer.name} that ${doer.name} stole from him`);

        expect(ledger(db), 'being told twice is not two accounts').toHaveLength(1);
        expect(again.narration).toMatch(/know/i);
        // And not the sentence written for a telling that touched nothing,
        // which is what it used to say.
        expect(again.narration).not.toMatch(/nothing in what you said/i);
    }, 180000);

    /** Free, and it means it. A telling spends no day. */
    it('spends no day', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'tells-6', worldSeed: 'tells-world', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        await game.act('I look around');
        const { world, here, where } = await whoIsHere(game, cultivator);
        aWrongDoneTo(world, where, here[1], here[0]);

        const before = (await game.state()).run!.elapsedDays;
        await game.act(`I tell ${here[0].name} that ${here[1].name} stole from him`);
        expect((await game.state()).run!.elapsedDays).toBe(before);
        expect(ledger(db)).toHaveLength(1);
    }, 180000);
});

// ─────────────────────────────────────────────────────────────────────────
// THE PHRASING BAND
// ─────────────────────────────────────────────────────────────────────────

/**
 * Both edges, because a verb reachable by one phrasing and a verb that has
 * eaten its neighbours are the same defect measured from opposite sides.
 *
 * Derived rather than sampled: these are the sentences, and the answer is exact.
 */
const A_TELLING = [
    'I tell him that Cao Antao killed his brother',
    'I tell He Peiyi that Cao Antao killed his brother',
    'I tell He Peiyi who killed his brother',
    'I tell her that Cao Antao stole from her',
    'tell He Peiyi about the killing',
    'I let He Peiyi know that Cao Antao killed his brother',
    'I inform He Peiyi that Cao Antao killed his brother',
    'I tell him what happened to his brother',
    'I tell He Peiyi that his brother is dead',
    "I tell He Peiyi of his brother's death",
    'I tell him that I killed his brother',
    'I tell the elder that Cao Antao betrayed him',
    'tell He Peiyi that Cao Antao murdered his brother'
];

/**
 * Sentences that must keep the verb they already had.
 *
 * `tell` is one of the widest words in the language and the table already has
 * three separate blocks fighting over it. Every one of these was a live parse
 * before the telling branch existed and has to still be one after it - and the
 * threat pair is the sharpest of them, because a threat and a telling open with
 * the same words and differ only in whether the harm has already happened.
 */
const NOT_A_TELLING: readonly (readonly [string, string])[] = [
    ['tell me about Cao Antao', 'investigate'],
    ['tell me about myself', 'status'],
    ['tell me about the houses near here', 'sect'],
    ['what can you tell me about the Hollow Court', 'investigate'],
    ['I tell him I am from the Azure Dew Sect', 'interact'],
    ['I tell the elder my name', 'interact'],
    ['I tell him about the road north', 'interact'],
    ['I tell him I took the north road', 'interact'],
    ['I ask him who killed his brother', 'interact'],
    ['I talk to He Peiyi', 'interact'],
    ['I threaten He Peiyi', 'interact'],
    ['I warn him what happens if he does that again', 'interact'],
    ['I steal from He Peiyi', 'interact'],
    ['what news is there', 'news']
];

describe('the phrasings a telling is said in', () => {
    it('all reach the verb', () => {
        const missed = A_TELLING.filter(s => parseIntent(s).action !== 'tell');
        expect(missed, 'every ordinary way of saying it reaches the verb').toEqual([]);
    });

    it('and it takes none of its neighbours', () => {
        const stolen = NOT_A_TELLING
            .map(([sentence, expected]) => ({ sentence, got: parseIntent(sentence).action, expected }))
            .filter(row => row.got !== row.expected);
        expect(stolen, 'the neighbouring phrasings keep their verbs').toEqual([]);
    });

    it('carries the claim and the name in it, and checks neither', () => {
        const plan = parseIntent('I tell He Peiyi that Cao Antao killed his brother');
        expect(plan.target).toBe('He Peiyi');
        expect(plan.topic).toBe('Cao Antao killed his brother');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE RATE TIER: CAN ANYBODY STANDING HERE BE TOLD ANYTHING
// ─────────────────────────────────────────────────────────────────────────

/**
 * Measured at the point the player would notice: the ledger, after typing it.
 *
 * A unit test says what happens when somebody is told. This says whether the
 * people a player can actually reach are people a telling can land on - which
 * is the question a finished module with no live consumer answers wrongly, and
 * the one no unit test ever asks.
 *
 * BOTH EDGES IN ONE ASSERTION, because the set is exactly derivable. A wrong is
 * written against every person standing here, so the only thing separating them
 * is whether the player could carry the news: the gate is that a teller can only
 * repeat a wrong they could point at, and for a stranger's loss they cannot.
 * The floor is that anybody at all is reachable; the ceiling is that a bystander
 * a player cannot even name does not acquire an account because somebody said
 * words near them.
 *
 * MEASURED, world seed `tells-world`, the day a run opens: 5 people present, 3
 * of them nameable by this cultivator, 3 accounts opened. Exact rather than
 * sampled - the deeds are written, the sentences are typed, the rows are
 * counted - so it cannot flake, and it goes red the moment either half of the
 * verb stops firing or the discovery gate stops holding.
 */
describe('who a telling can land on, standing where a run opens', () => {
    it('lands on exactly the people this cultivator can name', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'rate-1', worldSeed: 'tells-world', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        await game.act('I look around');
        const { world, here, where } = await whoIsHere(game, cultivator);
        expect(here.length, 'somebody is here to be told').toBeGreaterThan(1);

        // One wrong per person present, each done by the person after them, so
        // the only thing that varies between them is the player's own standing
        // to carry it.
        for (let at = 0; at < here.length; at++) {
            aWrongDoneTo(world, where, here[(at + 1) % here.length], here[at]);
        }

        const gate = (game as any).knowledge;
        const nameable = here.filter(person =>
            gate.isAwareOf(cultivator.id, 'cultivator', person.id));

        for (const person of here) {
            await game.act(`I tell ${person.name} that somebody stole from them`);
        }

        const rows = ledger(db);
        const holders = [...new Set(rows.map(row => row.holder_id))].sort();
        // The floor. A verb nobody standing here can be told anything by is the
        // defect this tier exists to catch.
        expect(holders.length, `${holders.length} of ${here.length} present people hold anything`)
            .toBeGreaterThan(0);
        // And the ceiling, stated as the exact set rather than as a bound: the
        // people who now hold something are the people the player could name,
        // and nobody else - one account each, none for a bystander.
        expect(holders).toEqual(nameable.map(person => person.id).sort());
        expect(rows.length, 'one account each, not one per bystander').toBe(nameable.length);
    }, 300000);
});
