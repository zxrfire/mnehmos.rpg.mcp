/**
 * Characters assume you know.
 *
 * docs/world/discovery.md: the discovery rule governs the narrator's own voice
 * and must not gag the people in the world. A cultivator says a name flatly,
 * with no context, because of course you know it - and that is the primary way
 * names should enter a player's world.
 *
 * The architectural point these tests exist to pin down: the ENGINE decides
 * which name gets said and writes the knowledge record, before any narration
 * happens. The alternative - letting the model drop names and reading them back
 * out of the prose - is the forbidden move, because it takes state out of a
 * model response. So a name that is licensed is already true, and a name that
 * is not licensed cannot become true by being written.
 */

import { describe, it, expect } from 'vitest';
import { SECTS } from '../../src/data/cultivation/index';
import {
    COMMON_CURRENCY_ORDINAL,
    WORKING_KNOWLEDGE_MARGIN,
    offerHearing,
    recordHearing,
    speakableFor
} from '../../src/web/hearsay';
import { KnowledgeGate } from '../../src/web/knowledge';
import { composeNarrationUser, narrationSystemPrompt } from '../../src/web/prompt';
import { ensureCultivationDb } from '../../src/server/consolidated/cultivation-support';
import { makeGame, engineCalls, ScriptedProvider } from './harness';

const LOCAL_SECT = SECTS
    .filter(sect => sect.recruits)
    .reduce((best, sect) =>
        sect.admissionOrdinal < best.admissionOrdinal ||
        (sect.admissionOrdinal === best.admissionOrdinal && sect.id < best.id) ? sect : best);

