/**
 * The people who are actually standing there.
 *
 * Found by playing: nineteen souls at Sweptground, and the player could not see
 * one of them. `/api/admin/roster` reported them with real locations while
 * `interact` found nobody present and every social path dead-ended.
 *
 * The cause was a key mismatch, not a missing feature. A cultivator's
 * `location` is free text by design - `"Sweptground"` - and a world NPC's is a
 * location id - `loc-region-low-fall-sweptground`. Co-location compared the two
 * and never matched, so the world's population was invisible to the half of the
 * game that talks to people.
 *
 * These tests are about the join, and about what a player is allowed to see
 * through it: being in the room is permission to SEE somebody, never permission
 * to know who they are.
 */

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { npcsAt } from '../../src/engine/world/world-state';
import { worldLocationFor } from '../../src/web/entities';
import { KnowledgeGate } from '../../src/web/knowledge';
import { worldForRun, resetCultivationWorlds } from '../../src/server/state/cultivation-world';
import { makeGame, engineCalls, refusedCall, planned } from './harness';

function inWorld(seed: string) {
    return makeGame({ seed, worldEnabled: true });
}

/** A place the seeded world actually has people in. */
async function populatedPlace(game: ReturnType<typeof inWorld>['game']) {
    const world = (await game.loadWorld())!;
    const settlements = world.locations
        .map(l => ({ location: l, people: npcsAt(world, l.id) }))
        .filter(x => x.people.length >= 2)
        .sort((a, b) => b.people.length - a.people.length);
    return { world, ...settlements[0] };
}

describe('the join between a place name and a world location', () => {
    it('matches the display name the player types', async () => {
        resetCultivationWorlds();
        const { game } = inWorld('join');
        await game.newRun('Ke Yan');
        const world = (await game.loadWorld())!;

        const named = world.locations.find(l => l.name === 'Sweptground');
        expect(named, 'the seeded world should contain Sweptground').toBeDefined();

        // The exact comparison that used to fail.
        expect(worldLocationFor(world, 'Sweptground')?.id).toBe(named!.id);
        expect(named!.id).not.toBe('Sweptground');
    }, 60_000);

    it('tolerates the article and the keyed form', async () => {
        resetCultivationWorlds();
        const { game } = inWorld('join2');
        await game.newRun('Ke Yan');
        const world = (await game.loadWorld())!;
        const sample = world.locations.find(l => l.kind === 'settlement')!;

        expect(worldLocationFor(world, sample.name)?.id).toBe(sample.id);
        expect(worldLocationFor(world, sample.id)?.id).toBe(sample.id);
        expect(worldLocationFor(world, 'a place nobody named')).toBeNull();
        expect(worldLocationFor(world, null)).toBeNull();
    }, 60_000);
});

describe('people are visible where they are standing', () => {
    it('reports who is here rather than an empty square', async () => {
        resetCultivationWorlds();
        const { db, game } = inWorld('present');
        const { cultivator } = await game.newRun('Ke Yan');
        const { location, people } = await populatedPlace(game);

        db.prepare('UPDATE cultivators SET location = ? WHERE id = ?')
            .run(location.name, cultivator.id);

        const result = await game.act('who is here');
        expect(planned(result).action).toBe('look');

        // Somebody is reported, and the count reaches the inspector.
        expect(result.narration).toMatch(/people are about|is here|others are about/i);
        const mechanical = engineCalls(result).map(c => c.summary).join(' ') +
            result.state.log.filter(e => e.role === 'engine').map(e => e.text).join(' ');
        // The count, not the field name. The engine channel is read by the
        // player as well as by an operator, so it states its figures in
        // sentences - `present=10` became "10 present: 3 this cultivator can
        // put a name to, 7 they cannot". What this test is for is that the
        // number reaches the inspector at all, and it still does.
        expect(mechanical).toMatch(new RegExp(`${people.length} present\\b`));
    }, 60_000);

    it('does not hand over a census', async () => {
        resetCultivationWorlds();
        const { db, game } = inWorld('census');
        const { cultivator } = await game.newRun('Ke Yan');
        const { location, people } = await populatedPlace(game);
        expect(people.length).toBeGreaterThan(5);

        db.prepare('UPDATE cultivators SET location = ? WHERE id = ?')
            .run(location.name, cultivator.id);

        const result = await game.act('who is around');
        // A square, not a register: the crowd is a crowd, and at most one
        // figure is lifted out of it.
        const mentions = people.filter(p => result.narration.includes(p.name)).length;
        expect(mentions).toBeLessThanOrEqual(4);
        expect(result.narration).toMatch(/people are about|one of them is/i);
        // Five identical clauses is what the first version of this did.
        expect((result.narration.match(/is here/gi) ?? []).length).toBeLessThanOrEqual(1);
    }, 60_000);

    it('names nobody the player has not learned of', async () => {
        resetCultivationWorlds();
        const { db, game } = inWorld('gate');
        const { cultivator } = await game.newRun('Ke Yan');
        const { location, people } = await populatedPlace(game);

        db.prepare('UPDATE cultivators SET location = ? WHERE id = ?')
            .run(location.name, cultivator.id);

        const result = await game.act('who is here');

        // Seeing somebody is not knowing them. Until a name has reached this
        // cultivator from a source, everybody present is a description.
        for (const person of people) {
            expect(result.narration, `${person.name} was named unearned`).not.toContain(person.name);
        }
        expect(result.narration).toMatch(/people are about|one of them is/i);
    }, 60_000);

    it('lets the player approach one of them', async () => {
        resetCultivationWorlds();
        const { db, game } = inWorld('approach');
        const { cultivator } = await game.newRun('Ke Yan');
        const { location, people } = await populatedPlace(game);

        db.prepare('UPDATE cultivators SET location = ? WHERE id = ?')
            .run(location.name, cultivator.id);

        const target = people[0];
        const result = await game.act(`I speak with ${target.name}`);

        expect(planned(result).action).toBe('interact');
        expect(refusedCall(result)?.name).not.toBe('engine.resolveParty');
        expect(engineCalls(result)[0].summary).toContain(target.name);

        // And the encounter is written down, with its source.
        const gate = new KnowledgeGate(db);
        expect(gate.isAwareOf(cultivator.id, 'cultivator', target.id)).toBe(true);
    }, 60_000);

    it('still finds nobody on an empty road', async () => {
        resetCultivationWorlds();
        const { db, game } = inWorld('road');
        const { cultivator } = await game.newRun('Ke Yan');
        db.prepare("UPDATE cultivators SET location = 'a bend in the road nobody named' WHERE id = ?")
            .run(cultivator.id);

        const result = await game.act('who is here');
        expect(result.narration).not.toMatch(/people are about|one of them is/i);
    }, 60_000);
});

