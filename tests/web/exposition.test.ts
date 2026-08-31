/**
 * Show the world, never explain it.
 *
 * docs/world/tone.md: nobody tells the protagonist how anything works. There is
 * no character whose job is to explain the world, because in the world there is
 * no such job. The engine holds the structure so that people can BEHAVE
 * according to it, and that is its only purpose in narration.
 *
 * The sibling of the discovery rule, and enforced the same way. Discovery
 * controls WHICH NAMES may be used; this controls WHETHER MECHANISMS MAY BE
 * EXPLAINED AT ALL. In both cases the instruction is the reminder and the
 * omission is the enforcement: `facts.structure` exists so that categories have
 * somewhere to go that is not a prompt.
 */

import { describe, it, expect } from 'vitest';
import { SECTS, TECHNIQUES } from '../../src/data/cultivation/index';
import {
    describeAmbientInWorld,
    describeAmbientPerceived,
    describeStanding
} from '../../src/web/facts';
import { resolveCultivator, resolveSect } from '../../src/web/entities';
import { composeNarrationUser, narrationSystemPrompt } from '../../src/web/prompt';
import { ensureCultivationDb } from '../../src/server/consolidated/cultivation-support';
import { KnowledgeGate } from '../../src/web/knowledge';
import { makeGame, engineCalls, ScriptedProvider } from './harness';

const LOCAL_SECT = SECTS
    .filter(sect => sect.recruits)
    .reduce((best, sect) =>
        sect.admissionOrdinal < best.admissionOrdinal ||
        (sect.admissionOrdinal === best.admissionOrdinal && sect.id < best.id) ? sect : best);

/**
 * Vocabulary that only ever appears when a rule is being taught.
 *
 * Deliberately about MECHANISM rather than about numbers: the player's own
 * sheet legitimately carries their HP and their spirit stones, and the
 * interface shows that arithmetic. What must not appear is the machinery -
 * rates, multipliers, thresholds, ordinals, governance categories, grades.
 */
const EXPOSITION = [
    /\bhalf rate\b/i,
    /\bdouble rate\b/i,
    /\btriple\b/i,
    /\bmultiplier\b/i,
    /\bmodifier\b/i,
    /\bordinal\b/i,
    /\brighteous sect\b/i,
    /\bdemonic sect\b/i,
    /\bneutral sect\b/i,
    /\badmits from\b/i,
    /\branks, outer to inner\b/i,
    /-grade\b/i,
    /\bqi density\b/i,
    /\bof the fifty that finish\b/i,
    /\bthe next fight is fatal\b/i
];

function offences(text: string): string[] {
    return EXPOSITION.filter(pattern => pattern.test(text)).map(String);
}

describe('the two channels', () => {
    it('keeps the mechanical reading of qi density out of the perceived one', () => {
        for (const band of ['thin', 'normal', 'dense', 'spirit_tide'] as const) {
            const mechanical = describeAmbientInWorld(band);
            const perceived = describeAmbientPerceived(band);

            // The inspector's version says what it does. That is its job.
            expect(mechanical).toMatch(/rate|modifier|density/i);
            // The narrator's version says what it is like to stand in it.
            expect(offences(perceived)).toEqual([]);
            expect(perceived.length).toBeGreaterThan(30);
        }
    });

    it('reports a gap rather than a rank when sizing somebody up', () => {
        // Power-level exposition is banned in Tier 1. What a person perceives
        // is that someone is out of reach, not that they are ordinal 30.
        for (const [observer, subject] of [[0, 0], [0, 6], [0, 30], [30, 2], [12, 13]] as const) {
            const reading = describeStanding(observer, subject);
            expect(offences(reading)).toEqual([]);
            expect(reading).not.toMatch(/\d/);
        }
        // And the readings actually differ, or the helper is decorative.
        expect(describeStanding(0, 30)).not.toBe(describeStanding(0, 1));
    });
});