/** Put somebody in the same place as the player. */
function placePerson(db: any, id: string, name: string, ordinal: number, where = 'Sweptground') {
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
            0, 60, 60, 30, 30, 100, 0, 40, 2, 200, NULL, NULL, @where,
            '[]', '[]', 1, NULL, NULL, @now, @now
        )
    `).run({ id, name, ordinal, where, now });
}

describe('what a speaker would plausibly name', () => {
    it('covers their own working range', () => {
        const speakable = speakableFor(20).map(n => n.id);
        const inRange = SECTS.filter(s => s.powerOrdinal <= 20 + WORKING_KNOWLEDGE_MARGIN);
        expect(inRange.length).toBeGreaterThan(0);
        for (const sect of inRange) expect(speakable).toContain(sect.id);
    });

    it('covers what is common currency regardless of who is speaking', () => {
        // A carter has no business knowing Body Integration politics and still
        // says the name the way you would say a bank holiday. That is what
        // makes the register work: the mundane and the enormous sound the same.
        const carter = speakableFor(0).map(n => n.id);
        const enormous = SECTS.filter(s => s.powerOrdinal >= COMMON_CURRENCY_ORDINAL);
        for (const sect of enormous) expect(carter).toContain(sect.id);
    });

    it('does not consult the player knowledge at all', () => {
        // The speaker is not adjusting for their audience. The function takes
        // one argument and it is the speaker's standing.
        expect(speakableFor.length).toBe(1);
    });
});

describe('the engine picks the name, and writes it down', () => {
    it('records a spoken name at the lowest stance with told as the source', async () => {
        const { db, game } = makeGame({ seed: 'spoken' });
        const { cultivator } = await game.newRun('Villager');
        const gate = new KnowledgeGate(db);
        const repos = ensureCultivationDb();
        placePerson(db, 'npc-carter', 'The Carter', 6);

        const run = game.state().run as never;
        const carter = repos.cultivators.roster().find(r => r.id === 'npc-carter')!;

        // Sweep occasions until the seeded check fires; the point under test is
        // what a hearing IS, not how often one happens.
        let heard = null;
        for (let i = 0; i < 40 && !heard; i++) {
            heard = offerHearing({
                repos, gate, cultivator, run, addressing: carter, occasion: `probe-${i}`
            });
        }
        expect(heard).not.toBeNull();
        expect(heard!.mode).toBe('told');
        expect(heard!.speaker).toBe('The Carter');
        expect(heard!.names).toHaveLength(1);

        const learned = recordHearing(gate, cultivator, run, heard!);
        expect(learned).toHaveLength(1);

        // Not filtered by kind: the speakable world is not the sect catalog
        // any more, so what a carter drops may be a place, a person, an age or
        // whatever is sealed under a hall two valleys over.
        const record = gate.awareness(cultivator.id).find(r => r.name === learned[0].name)!;
        expect(record).toBeDefined();
        expect(record.stance).toBe('suspects');
        expect(record.sourceKind).toBe('told');
    });

    it('never offers a name the player already holds', async () => {
        const { db, game } = makeGame({ seed: 'dup' });
        const { cultivator } = await game.newRun('Villager');
        const gate = new KnowledgeGate(db);
        const repos = ensureCultivationDb();
        placePerson(db, 'npc-carter', 'The Carter', 6);
        const run = game.state().run as never;
        const carter = repos.cultivators.roster().find(r => r.id === 'npc-carter')!;

        for (let i = 0; i < 60; i++) {
            const heard = offerHearing({
                repos, gate, cultivator, run, addressing: carter, occasion: `sweep-${i}`
            });
            if (!heard) continue;
            for (const name of heard.names) {
                expect(gate.isAwareOf(cultivator.id, name.kind, name.id)).toBe(false);
            }
            recordHearing(gate, cultivator, run, heard);
        }

        // And the local sect, which the player was seeded with, is never dropped.
        const local = gate.awareness(cultivator.id, 'sect').filter(r => r.name === LOCAL_SECT.name);
        expect(local).toHaveLength(1);
        expect(local[0].sourceKind).toBe('told');
        expect(local[0].sourceNote).toMatch(/county/i);
    });

    it('needs two people for an overheard fragment, not one', async () => {
        const { db, game } = makeGame({ seed: 'alone' });
        const { cultivator } = await game.newRun('Villager');
        const gate = new KnowledgeGate(db);
        const repos = ensureCultivationDb();
        const run = game.state().run as never;

        // One person in a courtyard is not having a conversation, and a
        // monologue for the player's benefit is the failure this avoids.
        placePerson(db, 'npc-one', 'The First', 5);
        for (let i = 0; i < 30; i++) {
            expect(offerHearing({ repos, gate, cultivator, run, occasion: `solo-${i}` })).toBeNull();
        }

        placePerson(db, 'npc-two', 'The Second', 5);
        let heard = null;
        for (let i = 0; i < 60 && !heard; i++) {
            heard = offerHearing({ repos, gate, cultivator, run, occasion: `pair-${i}` });
        }
        expect(heard).not.toBeNull();
        expect(heard!.mode).toBe('overheard');
        expect(heard!.speaker).toBeNull();
    });

    it('marks an overheard name as something that cannot be admitted to', async () => {
        const { db, game } = makeGame({ seed: 'wall' });
        const { cultivator } = await game.newRun('Villager');
        const gate = new KnowledgeGate(db);
        const repos = ensureCultivationDb();
        placePerson(db, 'npc-one', 'The First', 5);
        placePerson(db, 'npc-two', 'The Second', 5);
        const run = game.state().run as never;

        let heard = null;
        for (let i = 0; i < 60 && !heard; i++) {
            heard = offerHearing({ repos, gate, cultivator, run, occasion: `wall-${i}` });
        }
        recordHearing(gate, cultivator, run, heard!);

        const record = gate.awareness(cultivator.id)
            .find(r => r.name === heard!.names[0].name)!;
        expect(record.sourceKind).toBe('overheard');
        expect(record.sourceNote).toMatch(/where this cultivator was standing/i);
        // Provenance is what separates it from `told`, not the stance.
        expect(record.stance).toBe('suspects');
    });
});

describe('the whole path, through act', () => {
    it('puts an overheard name into the world and into the inspector', async () => {
        // Sweep seeds: the check is deliberately rare, and the property under
        // test is what happens when it fires.
        for (let attempt = 0; attempt < 25; attempt++) {
            const { db, game } = makeGame({ seed: `path-${attempt}` });
            const { cultivator } = await game.newRun('Villager');
            placePerson(db, 'npc-one', 'The First', 5);
            placePerson(db, 'npc-two', 'The Second', 5);

            const result = await game.act('I look around.');
            const learnCall = engineCalls(result).find(c => c.action === 'name_overheard');
            if (!learnCall) continue;

            const gate = new KnowledgeGate(db);
            const overheard = gate.awareness(cultivator.id)
                .filter(r => r.sourceKind === 'overheard');

            expect(overheard.length).toBeGreaterThan(0);
            expect(learnCall.summary).toMatch(/overheard/i);
            // The facts say a word was said and withhold everything else.
            const facts = result.narration;
            expect(facts).toMatch(/does not know what that is/i);
            return;
        }
        throw new Error('no seed produced an overheard fragment in 25 attempts');
    });

    it('licenses the name for dialogue only, in a separate block from narration', async () => {
        for (let attempt = 0; attempt < 25; attempt++) {
            const provider = new ScriptedProvider({
                plans: ['{"action":"look"}'],
                narrations: ['A courtyard, and voices past the wall.']
            });
            const { db, game } = makeGame({ seed: `lic-${attempt}`, provider });
            await game.newRun('Villager');
            placePerson(db, 'npc-one', 'The First', 5);
            placePerson(db, 'npc-two', 'The Second', 5);

            await game.act('I look around.');
            const user = provider.calls.at(-1)!.messages.find(m => m.role === 'user')!.content;
            if (!user.includes('SPOKEN IN THIS SCENE')) continue;

            expect(user).toMatch(/SPOKEN IN THIS SCENE - OVERHEARD/);
            expect(user).toMatch(/ONLY inside/);
            expect(user).toMatch(/must not be glossed by you/);
            // The two lists are distinct: a spoken name is not a narratable one.
            const spokenIndex = user.indexOf('SPOKEN IN THIS SCENE');
            const nameableIndex = user.indexOf('NAMES YOU MAY USE');
            expect(spokenIndex).toBeGreaterThanOrEqual(0);
            expect(nameableIndex).toBeGreaterThan(spokenIndex);
            return;
        }
        throw new Error('no seed produced a spoken-name licence in 25 attempts');
    });

    it('sends no licence block when nobody said anything', () => {
        const message = composeNarrationUser(
            { headline: 'x', lines: ['y'], structure: [], prose: '' },
            { place: 'Sweptground', ambient: 'thin', awareness: [], hearing: null }
        );
        expect(message).not.toContain('SPOKEN IN THIS SCENE');
    });
});

describe('the prompt states the loosened rule', () => {
    it('separates the narrator voice from the voices of characters', () => {
        const prompt = narrationSystemPrompt();
        expect(prompt).toMatch(/governs\s+YOUR\s+OWN\s+DESCRIPTIVE\s+VOICE/i);
        expect(prompt).toMatch(/CHARACTERS\s+ARE\s+DIFFERENT/);
        expect(prompt).toMatch(/of\s+course\s+you\s+know\s+it/i);
    });

    it('says that hearing grants the name and not the meaning', () => {
        const prompt = narrationSystemPrompt();
        expect(prompt).toMatch(/grants\s+the\s+NAME,\s+not\s+the\s+meaning/);
        expect(prompt).toMatch(/spent\s+for\s+nothing/i);
    });

    it('says the mundane and the enormous sound identical', () => {
        const prompt = narrationSystemPrompt();
        expect(prompt).toMatch(/mundane\s+and\s+the\s+enormous\s+sound\s+identical/i);
        expect(prompt).toMatch(/no\s+weight,\s+no\s+pause/i);
    });

    it('makes asking a real act with a cost', () => {
        const prompt = narrationSystemPrompt();
        expect(prompt).toMatch(/Not\s+knowing\s+is\s+legible/i);
        expect(prompt).toMatch(/out\s+of\s+date/i);
    });

    it('carries the rules for writing an overheard fragment', () => {
        const prompt = narrationSystemPrompt();
        expect(prompt).toMatch(/as\s+it\s+would\s+ACTUALLY\s+be\s+spoken/);
        expect(prompt).toMatch(/restate\s+context\s+for\s+the\s+benefit\s+of\s+a\s+listener/i);
        expect(prompt).toMatch(/Do\s+not\s+resolve\s+it\s+in\s+the\s+same\s+scene/i);
        expect(prompt).toMatch(/briefing\s+with\s+a\s+wall\s+in\s+front\s+of\s+it/i);
        expect(prompt).toMatch(/compromising\s+provenance/i);
    });
});

/**
 * Asking is guidance, not a subsystem.
 *
 * docs/world/asking.md is explicit that this must not become a password
 * system: no key matching, no phrase registry, no unlock flags, no persuasion
 * stat, no new engine surface. The LLM reads who the person is, what they know,
 * what they owe, and what the player just said. So what these tests pin down is
 * that the guidance reaches the model, the player's words reach the model, and
 * no machinery grew underneath either.
 */
describe('asking', () => {
    it('adds no engine surface: there is no phrase registry to check against', async () => {
        const web = await import('node:fs');
        expect(web.existsSync('src/web/asking.ts')).toBe(false);

        // And nothing anywhere in the layer matches the player's text against a
        // table of magic words. The barrier is knowing what to say, which is
        // real without being enforced.
        const sources = ['game', 'prompt', 'entities', 'hearsay', 'lore', 'knowledge', 'facts']
            .map(name => web.readFileSync(`src/web/${name}.ts`, 'utf-8'))
            .join('\n');
        expect(sources).not.toMatch(/KEY_PHRASES|detectKeys|assessAsking|persuasion/i);
    });

    it('sends the player exact words to the narrator', async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"look"}'],
            narrations: ['A courtyard.']
        });
        const { game } = makeGame({ provider });
        await game.newRun('Villager');

        const said = 'I ask the steward what the Sill is, and mention who sent me.';
        await game.act(said);

        const user = provider.calls.at(-1)!.messages.find(m => m.role === 'user')!.content;
        expect(user).toContain('THE PLAYER SAID, WORD FOR WORD:');
        expect(user).toContain(said);
    });

    it('carries the three answers as guidance, with no stat and no unlock', () => {
        const prompt = narrationSystemPrompt();
        expect(prompt).toMatch(/Most\s+people\s+genuinely\s+do\s+not\s+know/i);
        expect(prompt).toMatch(/usually\s+knows\s+and\s+does\s+not\s+say/i);
        expect(prompt).toMatch(/what\s+they\s+know,\s+what\s+they\s+are\s+allowed\s+to\s+say/i);
        expect(prompt).toMatch(/no\s+roll,\s+no\s*\n?\s*stat,\s+no\s+unlock/i);
    });

    it('says what the player says matters more than what they are', () => {
        const prompt = narrationSystemPrompt();
        expect(prompt).toMatch(/What\s+the\s+player\s+SAYS\s+matters\s+more\s+than\s+what\s+they\s+are/);
        expect(prompt).toMatch(/asks\s+well\s+gets\s*\n?\s*further/i);
        expect(prompt).toMatch(/repeating\s+what\s+they\s+overheard/i);
    });

    it('keeps ignorance and evasion hard to separate at first', () => {
        const prompt = narrationSystemPrompt();
        expect(prompt).toMatch(/hard\s+to\s+tell\s+apart\s+at\s+first\s+and\s+easy\s+later/i);
        expect(prompt).toMatch(/do\s+not\s+write\s+them\s+identically/i);
    });

    it('forbids a deflection leaking its own answer, and forbids inventing agreement', () => {
        const prompt = narrationSystemPrompt();
        expect(prompt).toMatch(/DEFLECTION\s+MUST\s+NOT\s+LEAK\s+THE\s+ANSWER/);
        expect(prompt).toMatch(/YOU\s+DO\s+NOT\s+DECIDE\s+THAT\s+ANYTHING\s+WAS\s+AGREED/);
        expect(prompt).toMatch(/Write\s+the\s+conversation;\s+do\s+not\s+write\s+its\s+consequences/i);
    });
});