describe('who is here is a look, not a new action', () => {
    it('covers the phrasings anybody types first', async () => {
        const { game } = makeGame({ seed: 'phrasings' });
        await game.newRun('Ke Yan');

        for (const input of ['who is here', 'who is around', 'is anyone about', 'look for someone']) {
            const result = await game.act(input);
            expect(planned(result).action, `input: ${input}`).toBe('look');
        }
    });

    it('costs nothing', async () => {
        const { db, game } = makeGame({ seed: 'freelook' });
        const { cultivator } = await game.newRun('Ke Yan');
        const before = db.prepare('SELECT * FROM cultivators WHERE id = ?').get(cultivator.id);

        const result = await game.act('who is here');
        expect(db.prepare('SELECT * FROM cultivators WHERE id = ?').get(cultivator.id)).toEqual(before);
        expect(result.state.run.elapsedDays).toBe(0);
    });
});

describe('the mortal economy is priced in the currency it uses', () => {
    it('quotes ordinary goods in cash, not in fractions of a stone', async () => {
        const { game } = makeGame({ seed: 'prices' });
        await game.newRun('Ke Yan');

        const result = await game.act('what is for sale here');
        const shown = result.narration;

        expect(shown).toMatch(/\d+ cash/);
        // The thing that made the board unreadable.
        expect(shown).not.toMatch(/0\.\d+ spirit stones/);
    });

    it('says what is out of reach once, about the purse', async () => {
        const { db, game } = makeGame({ seed: 'broke' });
        const { cultivator } = await game.newRun('Ke Yan');
        db.prepare('UPDATE cultivators SET spirit_stones = 0 WHERE id = ?').run(cultivator.id);

        const shown = (await game.act('what is for sale here')).narration;

        // Once, about the player - not once per item, about the millet.
        expect((shown.match(/out of reach/gi) ?? []).length).toBeLessThanOrEqual(1);
        expect(shown).toMatch(/purse holds/i);
    });
});

describe('sects are reachable from plain English', () => {
    it('routes looking for a sect to the sect surface', async () => {
        const { game } = makeGame({ seed: 'sects' });
        await game.newRun('Ke Yan');

        for (const input of [
            'I look for a sect that will take me',
            'find a sect',
            'who would take me',
            'what sects are near',
            'I want to join a sect',
            'ask about joining'
        ]) {
            expect(planned(await game.act(input)).action, `input: ${input}`).toBe('sect');
        }
    });

    it('offers only the orders this cultivator has heard of', async () => {
        const { db, game } = makeGame({ seed: 'gatedsects' });
        const { cultivator } = await game.newRun('Ke Yan');
        const gate = new KnowledgeGate(db);

        const heard = gate.awareness(cultivator.id, 'sect').map(r => r.name);
        expect(heard.length).toBeGreaterThan(0);

        const result = await game.act('I look for a sect that will take me');
        const shown = result.narration;

        for (const name of heard) expect(shown).toContain(name);

        // And the register stays shut: the tool returns every admissible sect
        // in the campaign, and the player sees the ones somebody has named.
        const mechanical = engineCalls(result).map(c => c.summary).join(' ');
        expect(mechanical).toMatch(/admissible/);
    });

    it('joins a sect the player can actually name', async () => {
        const { db, game } = makeGame({ seed: 'joining' });
        const { cultivator } = await game.newRun('Ke Yan');
        const gate = new KnowledgeGate(db);
        const known = gate.awareness(cultivator.id, 'sect')[0];

        const result = await game.act(`I ask about joining the ${known.name}`);
        expect(planned(result).action).toBe('sect');
        expect(engineCalls(result).map(c => c.name)).toContain('sect_manage.join');
    });

    it('says the joining happened, not that the sect is finished', async () => {
        const { db, game } = makeGame({ seed: 'joinprose' });
        const { cultivator } = await game.newRun('Ke Yan');
        const gate = new KnowledgeGate(db);
        const known = gate.awareness(cultivator.id, 'sect')[0];

        const shown = (await game.act(`I ask about joining the ${known.name}`)).narration;

        // The live check read "The Gleaners' Company is done." - the sect
        // surface returns a membership record and no narration hint, so the
        // last-resort line predicated on the subject and told the player the
        // order had ended.
        expect(shown).not.toMatch(new RegExp(`${known.name}\\s+is done`, 'i'));
        expect(shown).toMatch(/taken on|no longer of/i);
    });

    it('never predicates the last-resort line on its subject', async () => {
        // Whatever a tool returns without a narration hint, the fallback may
        // report that the act went through. It may not make a claim about the
        // thing acted upon.
        const source = readFileSync('src/web/game.ts', 'utf-8');
        expect(source).not.toContain('${subject} is done.');
    });
});
