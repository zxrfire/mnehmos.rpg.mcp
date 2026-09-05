/**
 * Thirty pieces of the best show-don't-tell writing in the repo, and until now
 * no player could reach any of them.
 *
 * `faction-character.ts` gives every faction a `practice` - what an outsider
 * sees in the first ten minutes. Disciples who stand when a sword is drawn
 * anywhere in earshot, including in a kitchen. Members who greet each other by
 * naming a ford rather than by name. Ascetics carrying a stone chosen at
 * admission and set down only to sleep. Nothing in `src/web` read them, so a
 * player could join a sect, live in its compound and never see one.
 *
 * These are a different KIND of content from names and are governed by a
 * different rule. A name is told, and discovery.md gates it. A practice is
 * seen, names nothing, and is what NARRATOR-CORE means by "render these as
 * behaviour and let the player infer".
 */

import { describe, it, expect } from 'vitest';
import type Database from 'better-sqlite3';
import { FACTION_CHARACTER, SECTS, getSect } from '../../src/data/cultivation/index';
import {
    PRACTICES,
    mayObserve,
    observableHere,
    observedLine,
    practiceOf
} from '../../src/web/practices';
import { KnowledgeGate } from '../../src/web/knowledge';
import { CultivationRNG } from '../../src/engine/cultivation/rng';
import { ensureCultivationDb } from '../../src/server/consolidated/cultivation-support';
import { makeGame } from './harness';

