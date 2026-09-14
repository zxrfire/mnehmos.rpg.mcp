/**
 * Nothing a player could type had ever put a word in for anybody.
 *
 * The engine half of this is
 * `tests/engine/social-leverage/somebody-speaks-for-the-accused.test.ts`: what a
 * word costs, and who may not say one. This is the half that makes it a verb.
 * `whatTheRoomDecides` has moved a sentence a rung down for an intercession
 * since it was written and the only call site omitted the field, so the branch
 * was reachable by construction and unreachable by a sentence - which is the
 * defect this repo is named for, wearing a passing test.
 *
 * ── WHAT THESE ASSERTIONS ENCODE ─────────────────────────────────────────
 *
 * THE SENTENCE IS READ AS A PLEA AND HAS NOT EATEN THE VERB NEXT DOOR. Both
 * directions, because a new pattern quietly taking a neighbour's sentences is
 * the failure `verb-pattern-table.ts` warns about in its own header.
 *
 * A WORD FOR YOURSELF IS NOT A WORD FROM SOMEBODY ELSE, and the refusal says so
 * rather than looking blank - the same refusal `complaintsBrought` makes from the
 * other end of the same row. The handler deliberately does NOT filter the
 * player's own row out of the pile before matching: who may speak is one rule,
 * it lives in `whyTheWordIsNotTheirsToSay`, and a filter as well would answer
 * with nothing where the rule answers with a reason.
 *
 * RED-CHECKED. Making `whyTheWordIsNotTheirsToSay` return null for the accused
 * fails the refusal - the sentence then reaches the room and the answer is about
 * the day the house was told rather than about who is speaking.
 *
 * NOT red: moving the plea read below the verdict read changes nothing on this
 * corpus, because no sentence here carries a complaint noun. The ordering is a
 * guard on the next phrasing added rather than a live fix, and it is written up
 * that way where it stands rather than asserted here.
 */

import { describe, it, expect } from 'vitest';
import { parseIntent } from '../../src/web/actions';
import { makeGameInWorld } from './harness';
import { SECTS } from '../../src/data/cultivation/index';
import { AGAINST_THEIR_OWN } from '../../src/engine/social-leverage/what-a-house-does-when-it-catches-you';
import { createObligation } from '../../src/engine/social/grudges';
import { writeOneObligation } from '../../src/storage/repos/obligation.repo';

const HOUSE = SECTS
    .filter(sect => sect.recruits)
    .reduce((best, sect) => sect.id < best.id ? sect : best);

describe('a player speaks for somebody in front of the room', () => {
    it('is what the sentence is read as', () => {
        const spoke = parseIntent('I speak for Wen Shu in front of the punishment elder');
        expect(spoke.action).toBe('sect');
        expect(spoke.intent).toBe('plead');
        expect(spoke.target).toBe('Wen Shu');
        expect(parseIntent('I plead for her').intent).toBe('plead');
        expect(parseIntent('I ask them to go easy on Wen Shu').intent).toBe('plead');

        // And the verb next door still answers its own sentences.
        expect(parseIntent('what has been brought to me').intent).toBe('complaints');
        expect(parseIntent('I uphold the complaint against Wen Shu').intent).toBe('complaints');
    });

    it('refuses a word put in for yourself, and says why', async () => {
        const harness = await makeGameInWorld({
            seed: 'plead-read', worldSeed: 'plead-w'
        }) as any;
        const { cultivator } = await harness.game.newRun('Wen Shu');
        harness.repos.sects.addMember(HOUSE.id, cultivator.id, 0);
        writeOneObligation(harness.db, createObligation({
            kind: 'grudge',
            holderId: HOUSE.id,
            subjectId: cultivator.id,
            cause: 'robbery',
            severity: 'slight',
            onDay: 0,
            description: 'they took a blade off the house\'s own holdings',
            participants: [HOUSE.id],
            tags: [AGAINST_THEIR_OWN]
        }));

        const said = (await harness.game.act(`I speak for ${cultivator.name}`)).narration ?? '';

        expect(said.toLowerCase()).toContain('yourself');
    }, 300_000);
});
