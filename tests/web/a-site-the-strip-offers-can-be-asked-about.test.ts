/**
 * The strip offers `I go into <site>`, and the inspect path denied it existed.
 *
 * Found by playing the suggestion strip: typing "what is <that site>?" returned
 * *"Nothing here answers to it. Unresolved subject: no knowledge record and
 * nothing co-located."* - and the refusal then listed six things it could see,
 * every one of them a person or a house.
 *
 * `resolveAnything` walked asker, cultivator, sect, known place, technique,
 * object, recipe, pill, herb. No site, ever.
 *
 * THE BUG IS THE TWO GATES, NOT THE MISSING BRANCH. `go into` resolves through
 * `siteMeant`, which filters on `nameableSites` and the awareness record; `what
 * is` resolved through a chain that could not see a site at all. Two surfaces
 * answering the same noun from different gates can disagree, and did. These
 * assert that they now share the gate and the matcher, so they agree by
 * construction rather than by both being written correctly.
 */

import { makeGameInWorld } from './harness';
import { nearbyNames, resolveNameableSite } from '../../src/web/entities';
import { nameableSites } from '../../src/web/trials';

/** The gate both surfaces use, as a scope the resolver accepts. */
function scopeThatKnowsEverySite(holderId: string) {
    return {
        gate: {
            isAwareOf: () => true,
            awareness: () => [],
            stageOf: () => 'named'
        },
        holderId,
        here: null
    } as never;
}

function scopeThatKnowsNothing(holderId: string) {
    return {
        gate: {
            isAwareOf: () => false,
            awareness: () => [],
            stageOf: () => 'unaware'
        },
        holderId,
        here: null
    } as never;
}

describe('asking what a site is', () => {
    it('answers, at the same gate the going-in verb uses', () => {
        const anySite = nameableSites(() => true)[0];
        const found = resolveNameableSite(anySite.name, scopeThatKnowsEverySite('who'));
        expect(found, anySite.name).not.toBeNull();
        expect(found!.kind).toBe('site');
        expect(found!.id).toBe(anySite.id);
    });

    /**
     * The id slug is where the short distinctive phrase lives, and it is the
     * same matcher `siteMeant` hands the query to.
     */
    it('answers to the phrase inside the id, not only the display name', () => {
        const site = nameableSites(() => true).find(s => s.id.split('-').length > 2)!;
        const phrase = site.id.split('-').slice(1).join(' ');
        expect(resolveNameableSite(phrase, scopeThatKnowsEverySite('who'))?.id).toBe(site.id);
    });

    /** And it stops at the threshold: `faceOf` has no interior key to leak. */
    it('gives the marker and never the inside', () => {
        const site = nameableSites(() => true).find(s => s.kind === 'grave')!;
        const found = resolveNameableSite(site.name, scopeThatKnowsEverySite('who'))!;
        expect(found.facts.join(' ')).toContain(site.outside.marker.slice(0, 40));
        for (const line of found.facts) {
            expect(line).not.toContain(site.interior.afterwards ?? '\u0000never');
        }
        expect(found.facts.join(' ')).toMatch(/Going in is a different sentence/);
    });

    /**
     * The gate is real. A cultivator who holds no record still reaches the
     * sites the catalog itself opens at `named` - that is authored content and
     * is the same set `go into` offers - and reaches nothing else.
     */
    it('is gated on exactly what the going-in verb is gated on', () => {
        const withRecords = nameableSites(() => true).length;
        const without = nameableSites(() => false).length;
        expect(without).toBeLessThan(withRecords);

        const withheld = nameableSites(() => true)
            .find(s => !nameableSites(() => false).some(open => open.id === s.id))!;
        expect(resolveNameableSite(withheld.name, scopeThatKnowsNothing('who'))).toBeNull();
        expect(resolveNameableSite(withheld.name, scopeThatKnowsEverySite('who'))).not.toBeNull();
    });

    /** No scope is nobody asking, and it answers nothing rather than everything. */
    it('answers nothing when nobody supplied a gate', () => {
        const anySite = nameableSites(() => true)[0];
        expect(resolveNameableSite(anySite.name, undefined)).toBeNull();
    });
});

describe('and the refusal stops claiming the parser only knows people', () => {
    /**
     * THE ACCEPTANCE TEST, and it was free and already in the output: the
     * refusal prints "Known to this cultivator, or standing here:" and listed
     * six entries, all people and houses, because `nearbyNames` filtered the
     * awareness rows to `cultivator | sect` and nothing else.
     */
    it('lists ground among the things the player could have meant', async () => {
        const { game, db } = await makeGameInWorld({ seed: 'sr', worldSeed: 'world-sr-2' });
        const { cultivator } = await game.newRun('Looker');
        const scope = { gate: game.knowledge, holderId: cultivator.id, here: null } as never;

        const listed = nearbyNames((game as never as { repos: never }).repos, cultivator, scope, 12);
        const sites = nameableSites(id => game.knowledge.isAwareOf(cultivator.id, 'place', id));
        expect(sites.length).toBeGreaterThan(0);
        expect(listed.some(name => sites.some(site => site.name === name))).toBe(true);
        void db;
    });
});

describe('played, on a pinned world', () => {
    /**
     * Before the branch and the ordering, this came back "The Tended Tomb,
     * which is a name and a road and not much else that anyone here can tell
     * you" - the generic place fallback, about a grave whose marker the engine
     * can read out in full. `resolveKnownPlace` was swallowing it.
     */
    it('tells the player what the ground is rather than that it is a name and a road', async () => {
        const { game } = await makeGameInWorld({ seed: 'sr', worldSeed: 'world-sr-1' });
        const { cultivator } = await game.newRun('Looker');
        const site = nameableSites(id => game.knowledge.isAwareOf(cultivator.id, 'place', id))
            .find(s => s.kind === 'grave')!;

        const asked = await game.act(`tell me about ${site.name}`);
        expect(asked.narration).not.toMatch(/a name and a road/i);
        expect(asked.narration).toContain(site.outside.marker.slice(0, 30));
    });
});