function placePerson(
    db: Database.Database,
    id: string,
    name: string,
    ordinal: number,
    sectId: string | null,
    where = 'Burnt Earth'
) {
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
    `).run({ id, name, ordinal, sectId, where, now });
}

describe('every faction practice is reachable', () => {
    it('covers every faction the catalog gives one', () => {
        const authored = Object.entries(FACTION_CHARACTER)
            .filter(([, character]) => (character.practice ?? '').trim().length > 0);
        expect(authored.length).toBeGreaterThan(0);
        for (const [factionId] of authored) {
            expect(practiceOf(factionId), `${factionId} has a practice nothing can reach`)
                .not.toBeNull();
        }
        expect(PRACTICES.size).toBe(authored.length);
    });

    it('quotes them verbatim and never paraphrases', () => {
        for (const [factionId, character] of Object.entries(FACTION_CHARACTER)) {
            const observed = practiceOf(factionId);
            if (!observed) continue;
            expect(observed.practice).toBe(character.practice.trim());
        }
    });

    it('keeps the whole practice in the line the player sees', () => {
        const observed = practiceOf('sect-azure-cloud-pavilion')!;
        const line = observedLine(observed);
        expect(line).toContain(observed.practice);
        // Shown, never explained: the line says what is done, not what it means.
        expect(line).not.toMatch(/because|which means|this tells you|indicates/i);
    });
});

describe('the narrow gate: a practice that says its own name', () => {
    it('flags exactly the ones that name their faction mid-sentence', () => {
        const flagged = [...PRACTICES.values()]
            .filter(observed => observed.namesFaction)
            .map(observed => observed.factionId)
            .sort();

        // Hand-audited against the catalog. Each of these says the institution
        // out loud: "a Consortium negotiation", "a Pavilion member", "the
        // Wanderers", "the Office".
        expect(flagged).toEqual([
            'house-measured-span',
            'house-ninefold-ledger',
            'sect-hollow-bell-wanderers',
            'sect-standing-grove',
            'sect-stonewright-consortium',
            'sect-storm-tyrant-court',
            'sect-thousand-treasure-pavilion',
            'sect-weir-office'
        ]);
    });

    it('does not mistake a role for an institution', () => {
        // "Wardens carry paint and a brush at all times" opens the sentence and
        // identifies nobody. Three separate factions open a practice this way,
        // and gating them would cost the player the material for nothing.
        for (const factionId of ['sect-sixmile-wardens', 'sect-kiln-wardens', 'house-anchorhold']) {
            expect(practiceOf(factionId)!.namesFaction, factionId).toBe(false);
        }
    });

    it('leaves most of them showable to somebody who can name nothing', () => {
        const open = [...PRACTICES.values()].filter(observed => !observed.namesFaction);
        expect(open.length).toBeGreaterThan(PRACTICES.size / 2);
    });

    it('never lets an unheard-of faction be named by one', async () => {
        const { db, game } = makeGame({ seed: 'practice-gate' });
        const { cultivator } = await game.newRun('Villager');
        const gate = new KnowledgeGate(db);

        for (const observed of PRACTICES.values()) {
            if (mayObserve(observed, gate, cultivator.id)) {
                // Anything a stranger may see has to name nothing at all.
                expect(observed.namesFaction, observed.factionId).toBe(false);
            }
        }
    });

    it('opens up once the player holds the name', async () => {
        const { db, game } = makeGame({ seed: 'practice-open' });
        const { cultivator } = await game.newRun('Villager');
        const gate = new KnowledgeGate(db);
        const shut = [...PRACTICES.values()].find(observed => observed.namesFaction)!;

        expect(mayObserve(shut, gate, cultivator.id)).toBe(false);
        gate.learn({
            holderId: cultivator.id,
            kind: 'sect',
            id: shut.factionId,
            name: getSect(shut.factionId)!.name,
            onDay: 0,
            sourceKind: 'told',
            sourceNote: 'Somebody said it.'
        });
        // Knowing what to call these people changes what you are able to notice.
        expect(mayObserve(shut, gate, cultivator.id)).toBe(true);
    });
});

describe('what is visible in a scene', () => {
    it('finds nothing when nobody present belongs to anything', async () => {
        const { db, game } = makeGame({ seed: 'nobody' });
        const { cultivator } = await game.newRun('Villager');
        const gate = new KnowledgeGate(db);
        const repos = ensureCultivationDb();
        placePerson(db, 'npc-loner', 'A Loner', 6, null);

        const present = repos.cultivators.roster().filter(row => row.id === 'npc-loner');
        expect(observableHere({
            present, gate, holderId: cultivator.id, rng: new CultivationRNG('x')
        })).toBeNull();
    });

    it('shows one thing, never a list of what three factions do', async () => {
        const { db, game } = makeGame({ seed: 'one-thing' });
        const { cultivator } = await game.newRun('Villager');
        const gate = new KnowledgeGate(db);
        const repos = ensureCultivationDb();
        placePerson(db, 'npc-a', 'A', 6, 'sect-azure-cloud-pavilion');
        placePerson(db, 'npc-b', 'B', 7, 'sect-verdant-spring-hall');
        placePerson(db, 'npc-c', 'C', 8, 'sect-nine-peaks-ascetic-order');

        const present = repos.cultivators.roster().filter(row => row.id.startsWith('npc-'));
        const seen = observableHere({
            present, gate, holderId: cultivator.id, rng: new CultivationRNG('scene')
        });
        expect(seen).not.toBeNull();
        expect([
            'sect-azure-cloud-pavilion',
            'sect-verdant-spring-hall',
            'sect-nine-peaks-ascetic-order'
        ]).toContain(seen!.factionId);
    });

    it('is the same on the same seed, and does not depend on row order', async () => {
        const { db, game } = makeGame({ seed: 'stable' });
        const { cultivator } = await game.newRun('Villager');
        const gate = new KnowledgeGate(db);
        const repos = ensureCultivationDb();
        placePerson(db, 'npc-a', 'A', 6, 'sect-azure-cloud-pavilion');
        placePerson(db, 'npc-b', 'B', 7, 'sect-verdant-spring-hall');

        const present = repos.cultivators.roster().filter(row => row.id.startsWith('npc-'));
        const once = observableHere({
            present, gate, holderId: cultivator.id, rng: new CultivationRNG('same')
        });
        const again = observableHere({
            present: [...present].reverse(), gate, holderId: cultivator.id,
            rng: new CultivationRNG('same')
        });
        expect(again!.factionId).toBe(once!.factionId);
    });

    it('withholds a naming practice from a stranger and shows a silent one', async () => {
        const { db, game } = makeGame({ seed: 'mixed' });
        const { cultivator } = await game.newRun('Villager');
        const gate = new KnowledgeGate(db);
        const repos = ensureCultivationDb();
        // One faction whose practice says its own name, one whose does not.
        placePerson(db, 'npc-a', 'A', 6, 'sect-stonewright-consortium');
        placePerson(db, 'npc-b', 'B', 7, 'sect-azure-cloud-pavilion');

        const present = repos.cultivators.roster().filter(row => row.id.startsWith('npc-'));
        for (let i = 0; i < 40; i++) {
            const seen = observableHere({
                present, gate, holderId: cultivator.id, rng: new CultivationRNG(`m-${i}`)
            });
            expect(seen!.factionId).toBe('sect-azure-cloud-pavilion');
        }
    });
});

describe('the catalog itself stays worth reading', () => {
    it('gives every faction in the sect catalog a practice', () => {
        for (const sect of SECTS) {
            expect(practiceOf(sect.id), `${sect.name} has no practice`).not.toBeNull();
        }
    });

    it('keeps them distinct, so two sects do not feel the same from the inside', () => {
        const openings = [...PRACTICES.values()]
            .map(observed => observed.practice.split(/\s+/).slice(0, 3).join(' ').toLowerCase());
        expect(new Set(openings).size).toBe(openings.length);
    });
});
