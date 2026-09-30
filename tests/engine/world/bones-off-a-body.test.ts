/**
 * Owner ruling 2026-09-30: ordinal and grade are separate scales. Bones through
 * ordinal 44 keep the ordinary material grades; 44 is heaven. From 45 upward,
 * a death in the person's own tribulation yields chaos, any other death immortal.
 * The web harvest tests also read the cause from a recorded crossing and take
 * the resulting material into the player's pouch.
 */

import { describe, expect, it } from 'vitest';
import { gradeOfWhatABodyYields } from '../../../src/engine/cultivation/a-cultivators-body-is-material.js';
import { FALSE_IMMORTAL_ORDINAL, TRUE_IMMORTAL_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import { theBoneThisBodyYields } from '../../../src/engine/world/bones-off-a-body.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';

const bodyAt = (ordinal: number) => createNpc('bone-grades', {
    id: `body-${ordinal}`, bornOnDay: -18 * 365, onDay: 0,
    cultivation: { realmOrdinal: ordinal }
});

describe('the grade of human bones', () => {
    it('keeps the ordinary grades through 44, including heaven at 44', () => {
        for (let ordinal = 0; ordinal < FALSE_IMMORTAL_ORDINAL; ordinal++) {
            const body = bodyAt(ordinal);
            const expected = gradeOfWhatABodyYields(ordinal) ?? 'mortal';
            expect(theBoneThisBodyYields(body, false).grade, `${ordinal}, ordinary death`).toBe(expected);
            expect(theBoneThisBodyYields(body, true).grade, `${ordinal}, tribulation death`).toBe(expected);
        }
        expect(theBoneThisBodyYields(bodyAt(44), false).grade).toBe('heaven');
    });

    it.each([FALSE_IMMORTAL_ORDINAL, TRUE_IMMORTAL_ORDINAL])('yields chaos at %s from their tribulation', ordinal => {
        expect(theBoneThisBodyYields(bodyAt(ordinal), true).grade).toBe('chaos');
    });

    it.each([FALSE_IMMORTAL_ORDINAL, TRUE_IMMORTAL_ORDINAL])('yields immortal at %s from any other death', ordinal => {
        expect(theBoneThisBodyYields(bodyAt(ordinal), false).grade).toBe('immortal');
    });
});
