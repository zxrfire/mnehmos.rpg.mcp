/**
 * Whether something was a theft is a question the world answers.
 *
 * THE RULING
 * ----------
 *   Saying "take" about something that is not yours - and is not genuinely
 *   free, like an apple in the middle of nowhere - is stealing.
 *
 * WHAT WAS MEASURED, on this table, before any of this existed:
 *
 *   "I relieve him of his purse"               -> unclear
 *   "I collect what I am owed from his rooms"  -> sect / stipend
 *   "I pick up the manual on my way out"       -> learn_technique
 *   "I help myself to what is on the rack"     -> site / take
 *   "I make free with his jade"                -> unclear
 *   "I take my own sword"                      -> unclear
 *
 * Four benign acts and two nothings, from six sentences of which exactly one is
 * somebody handling their own property.
 *
 * WHAT IS BEING PINNED
 * --------------------
 * That the three states are told apart by ROWS and not by words, and that the
 * middle one lands in the theft path that already exists rather than in a
 * second one. The played cases pin BOTH seeds: a run seed alone pins a
 * coincidence, because a run is lived inside a world.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { parseIntent } from '../../src/web/actions.js';
import {
    whatIsStandingFreeAt,
    whoseThingIsThis,
    whoTheSentenceSaysItIs
} from '../../src/web/a-taking-is-decided-by-ownership.js';
import { makeObject, type ObjectRecord } from '../../src/engine/world/possessions.js';

const WORLD = 'whose-thing-is-this';

function aSword(init: {
    id: string;
    possessorId?: string | null;
    ownerId?: string | null;
    locationId?: string | null;
}): ObjectRecord {
    return makeObject({
        id: init.id,
        name: 'A plain iron sword',
        kind: 'artifact',
        significance: 'notable',
        possessorId: init.possessorId ?? null,
        ownerId: init.ownerId ?? null,
        ownerName: init.ownerId ? 'somebody' : '',
        locationId: init.locationId ?? null
    });
}

// ─────────────────────────────────────────────────────────────────────────
// THE READER ROUTES IT. IT DOES NOT DECIDE IT
// ─────────────────────────────────────────────────────────────────────────

describe('the sentences that produced the ruling', () => {
    it('routes every one of them to the resolver that asks whose it is', () => {
        for (const said of [
            'I relieve him of his purse',
            'I collect what I am owed from his rooms',
            'I pick up the manual on my way out',
            'I help myself to what is on the rack',
            'I make free with his jade',
            'I take my own sword',
            // The one whose meaning is entirely in the second clause: borrowing
            // is a request and stays one, and the not-giving-back is what makes
            // this a taking. An idiom rather than a verb, for that reason.
            'I borrow his blade and do not give it back'
        ]) {
            const plan = parseIntent(said);
            expect(plan.action, said).toBe('interact');
            // `take`, not `steal`. Nothing in any of these sentences says whose
            // the thing is except the fifth and the sixth, and they disagree.
            expect(plan.intent, said).toBe('take');
            expect((plan.topic ?? '').length, said).toBeGreaterThan(1);
        }
    });

    it('leaves every sentence the theft row already reads where it was', () => {
        // The demonstrated gap and not an imagined one: these say what they
        // are, have reached the theft path since the pressure model was wired,
        // and relabelling them would be churn rather than a fix.
        for (const said of [
            'I steal his purse',
            'I take his purse',
            "I take Cao Antao's purse",
            'I rob the merchant',
            'I pick his pocket'
        ]) {
            expect(parseIntent(said).intent, said).toBe('steal');
        }
    });

    it('does not take a sentence off the verbs that own one', () => {
        // Each of these is a row that runs BELOW the taking row and is deferred
        // to explicitly. A taking that ate one of them would have traded a
        // whole surface for this one.
        expect(parseIntent('I take the carriage to Iron Gate').action).toBe('ride');
        expect(parseIntent('I take the pill').action).toBe('consume_pill');
        expect(parseIntent("I'll take the manual").action).toBe('buy');
        expect(parseIntent('I take a manual from the sect library without asking').action)
            .toBe('sect');
        expect(parseIntent('I take the road east').action).not.toBe('interact');
        expect(parseIntent('I take work').action).toBe('work');
        // And the apple in the middle of nowhere is still foraging, which is
        // the find path this world already had.
        expect(parseIntent('I pick up the apple').action).toBe('gather');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE ONE THING THE SENTENCE IS ASKED
// ─────────────────────────────────────────────────────────────────────────

describe('what the sentence says about whose it is', () => {
    it('reads a possessive as somebody else, and nothing else as anything', () => {
        expect(whoTheSentenceSaysItIs('I relieve him of his purse')).toBe('somebody-elses');
        expect(whoTheSentenceSaysItIs("I take Cao Antao's jade")).toBe('somebody-elses');
        expect(whoTheSentenceSaysItIs('I take my own sword')).toBe('mine');
        expect(whoTheSentenceSaysItIs('I take my sword')).toBe('mine');
        expect(whoTheSentenceSaysItIs('I help myself to what is on the rack')).toBe('unsaid');
    });

    it('does not read "on my way out" as a claim of ownership over a way', () => {
        // The measured sentence. `my` is admitted only in front of something
        // portable for exactly this reason.
        expect(whoTheSentenceSaysItIs('I pick up the manual on my way out')).toBe('unsaid');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE DECISION, WHICH IS PURE
// ─────────────────────────────────────────────────────────────────────────

describe('three states, and only the middle one is a theft', () => {
    const mine = aSword({ id: 'obj-mine', possessorId: 'player', ownerId: 'player' });
    const theirs = aSword({ id: 'obj-theirs', possessorId: 'npc-1', ownerId: 'npc-1' });
    const loose = aSword({ id: 'obj-loose', locationId: 'Nowhere In Particular' });
    const holder = { id: 'npc-1', name: 'Wei Lanya' };

    it('says yours when the row is already in your hands', () => {
        const answer = whoseThingIsThis({
            said: 'plain iron sword',
            yours: [{ object: mine, because: 'carried' }],
            theirs: [{ holder, within: [{ object: theirs, because: 'carried' }] }],
            free: [],
            saysItIs: 'somebody-elses'
        });
        // And the sentence saying "his" does not overrule the row. A possessive
        // is a claim; a row is a fact.
        expect(answer.state).toBe('yours');
        expect(answer.object?.id).toBe('obj-mine');
    });

    it('says theirs when somebody standing here has it', () => {
        const answer = whoseThingIsThis({
            said: 'plain iron sword',
            yours: [],
            theirs: [{ holder, within: [{ object: theirs, because: 'carried' }] }],
            free: [],
            saysItIs: 'unsaid'
        });
        expect(answer.state).toBe('theirs');
        expect(answer.holder).toEqual(holder);
    });

    it('says nobody\'s for a thing nobody holds and nobody owns', () => {
        const answer = whoseThingIsThis({
            said: 'plain iron sword',
            yours: [],
            theirs: [{ holder, within: [] }],
            free: [loose],
            saysItIs: 'unsaid'
        });
        expect(answer.state).toBe('nobodys');
        expect(answer.ground).toBe('standing-free');
        expect(answer.object?.id).toBe('obj-loose');
    });

    it('prefers the free row over a bystander, so nothing near a person is theirs by proximity', () => {
        const answer = whoseThingIsThis({
            said: 'plain iron sword',
            yours: [],
            theirs: [{ holder, within: [{ object: theirs, because: 'carried' }] }],
            free: [loose],
            saysItIs: 'unsaid'
        });
        expect(answer.state).toBe('nobodys');
    });

    it('falls back to the sentence only where the world has no row', () => {
        // A purse is a number on a person and has no object row, which is why
        // `whatALiftTook` exists at all. The sentence supplies "somebody
        // else's"; the world supplies who.
        const answer = whoseThingIsThis({
            said: 'his purse',
            yours: [], theirs: [{ holder, within: [] }], free: [],
            saysItIs: 'somebody-elses'
        });
        expect(answer.state).toBe('theirs');
        expect(answer.holder).toEqual(holder);
        expect(answer.object).toBeNull();
    });

    it('is nobody\'s when the sentence says somebody else and nobody is here', () => {
        const answer = whoseThingIsThis({
            said: 'his purse',
            yours: [], theirs: [], free: [],
            saysItIs: 'somebody-elses'
        });
        expect(answer.state).toBe('nobodys');
        // And the two nobody's cases are not collapsed: there is nothing to
        // take, which is not the same fact as a thing standing free.
        expect(answer.ground).toBe('nobody-holds-it');
    });
});

describe('what is standing free', () => {
    it('requires nobody holding it, nobody owning it, and being here', () => {
        const here = 'Nowhere In Particular';
        const free = aSword({ id: 'a', locationId: here });
        const owned = aSword({ id: 'b', ownerId: 'npc-1', locationId: here });
        const held = aSword({ id: 'c', possessorId: 'npc-1', locationId: here });
        const elsewhere = aSword({ id: 'd', locationId: 'Iron Gate' });
        const world = { objects: [free, owned, held, elsewhere] } as never;

        expect(whatIsStandingFreeAt(world, here).map(o => o.id)).toEqual(['a']);
        // A hull moored at its owner's dock is somebody's. Reading only
        // `possessorId` would have made every unattended boat in the world free.
        expect(whatIsStandingFreeAt(world, null)).toEqual([]);
    });

    it('leaves the counted tier alone, which has no identity to take', () => {
        const millet = makeObject({
            id: 'obj-millet', name: 'A bowl of millet', kind: 'material',
            significance: 'mundane', locationId: 'Nowhere In Particular'
        });
        const world = { objects: [millet] } as never;
        expect(whatIsStandingFreeAt(world, 'Nowhere In Particular')).toEqual([]);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// PLAYED, ON A PINNED WORLD, ONCE FOR EACH STATE
// ─────────────────────────────────────────────────────────────────────────

async function aRunInThePinnedWorld(seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: WORLD });
    const { cultivator } = await harness.game.newRun('Shen Wu');
    await harness.game.act('I look around');
    const world = await harness.game.loadWorld();
    const here = harness.game.state().cultivator.location ?? '';
    return { harness, cultivator, world, here };
}

describe('played: yours', () => {
    it('reports a thing already in your hands and spends nothing', async () => {
        const { harness, cultivator, world, here } = await aRunInThePinnedWorld('taking-yours');
        world.objects.push(aSword({
            id: 'obj-own-sword', possessorId: cultivator.id, ownerId: cultivator.id
        }));

        const daysBefore = harness.game.state().run.elapsedDays;
        const turn = await harness.game.act('I take my own plain iron sword');

        const text = JSON.stringify(turn).toLowerCase();
        expect(text).toContain('already yours');
        expect(harness.game.state().run.elapsedDays).toBe(daysBefore);

        const after = (await harness.game.loadWorld()).objects
            .find(row => row.id === 'obj-own-sword')!;
        expect(after.possessorId).toBe(cultivator.id);
        // Nothing happened, so nothing was written down about it happening.
        expect(after.provenance).toHaveLength(0);
        expect(here.length).toBeGreaterThan(0);
    }, 120000);
});

describe('played: nobody\'s', () => {
    it('picks up a thing nobody holds and nobody owns, and opens no account', async () => {
        const { harness, cultivator, world, here } = await aRunInThePinnedWorld('taking-free');
        world.objects.push(aSword({ id: 'obj-apple-sword', locationId: here }));

        await harness.game.act('I pick up the plain iron sword');

        const after = (await harness.game.loadWorld()).objects
            .find(row => row.id === 'obj-apple-sword')!;
        expect(after.possessorId).toBe(cultivator.id);
        // A find, not a theft, and the two have opposite signs on every
        // consequence. The provenance says which it was.
        const last = after.provenance[after.provenance.length - 1];
        expect(last.how).toBe('found');
        // Possession moves; ownership does not, on this route as on every
        // other. A claim surfacing later reads where it was picked up.
        expect(after.ownerId).toBeNull();

        const obligations = harness.db
            .prepare('SELECT COUNT(*) AS n FROM obligations').get() as { n: number };
        expect(obligations.n).toBe(0);
    }, 120000);
});

describe('played: theirs', () => {
    it('reaches the theft path that already existed, with the holder as the party', async () => {
        const { harness, cultivator, world, here } = await aRunInThePinnedWorld('taking-theirs');
        expect(cultivator.id.length + here.length).toBeGreaterThan(0);
        // Off the same roster the verb reads, rather than off a query of my
        // own: `othersPresent` joins the stored table to the world's several
        // hundred people, and a test that looked at only one of the two would
        // be arranging a situation the engine cannot see.
        const someone = harness.game.present(harness.game.state().cultivator)[0];
        expect(someone, 'the pinned world opened with nobody standing here').toBeDefined();

        world.objects.push(aSword({
            id: 'obj-their-sword', possessorId: someone!.id, ownerId: someone!.id
        }));

        const turn = await harness.game.act('I help myself to the plain iron sword');
        const calls = JSON.stringify(turn.inspector ?? turn);

        // The taking became the EXISTING theft: the party was resolved off the
        // world rather than off the sentence, which named nobody at all.
        expect(calls).toContain(someone!.name);
        // And the pressure model priced it, which is the one resolver a theft
        // has ever gone through.
        expect(calls).toMatch(/resolveAttempt|approach|steal/i);
    }, 120000);
});
