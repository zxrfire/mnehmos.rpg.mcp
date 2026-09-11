/**
 * Three defects behind two `as never` casts, and the compiler knew about all of
 * them.
 *
 * FOUND BY A SUITE FAILURE THAT LOOKED LIKE A FLAKE. One test in
 * `misparse.test.ts` died with
 *
 *     TypeError: Cannot read properties of undefined (reading 'startsWith')
 *       at catalogPersonBehind      (a-catalog-person-and-their-world-row.ts:94)
 *       at existenceClaimKey        (knowledge.ts:57)
 *       at KnowledgeGate.learnIfNew (knowledge.ts:288)
 *       at GameService.whoTheyWouldSendYouTo
 *       at GameService.askAround
 *
 * and passed on the next run. It is not a flake. `whoTheyWouldSendYouTo` is
 * reached only when somebody who does NOT hold an art can point at somebody who
 * does, and whether such a person exists is a question about the seed - so the
 * crash is total wherever it is reached and invisible everywhere else.
 *
 * ── WHAT THE CASTS WERE HIDING ───────────────────────────────────────────
 *
 * `AwarenessInput` takes `id`, `name` and `sourceKind`. Both write sites passed
 * `subjectId`, `subjectName` and `source`, and closed the literal with
 * `} as never)`, which suppresses every field check there is. So:
 *
 *   1. `input.id` was `undefined` and `existenceClaimKey` called `.startsWith`
 *      on it. The turn died instead of answering.
 *
 *   2. `stage: 'heard_of'` is not a rung on the knowing ladder. `stageRank`
 *      scores an unknown stage 0, which is `unaware`, so on the seeds that did
 *      NOT throw, `learnIfNew` compared 0 against what was already held and
 *      declined to write anything. A name the player had just been told was
 *      never written down.
 *
 *   3. Separately, `assessAcquisition` was handed `subject: primaryRoadOf(...)`
 *      where `ManualLike` has `subjects`. The field was dropped, `subjects`
 *      defaulted to `[]`, and `isOnRoad` - the whole of how `daoMatches`
 *      recognises an art's own road - could never return true down this path.
 *
 * ── WHY (3) IS THE WORST OF THEM ─────────────────────────────────────────
 *
 * That verb answers "how do I carry this manual further", about a manual the
 * cultivator ALREADY PRACTISES. With the road dropped, a cultivator a century
 * into the sword road, asking after their own sword manual, is refused
 * `wrong_dao`:
 *
 *     ... is a road, and it is not [the manual]'s. The art is written in a
 *     language this cultivator has spent their life not learning.
 *
 * About the book in their hands.
 *
 * ── AND THE RULE THIS LEAVES ─────────────────────────────────────────────
 *
 * `as never` on an argument is not a type. It is the argument being checked
 * against nothing at all, which is strictly weaker than `any`, and it turned
 * three ordinary field-name mistakes into a crash, a silent no-op and a
 * refusal that insults the player. There are no object literals cast to `never`
 * left in `src/`, and the last assertion in this file is what keeps it that
 * way - stated as a count so that a new one has to be argued for rather than
 * typed.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { KNOWING_STAGES } from '../../src/engine/social/discovery';
import { manualGate } from '../../src/engine/cultivation/acquisition';
import { assessAcquisition } from '../../src/engine/encounters/acquisition';

/**
 * A manual that asks a standing of its reader, so the gate actually runs. A
 * grade that asks nothing short-circuits at `requirement.standing === 'none'`
 * and would pass this test with the road still on the floor.
 */
const A_SWORD_MANUAL = {
    id: 'tech-test-sword',
    name: 'Test Sword Canon',
    requiredOrdinal: 6,
    cap: 30,
    grade: 'heaven',
    element: null,
    subjects: ['sword'],
    category: 'cultivation',
    domain: null,
    domainDegree: 1,
    volumes: null,
    opening: null,
    derivable: true
} as const;

/** A cultivator who has walked exactly the road this manual is written on. */
const A_SWORD_CULTIVATOR = {
    standing: 'deep',
    subject: 'sword',
    domain: 'craft',
    name: 'the sword'
} as const;

describe('the road an art is on survives the trip to the gate', () => {
    /**
     * THE ENGINE WAS ALWAYS RIGHT. Stated first so the failure below cannot be
     * read as the gate being wrong: given the roads, it opens the book.
     */
    it('opens a sword manual to a sword cultivator', () => {
        const verdict = manualGate(A_SWORD_CULTIVATOR as never, A_SWORD_MANUAL as never);
        expect(verdict.permitted).toBe(true);
        expect(verdict.reason).toBeNull();
    });

    /**
     * AND WITH THE ROAD DROPPED IT IS THE SENTENCE THE PLAYER GOT. This is the
     * defect reproduced at the layer it was introduced at, so that a future
     * caller that drops `subjects` again fails against a named consequence
     * rather than against a schema.
     */
    it('refuses that same book once its roads are dropped', () => {
        const verdict = manualGate(
            A_SWORD_CULTIVATOR as never,
            { ...A_SWORD_MANUAL, subjects: [] } as never
        );
        expect(verdict.permitted).toBe(false);
        expect(verdict.reason).toBe('wrong_dao');
        expect(verdict.detail).toContain('spent their life not learning');
    });

    /**
     * AND THE VERB'S OWN ENTRY POINT CARRIES THEM. `assessAcquisition` is what
     * the three routes are read through, and it is where the dropped field
     * landed.
     */
    it('carries the roads through the acquisition read', () => {
        const report = assessAcquisition({
            manual: A_SWORD_MANUAL as never,
            seeker: {
                ordinal: 20,
                elements: ['metal'],
                rootGrade: 'single',
                foundationQuality: null,
                insights: { craft: 5 },
                yearsCultivated: 100
            } as never,
            route: 'taught',
            realmOrdinal: 20,
            heldVolumeIds: [],
            dao: A_SWORD_CULTIVATOR as never
        } as never) as { refusals?: readonly string[] };
        expect(report.refusals ?? []).not.toContain('wrong_dao');
    });
});

describe('a knowing stage is one of the six', () => {
    /**
     * `heard_of` READ AS `unaware`. `stageRank` returns 0 for anything not on
     * the ladder, and `learnIfNew` writes only when the wanted stage outranks
     * the held one - so the two write sites asked for nothing and got it.
     */
    it('does not include the stage those two calls asked for', () => {
        expect(KNOWING_STAGES).not.toContain('heard_of');
    });

    it('asks for a real stage at both sites', () => {
        const src = readFileSync('src/web/turn-engine.ts', 'utf8');
        expect(src).not.toContain("stage: 'heard_of'");
    });
});

/** Every `.ts` under a directory, recursively. */
function everySource(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) out.push(...everySource(path));
        else if (path.endsWith('.ts')) out.push(path);
    }
    return out;
}

describe('an argument is checked against something', () => {
    /**
     * THE RATCHET, AND IT IS A ZERO.
     *
     * `} as never` closing an object literal is the shape that hid all three
     * defects above: it is not a widening, it is the argument being compared
     * against nothing. An exhaustiveness `as never` on a scalar is a different
     * thing and is not matched here.
     *
     * Asserted as an exact count of zero rather than a ceiling, because the
     * point is that the next one has to be argued for rather than typed.
     */
    it('has no object literal cast to never in src', () => {
        const offenders = everySource('src')
            .filter(path => /\}\s*as never/.test(readFileSync(path, 'utf8')));
        expect(offenders).toEqual([]);
    });
});
