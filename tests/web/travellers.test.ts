/**
 * The road, wired up.
 *
 * THE PROBLEM THESE TESTS EXIST FOR
 * ---------------------------------
 * Measured across seven playthroughs of the web UI from a clean database: the
 * cultivator's knowledge table held exactly ONE place record in every run.
 * `world_locations` held 33 rows and 32 of them were unreachable, because
 * travel is gated on being able to name a destination and nothing in the game
 * ever granted a place name. Asking never yielded one either - the stock reply
 * was "The one nearest to hand hears the question out and does not answer it",
 * and two entirely different questions came back byte-identical. A run was
 * therefore confined to one thin-qi settlement for its whole life, cultivation
 * was halved for ever, and the ladder became unclimbable around ordinal 16.
 *
 * Three things close that hole and each has a test here:
 *
 *   the county floor    a new cultivator can name where they are FROM, not
 *                       only where they are standing
 *   the traveller       somebody comes through, says where they came from,
 *                       and leaves - the one source a cultivator who never
 *                       goes anywhere actually has
 *   asking              a question that lands on nothing is a deflection
 *                       rather than a wall, and a deflection can still drop
 *                       the one thing on the way out
 */

import { describe, it, expect } from 'vitest';
import type Database from 'better-sqlite3';
import { KnowledgeGate } from '../../src/web/knowledge';
import { localGeographyFor } from '../../src/web/lore';
import { offerHearing, recordHearing, travellerHearing } from '../../src/web/hearsay';
import { askedAbout } from '../../src/web/asked';
import { ensureCultivationDb } from '../../src/server/consolidated/cultivation-support';
import { forStream } from '../../src/engine/cultivation/rng';
import { passingThrough } from '../../src/engine/social/travellers';
import { makeGame } from './harness';

/** A run, with the knowledge layer's own starting floor applied. */
async function villager(seed = 'traveller-seed') {
    const { db, game } = makeGame({ seed });
    const { cultivator } = await game.newRun('Villager');
    const gate = new KnowledgeGate(db);
    gate.seedStartingAwareness(cultivator.id, 0, cultivator.location ?? '', null);
    return { db, game, gate, cultivator, run: game.state().run as never };
}

function placePerson(
    db: Database.Database,
    id: string,
    name: string,
    where: string,
    opts: { ordinal?: number; sectId?: string | null } = {}
): void {
    const now = new Date().toISOString();
    db.prepare(`
        INSERT INTO cultivators (
            id, run_id, name, kind, spirit_root, attributes, realm_ordinal,
            cultivation_progress, hp, max_hp, qi, max_qi, satiety, starvation_turns,
            age, years_at_current_realm, spirit_stones, sect_id, sect_rank, location,
            feuds, known_techniques, alive, death_cause, died_on_turn, created_at, updated_at
        ) VALUES (
            @id, NULL, @name, 'npc', 'single_water',
            '{"might":2,"insight":2,"fortune":1,"charm":2}', @ordinal,
            0, 60, 60, 30, 30, 100, 0, 40, 2, 200, @sectId, NULL, @where,
            '[]', '[]', 1, NULL, NULL, @now, @now
        )
    `).run({
        id, name, where, now,
        ordinal: opts.ordinal ?? 10,
        sectId: opts.sectId ?? null
    });
}

// ─────────────────────────────────────────────────────────────────────────
// THE COUNTY FLOOR
// ─────────────────────────────────────────────────────────────────────────