describe('resolved entities describe behaviour, not schema', () => {
    it('tells a non-member what they could observe, and files the ladder separately', async () => {
        const { db, game } = makeGame();
        const { cultivator } = await game.newRun('Villager');
        const repos = ensureCultivationDb();
        const scope = { gate: new KnowledgeGate(db), holderId: cultivator.id, here: 'Sweptground' };

        const sect = resolveSect(repos, LOCAL_SECT.name, scope, null)!;
        expect(sect).not.toBeNull();

        // Perceived: what gets used around them, and who they will look at.
        expect(offences(sect.facts.join(' '))).toEqual([]);
        expect(sect.facts.join(' ')).toMatch(/nobody explains what they mean/i);

        // Structural: alignment and the ladder, on the inspector channel.
        const structure = sect.structure.join(' ');
        expect(structure).toContain('alignment=');
        expect(structure).toContain('admissionOrdinal=');
        expect(structure).toContain(LOCAL_SECT.ranks[0]);
    });

    it('gives the rank order to a member, who lives inside it', async () => {
        const { db, game } = makeGame();
        const { cultivator } = await game.newRun('Disciple');
        const repos = ensureCultivationDb();
        const scope = { gate: new KnowledgeGate(db), holderId: cultivator.id, here: 'Sweptground' };

        const outsider = resolveSect(repos, LOCAL_SECT.name, scope, null)!;
        const insider = resolveSect(repos, LOCAL_SECT.name, scope, LOCAL_SECT.id)!;

        expect(outsider.facts.join(' ')).not.toContain(LOCAL_SECT.ranks[LOCAL_SECT.ranks.length - 1]);
        expect(insider.facts.join(' ')).toContain(LOCAL_SECT.ranks[LOCAL_SECT.ranks.length - 1]);
        expect(insider.facts.join(' ')).toMatch(/from the inside/i);
    });

    it('does not state another cultivator rank in the narratable channel', async () => {
        const { db, game } = makeGame();
        const { cultivator } = await game.newRun('Villager');
        const repos = ensureCultivationDb();

        const now = new Date().toISOString();
        db.prepare(`
            INSERT INTO cultivators (
                id, run_id, name, kind, spirit_root, attributes, realm_ordinal,
                cultivation_progress, hp, max_hp, qi, max_qi, satiety, starvation_turns,
                age, years_at_current_realm, spirit_stones, sect_id, sect_rank, location,
                feuds, known_techniques, alive, death_cause, died_on_turn, created_at, updated_at
            ) VALUES (
                'npc-tall', NULL, 'The Tall One', 'npc', 'single_metal',
                '{"might":3,"insight":3,"fortune":2,"charm":3}', 30,
                0, 300, 300, 90, 90, 100, 0, 700, 5, 40000, NULL, NULL, 'Sweptground',
                '[]', '[]', 1, NULL, NULL, @now, @now
            )
        `).run({ now });

        const scope = { gate: new KnowledgeGate(db), holderId: cultivator.id, here: 'Sweptground' };
        const seen = resolveCultivator(repos, 'The Tall One', cultivator.id, scope, 0)!;

        const perceived = seen.facts.join(' ');
        expect(perceived).toContain('The Tall One');
        expect(perceived).not.toContain('Void Refinement');
        expect(perceived).toMatch(/does not invite comparison|does not arise/i);
        expect(offences(perceived)).toEqual([]);

        // The ordinal is not lost, it is filed where an operator can read it.
        expect(seen.structure.join(' ')).toContain('realmOrdinal=30');
    });

    it('describes an art by what it is for, not by its grade band', async () => {
        const { game } = makeGame();
        await game.newRun('Student');
        const art = TECHNIQUES[0];

        const result = await game.act(`I examine the ${art.name}.`);
        const narratable = result.narration;
        const inspector = JSON.stringify(result.toolCalls);

        expect(offences(narratable)).toEqual([]);
        expect(inspector).toContain('grade=');
    });
});

describe('nothing structural reaches the model', () => {
    it('omits the structure channel from the phase-3 message entirely', () => {
        const message = composeNarrationUser(
            {
                headline: 'A courtyard.',
                lines: ['Somebody is here, and does not look up.'],
                structure: ['realmOrdinal=30 (Void Refinement Early), alignment=demonic, admissionOrdinal=21.'],
                prose: ''
            },
            { place: 'Sweptground', ambient: 'thin', awareness: [] }
        );

        expect(message).toContain('Somebody is here');
        expect(message).not.toContain('realmOrdinal');
        expect(message).not.toContain('alignment');
        expect(message).not.toContain('admissionOrdinal');
    });

    it('sends no mechanism vocabulary through a real narrator call', async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"look"}'],
            narrations: ['A road, and nobody on it.']
        });
        const { game } = makeGame({ provider });
        await game.newRun('Villager');
        await game.act('I look around.');

        const call = provider.calls.at(-1)!;
        const user = call.messages.find(m => m.role === 'user')!.content;

        // The scene block and the facts block are both perception only.
        const factsBlock = user.slice(user.indexOf('WHAT THE ENGINE RULED'));
        expect(offences(factsBlock)).toEqual([]);
        expect(user).not.toMatch(/\bordinal\b/i);
    });

    it('still hands the operator the structure it withheld from the model', async () => {
        const { game } = makeGame();
        await game.newRun('Villager');

        const result = await game.act(`I examine ${LOCAL_SECT.name}.`);
        const structural = engineCalls(result).filter(c => c.name === 'engine.structure');

        expect(structural.length).toBeGreaterThan(0);
        expect(structural.map(c => c.summary).join(' ')).toContain('alignment=');
        expect(structural.every(c => c.action === 'not_narrated')).toBe(true);

        // And none of it leaked into the prose.
        expect(offences(result.narration)).toEqual([]);
    });
});

describe('the prompt states the rule it is enforcing', () => {
    it('carries show-never-explain at Tier 1, from NARRATOR-CORE', () => {
        const prompt = narrationSystemPrompt();
        expect(prompt).toContain('Show the world, never explain it.');
        expect(prompt).toContain('SHOW THE WORLD, NEVER EXPLAIN IT.');
    });

    it('says when a character may explain something, and that it is never reliable', () => {
        const prompt = narrationSystemPrompt();
        expect(prompt).toMatch(/selling\s+something,\s+boasting,\s+warning,\s+or\s+wrong/i);
        expect(prompt).toMatch(/none\s+are\s+reliable/i);
        expect(prompt).toMatch(/Nobody is a tutorial/i);
    });

    it('permits the player to stay confused', () => {
        const prompt = narrationSystemPrompt();
        expect(prompt).toMatch(/allowed\s+to\s+be\s+confused\s+for\s+a\s+long\s+time/i);
        expect(prompt).toMatch(/Inference\s+beats\s+exposition/i);
    });

    it('bans mechanism, rate and rank-correspondence statements outright', () => {
        const prompt = narrationSystemPrompt();
        expect(prompt).toMatch(/Never\s+state\s+a\s+mechanism,\s+a\s+rate,\s+a\s+threshold/i);
        expect(prompt).toMatch(/would\s+teach\s+the\s+player\s+a\s+rule,\s+cut\s+it/i);
    });
});
