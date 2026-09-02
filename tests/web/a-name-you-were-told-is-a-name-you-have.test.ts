/**
 * Two channels that were handing the player names they had not earned.
 *
 * The guarantee is stated in `engine/world/history.ts`, on `personName`, and it
 * is the one the whole discovery system rests on: the knowledge layer is keyed
 * by id and everything the player READS is keyed by name, so a name that
 * reaches the player is a name the player now has. `personName` protects it
 * from one end by re-rolling duplicate names. These protect it from the other -
 * two paths that were putting a name in front of the player with no record
 * behind it.
 *
 *   THE OVERHEARD CHANNEL drew people out of a speaker's own vocabulary with no
 *   exclusion for the people standing in the square with them, so two elders
 *   could be overheard discussing somebody eight feet away.
 *
 *   THE REFUSAL for an unrecognised name opened by naming the nearest stranger,
 *   which leaked an identity AND read as a redirect: the player asked for one
 *   person and read a sentence about their words being delivered to another.
 *
 * Both were reproduced before they were fixed, and the reproduction is the
 * test - the assertion is not "the gate is called", it is "the leak that
 * actually happened does not happen."
 *
 * The world is pinned as well as the run (`makeGameInWorld`), because who is
 * standing where is a property of the WORLD seed: run seed alone on a fresh
 * database meets a different several hundred people, and an assertion about
 * which of them the player can name would be pinning a coincidence.
 */

import { describe, it, expect } from 'vitest';
import { npcsAt } from '../../src/engine/world/world-state';
import { KnowledgeGate } from '../../src/web/knowledge';
import { mentionableFor } from '../../src/web/lore';
import { offerHearing, othersPresent } from '../../src/web/hearsay';
import { makeGameInWorld, refusedCall } from './harness';

const WORLD_SEED = 'a-name-you-were-told-world';

/** Every place in this world with at least two people standing in it. */
function crowds(world: any) {
    return world.locations
        .map((location: any) => ({ location, people: npcsAt(world, location.id) }))
        .filter((spot: any) => spot.people.length >= 2)
        .sort((a: any, b: any) => b.people.length - a.people.length);
}

describe('the overheard channel does not name the people in the square', () => {
    it('never says a name belonging to somebody standing there', async () => {
        const { db, game, repos } = await makeGameInWorld({
            worldSeed: WORLD_SEED,
            seed: 'overheard-present'
        });
        const { cultivator, run } = await game.newRun('Ke Yan');
        const world = (await game.loadWorld())!;

        // A house's own ground, because that is where the hazard lives: a
        // speaker's working vocabulary is their own roster, and their own
        // roster is standing around them.
        const spot = crowds(world).find((s: any) => s.location.kind === 'sect_seat')
            ?? crowds(world)[0];

        db.prepare('UPDATE cultivators SET location = ? WHERE id = ?')
            .run(spot.location.name, cultivator.id);
        const standing = repos.cultivators.getById(cultivator.id)!;
        const present = othersPresent(repos, standing, world);
        const presentNames = new Set(present.map(row => row.name.trim().toLowerCase()));

        // The hazard is real before anything is drawn. Without this the test
        // could pass on a fixture where no speaker could have named anybody
        // present, which would be a measurement of nothing.
        const couldName = present.flatMap(speaker =>
            mentionableFor({ ordinal: speaker.realmOrdinal, factionId: speaker.sectId })
                .filter(entry =>
                    entry.kind === 'cultivator'
                    && presentNames.has(entry.name.trim().toLowerCase())));
        expect(
            couldName.length,
            'this fixture only means something where a speaker could name somebody present'
        ).toBeGreaterThan(0);

        const gate = new KnowledgeGate(db);
        let overheard = 0;
        const said: string[] = [];

        // Swept rather than pinned to one draw: the channel returns null far
        // more often than not by design, so a single occasion proves nothing.
        for (let occasion = 0; occasion < 400; occasion++) {
            const hearing = offerHearing({
                repos,
                gate,
                cultivator: standing,
                run,
                occasion: `sweep-${occasion}`,
                world,
                intent: 'listening'
            });
            if (!hearing || hearing.mode !== 'overheard') continue;
            overheard++;
            for (const name of hearing.names) said.push(name.name);
        }

        expect(overheard, 'the sweep has to actually reach the overheard branch').toBeGreaterThan(0);

        const leaked = said.filter(name => presentNames.has(name.trim().toLowerCase()));
        expect(leaked, 'two people do not gossip about somebody eight feet away').toEqual([]);
    }, 300_000);

    it('still finds somebody to talk about when the room is excluded', async () => {
        const { db, game, repos } = await makeGameInWorld({
            worldSeed: WORLD_SEED,
            seed: 'overheard-still-works'
        });
        const { cultivator, run } = await game.newRun('Ke Yan');
        const world = (await game.loadWorld())!;
        const spot = crowds(world)[0];

        db.prepare('UPDATE cultivators SET location = ? WHERE id = ?')
            .run(spot.location.name, cultivator.id);
        const standing = repos.cultivators.getById(cultivator.id)!;
        const gate = new KnowledgeGate(db);

        // The exclusion must narrow the draw, not close the channel. A gate
        // that silences the thing it was protecting is the other way to fail.
        let named = 0;
        for (let occasion = 0; occasion < 400; occasion++) {
            const hearing = offerHearing({
                repos, gate, cultivator: standing, run,
                occasion: `sweep-${occasion}`, world, intent: 'listening'
            });
            if (hearing?.mode === 'overheard') named += hearing.names.length;
        }
        expect(named, 'the overheard channel still drops names').toBeGreaterThan(0);
    }, 300_000);
});

describe('a refusal never hands over the name it refused to find', () => {
    it('does not name an unknown bystander when the target is absent', async () => {
        const { db, game, repos } = await makeGameInWorld({
            worldSeed: WORLD_SEED,
            seed: 'absent-target'
        });
        const { cultivator } = await game.newRun('Ke Yan');
        const world = (await game.loadWorld())!;
        const spot = crowds(world)[0];

        db.prepare('UPDATE cultivators SET location = ? WHERE id = ?')
            .run(spot.location.name, cultivator.id);
        const standing = repos.cultivators.getById(cultivator.id)!;
        const present = othersPresent(repos, standing, world);

        const gate = new KnowledgeGate(db);
        const strangers = present.filter(
            row => !gate.isAwareOf(cultivator.id, 'cultivator', row.id));
        expect(strangers.length, 'the square has to hold somebody unnameable').toBeGreaterThan(0);

        // Somebody real, alive, and somewhere else. This is the shape of the
        // sentence that produced "You put the words to Liang Fuhe" when what
        // had been typed was a different person's name entirely.
        const elsewhere = world.npcs.find((npc: any) =>
            npc.status === 'alive'
            && npc.locationId !== spot.location.id
            && !present.some(row => row.id === npc.id))!;

        const result = await game.act(`I negotiate with ${elsewhere.name}`);
        expect(refusedCall(result), 'an absent person is not somebody you can negotiate with')
            .not.toBeNull();

        for (const stranger of strangers) {
            expect(
                result.narration,
                `the refusal named ${stranger.name}, whom this cultivator cannot name`
            ).not.toContain(stranger.name);
        }

        // And it says what it actually is, so the player is not left believing
        // the words landed on somebody.
        expect(result.narration.toLowerCase()).toContain('answers to that name');
    }, 300_000);
});