describe('the county a person grew up in', () => {
    it('gives every birth somewhere other than home to point at', async () => {
        const { gate, cultivator } = await villager();
        const geography = localGeographyFor(cultivator.location);

        expect(geography.neighbours.length).toBeGreaterThan(0);
        for (const place of geography.neighbours) {
            expect(gate.stageOf(cultivator.id, 'place', place.id)).toBe('placed');
            expect(gate.canPointAt(cultivator.id, 'place', place.id)).toBe(true);
        }
    });

    it('stops at the border: the next province is a name and nothing more', async () => {
        const { gate, cultivator } = await villager();
        const geography = localGeographyFor(cultivator.location);

        expect(geography.further.length).toBeGreaterThan(0);
        for (const place of geography.further) {
            expect(gate.stageOf(cultivator.id, 'place', place.id)).toBe('named');
            expect(gate.canPointAt(cultivator.id, 'place', place.id)).toBe(false);
        }
    });

    it('is a floor and never a demotion', async () => {
        const { gate, cultivator } = await villager();
        const geography = localGeographyFor(cultivator.location);
        const neighbour = geography.neighbours[0];

        // Somebody who has actually been there, and then the floor applied
        // again on a later life event. The stronger record stands.
        gate.learn({
            holderId: cultivator.id,
            kind: 'place',
            id: neighbour.id,
            name: neighbour.name,
            onDay: 30,
            sourceKind: 'witnessed',
            sourceNote: 'Stood in it.',
            stage: 'known'
        });
        gate.seedStartingAwareness(cultivator.id, 40, cultivator.location ?? '', null);

        expect(gate.stageOf(cultivator.id, 'place', neighbour.id)).toBe('known');
    });

    it('writes no second row when it is applied twice', async () => {
        const { db, gate, cultivator } = await villager();
        const count = () => (db
            .prepare('SELECT COUNT(*) AS n FROM knowledge_records WHERE holder_id = ?')
            .get(cultivator.id) as { n: number }).n;

        const before = count();
        gate.seedStartingAwareness(cultivator.id, 0, cultivator.location ?? '', null);
        gate.seedStartingAwareness(cultivator.id, 99, cultivator.location ?? '', null);
        expect(count()).toBe(before);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// TRAVELLERS
// ─────────────────────────────────────────────────────────────────────────

describe('travellers show up', () => {
    it('arrives in an ordinary scene with nobody else in it', async () => {
        const { gate, cultivator, run } = await villager();
        const repos = ensureCultivationDb();

        let passing = 0;
        for (let i = 0; i < 200; i++) {
            const heard = offerHearing({ repos, gate, cultivator, run, occasion: `t-${i}` });
            if (heard?.mode === 'passing') passing++;
        }
        // Nobody lives here, nobody is being spoken to, and names still arrive.
        // Before this channel existed the answer was zero, for ever.
        expect(passing).toBeGreaterThan(5);
    });

    it('brings places, which is what the other channels are worst at', async () => {
        const { gate, cultivator, run } = await villager();
        const repos = ensureCultivationDb();

        for (let i = 0; i < 300; i++) {
            const heard = offerHearing({ repos, gate, cultivator, run, occasion: `p-${i}` });
            if (!heard) continue;
            if (heard.mode === 'passing') {
                for (const name of heard.names) expect(name.kind).toBe('place');
            }
            recordHearing(gate, cultivator, run, heard);
        }

        const geography = localGeographyFor(cultivator.location);
        const foreign = gate.awareness(cultivator.id, 'place')
            .filter(row => gate.canPointAt(cultivator.id, 'place', row.id))
            .filter(row => !geography.neighbours.some(n => n.name === row.name))
            .filter(row => row.name !== cultivator.location);

        // Places outside the county the cultivator could now actually set out
        // for. That is the whole of what was missing.
        expect(foreign.length).toBeGreaterThan(0);
    });

    it('places where they came from and only whispers what else they said', async () => {
        const traveller = passingThrough({
            rng: forStream('fixed', 'traveller'),
            unknownPlaces: [
                { id: 'Iron Gate', name: 'Iron Gate', regionId: 'far' },
                { id: 'Six Li', name: 'Six Li', regionId: 'far' }
            ],
            hereRegionId: 'home',
            traffic: 1,
            listening: true
        })!;
        expect(traveller).not.toBeNull();

        const hearing = travellerHearing(traveller);
        expect(hearing.mode).toBe('passing');
        expect(hearing.sourceKind).toBe('told');
        expect(hearing.names[0].stage).toBe('placed');
        for (const name of hearing.names.slice(1)) expect(name.stage).toBe('whisper');
    });

    it('writes the record before any prose exists, at the stage it earned', async () => {
        const { gate, cultivator, run } = await villager();
        const repos = ensureCultivationDb();

        let recorded = false;
        for (let i = 0; i < 300 && !recorded; i++) {
            const heard = offerHearing({
                repos, gate, cultivator, run, occasion: `w-${i}`, intent: 'listening'
            });
            if (heard?.mode !== 'passing') continue;
            const learned = recordHearing(gate, cultivator, run, heard);
            if (learned.length === 0) continue;

            const origin = heard.names[0];
            expect(gate.stageOf(cultivator.id, 'place', origin.id)).toBe('placed');
            const row = gate.awareness(cultivator.id, 'place')
                .find(entry => entry.name === origin.name)!;
            expect(row.sourceKind).toBe('told');
            // Honest provenance: a hundred turns later this sentence is what
            // tells the player which of their two names for a thing to trust.
            expect(row.sourceNote).toMatch(/come from/i);
            expect(row.sourceNote).toContain(origin.name);
            expect(row.statement).not.toMatch(/sect|province|famous/i);
            recorded = true;
        }
        expect(recorded).toBe(true);
    });

    it('never hands over a name the cultivator already holds', async () => {
        const { gate, cultivator, run } = await villager();
        const repos = ensureCultivationDb();

        for (let i = 0; i < 300; i++) {
            const heard = offerHearing({ repos, gate, cultivator, run, occasion: `d-${i}` });
            if (heard?.mode !== 'passing') continue;
            for (const name of heard.names) {
                expect(gate.isAwareOf(cultivator.id, name.kind, name.id)).toBe(false);
            }
            recordHearing(gate, cultivator, run, heard);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// ASKING
// ─────────────────────────────────────────────────────────────────────────

describe('asking somebody about something they cannot place', () => {
    const asker = {
        attributes: { might: 1, insight: 1, fortune: 1, charm: 1 }
    } as never;

    function roster(id: string, sectId: string | null) {
        return {
            id,
            name: id,
            realmOrdinal: 4,
            sectId,
            sectName: sectId ? 'A Hall' : null,
            sectRank: sectId ? 'Steward' : null
        } as never;
    }

    /**
     * The single largest hole in the discovery layer, kept as an assertion.
     *
     * Almost every question a new cultivator asks resolves to nothing, because
     * they have no names to ask with. That used to produce `blank`, and `blank`
     * is the one reach that can never deposit a name - so asking taught nothing,
     * for ever, to everybody.
     */
    it('deflects rather than going blank, so something can still fall out', () => {
        const answer = askedAbout({
            asker,
            asked: roster('official', 'sect-lantern-hall'),
            subject: null,
            rawTopic: 'the next town',
            holdsIt: false,
            priorDealings: 0,
            speakerName: null
        });
        expect(answer.reach).toBe('deflects');
        expect(answer.teaches).toBe(false);
    });

    it('has an unattached person fill the gap instead', () => {
        const answer = askedAbout({
            asker,
            asked: roster('carter', null),
            subject: null,
            rawTopic: 'the next town',
            holdsIt: false,
            priorDealings: 0,
            speakerName: null
        });
        expect(answer.reach).toBe('guesses');
        expect(answer.introduces).toBe(true);
    });

    it('does not return the same sentence for two different questions', () => {
        const ask = (topic: string) => askedAbout({
            asker,
            asked: roster('official', 'sect-lantern-hall'),
            subject: null,
            rawTopic: topic,
            holdsIt: false,
            priorDealings: 0,
            speakerName: null
        }).lines.join(' ');

        const answers = new Set([
            ask('the next town'), ask('the Sill'), ask('where the road goes'),
            ask('who runs the ford'), ask('the vein'), ask('my mother')
        ]);
        expect(answers.size).toBeGreaterThan(1);
    });

    it('answers the same question the same way every time', () => {
        const ask = () => askedAbout({
            asker,
            asked: roster('official', 'sect-lantern-hall'),
            subject: null,
            rawTopic: 'the Sill',
            holdsIt: false,
            priorDealings: 0,
            speakerName: null
        }).lines.join(' ');

        // asking.md's one hard rule: "Do not randomise across runs. The world's
        // habits should be stable enough to learn."
        expect(ask()).toBe(ask());
        expect(ask()).toBe(ask());
    });

    it('still deposits a name often enough for asking to be worth doing', async () => {
        const { db, gate, cultivator, run } = await villager('ask-pays');
        const repos = ensureCultivationDb();
        placePerson(db, 'npc-carter', 'The Carter', cultivator.location ?? '');
        const carter = repos.cultivators.roster().find(row => row.id === 'npc-carter')
            ?? db.prepare('SELECT * FROM cultivators WHERE id = ?').get('npc-carter') as never;

        let fired = 0;
        for (let i = 0; i < 200; i++) {
            const heard = offerHearing({
                repos, gate, cultivator, run,
                addressing: carter,
                occasion: `ask-${i}`,
                intent: 'asked',
                reach: 'deflects'
            });
            if (heard) fired++;
        }
        // "Whether someone who was not going to help mentions one thing on the
        // way out." That one thing is this, and it is the entire reason a
        // deflection is worth sitting through.
        expect(fired).toBeGreaterThan(20);
    });
});
