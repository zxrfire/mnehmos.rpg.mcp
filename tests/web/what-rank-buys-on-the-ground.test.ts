/**
 * The first concrete thing rank has ever bought in this game.
 *
 * The world seeds hundreds of chambers, each with a controlling house and its
 * own qiDensity; houses allocate days on them by standing; and ground is the
 * largest multiplier in the model - reaching ordinal 29 costs 317 years on
 * ordinary ground against 79 on a sealed vein. Every NPC in the world was
 * already getting this and the player had no route to it at all.
 *
 * That is the AGENTS.md defect running in the direction nobody watches for: not
 * the world binding NPCs and sparing the player, but the world REWARDING NPCs
 * and excluding them.
 *
 * Every phrasing tried in play failed, each in a different way:
 *   "I ask for time on the vein"           the interact dead end
 *   "where can I cultivate in the sect"    answered about having no manual
 *   "I go to the sect cultivation chamber" "a name that is not a place"
 */

import { parseIntent } from '../../src/web/actions';
import { makeGame } from './harness';

describe('the sentences that ask for it', () => {
    it('all reach the read', () => {
        for (const text of [
            'I ask for time on the vein',
            'where can I cultivate in the sect',
            'I go to the sect cultivation chamber',
            'how many days do I get on the vein',
            'what is my allocation'
        ]) {
            const parsed = parseIntent(text);
            expect(parsed.action, text).toBe('look');
            expect(parsed.intent, text).toBe('ground_time');
        }
    });

    /**
     * `move` owns going to a NAMED place and must keep owning it. The rule is
     * gated on a house word beside the ground word for exactly this reason.
     */
    it('does not take a journey to a named place', () => {
        expect(parseIntent('I travel to The Cut Face').action).toBe('move');
        expect(parseIntent('I go to Nine Peaks').action).toBe('move');
    });

    it('does not take a question actually put to a person', () => {
        expect(parseIntent('I ask the steward about the road').action).toBe('interact');
    });
});

describe('what the read says', () => {
    it('answers in days a year, with the rate and what a promotion is worth', async () => {
        const { db, game } = makeGame({ seed: 'ground-entitlement', worldEnabled: true });
        const { cultivator } = await game.newRun('Member');
        db.prepare('UPDATE cultivators SET spirit_stones = 500 WHERE id = ?').run(cultivator.id);
        await game.act('I join the Azure Dew Sect');

        const asked = await game.act('where can I cultivate in the sect');

        // An entitlement, not a fraction: "51 days a year" is something a
        // person plans a life around and "0.14" is not.
        expect(asked.narration).toMatch(/days a year/);
        expect(asked.narration).toMatch(/a day against/);
        // The refusal that teaches - what a promotion would be worth, which is
        // deliberately not "what the person above me has".
        expect(asked.narration).toMatch(/One rung up|no rung above|allots no more/);
    }, 120_000);

    it('tells a rogue there is no queue with their name on it', async () => {
        const { game } = makeGame({ seed: 'ground-rogue', worldEnabled: true });
        await game.newRun('Nobody');
        const asked = await game.act('where can I cultivate in the sect');

        expect(asked.narration).toMatch(/nobody's queue|belong to none|no allocation/i);
        expect(asked.narration).not.toMatch(/days a year/);
    }, 120_000);
});
