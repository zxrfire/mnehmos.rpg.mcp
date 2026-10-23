/** Replay R2: ADMIN wrote a sworn oath, but the sister's card called the
 * player a stranger. Recognition and stance derive from the real directed
 * ties and oath, including the player's row, without granting local lore. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { narrationSystemPrompt } from '../../src/web/prompt.js';
import { swornSiblingsOf } from '../../src/engine/world/close-people-go-together.js';
import { relationshipWith } from '../../src/engine/world/npc-state.js';

let admin: string | undefined;
beforeEach(() => { admin = process.env.ADMIN_MODE; process.env.ADMIN_MODE = 'true'; });
afterEach(() => { if (admin === undefined) delete process.env.ADMIN_MODE; else process.env.ADMIN_MODE = admin; });

describe('an arranged tie reaches conversation', () => {
    it('close, friendly and hostile have two real ends and reach the card', async () => {
        const h = await makeGameInWorld({ seed: 'arranged-stance', worldSeed: 'arranged-tie-world' });
        await h.game.newRun('Probe');
        for (const disposition of ['close', 'friendly', 'hostile']) {
            const before = new Set(h.game.atHand!.npcs.map(person => person.id));
            await h.game.act(`ADMIN spawn_encounter ordinal=13 disposition=${disposition}`);
            const world = h.game.atHand!, player = h.game.currentRun().cultivator;
            const person = world.npcs.find(person => !before.has(person.id))!;
            expect(relationshipWith(person, player.id)).not.toBeNull();
            expect(relationshipWith(world.npcs.find(person => person.id === player.id)!, person.id)).not.toBeNull();
            expect(h.game.company(player).named.find(card => card.id === person.id)?.towardPlayer).toContain(disposition);
            const held = JSON.stringify(world);
            expect(h.game.knowledge.isAwareOf(person.id, 'cultivator', player.id)).toBe(true);
            expect(h.game.dealingsWith(player, person.id)).toBeGreaterThan(0);
            expect(JSON.stringify(world)).toBe(held);
        }
    });
    it('a sworn sister recognises a greeting across a realm gap (replay R2)', async () => {
        const plans: string[] = [];
        const provider = new ScriptedProvider({ plans, narrations: ['The square is quiet.', JSON.stringify({
            ordinal: 13, sex: 'female', house: null, disposition: 'sworn_sibling'
        }), 'Someone stands nearby.', 'The square is quiet.'] });
        const call = provider.call.bind(provider);
        provider.call = async opts => {
            const reply = await call(opts);
            const user = opts.messages.find(message => message.role === 'user')?.content ?? '';
            if (opts.messages[0]?.content === narrationSystemPrompt() && user.includes('big sis!')) {
                // A scripted model can only recognise the bond when the card supplies it.
                reply.text = user.includes('sworn sibling of the player')
                    ? '"Little sibling! It is good to see you," she says.'
                    : '"I have no idea who you are," she says.';
            }
            return reply;
        };
        const h = await makeGameInWorld({ seed: 'arranged-tie', worldSeed: 'arranged-tie-world', provider });
        const { cultivator: player } = await h.game.newRun('Probe');
        const before = new Set(h.game.atHand!.npcs.map(person => person.id));
        await h.game.act('ADMIN spawn_encounter a cheerful young woman at foundation establishment with no house, who is my sworn sister');
        const sister = h.game.atHand!.npcs.find(person => !before.has(person.id))!;
        expect(swornSiblingsOf(h.game.atHand!, sister.id).has(player.id)).toBe(true);
        expect(relationshipWith(sister, player.id)?.standing).toBe(1);
        expect(h.game.knowledge.isAwareOf(player.id, 'cultivator', sister.id)).toBe(true);
        expect(h.game.knowledge.isAwareOf(sister.id, 'cultivator', player.id)).toBe(true);
        const spawnCard = provider.calls.filter(entry => entry.messages[0]?.content === narrationSystemPrompt()).at(-1)!;
        expect(spawnCard.messages.at(-1)!.content).toContain('sworn sibling of the player');
        plans.push(JSON.stringify({ action: 'interact', target: sister.name, intent: 'talk', topic: 'greeting' }));
        const greeted = await h.game.act('big sis! hey, its me. how have you been?');
        const card = provider.calls.filter(entry => entry.messages[0]?.content === narrationSystemPrompt()).at(-1)!.messages.at(-1)!.content;
        expect(card).toContain('sworn sibling of the player');
        expect(card).toContain(`knows the player as ${player.name}`);
        expect(card).toContain('returns the greeting');
        expect(greeted.narration).toContain('Little sibling!');
        expect(greeted.narration).not.toContain('I have no idea who you are');
    });
});
