/**
 * The one floor that is not a rung.
 *
 *   > "this means we can have female only and male only sects, do IT, this
 *   >  makes playthroughs gated and interesting."
 *
 * A door that is shut is not a bar somebody can climb to, and the two must not
 * read alike: one is a century of work and the other is never. That distinction
 * is what most of this file is about.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND THE RULE IT MUST NOT BECOME
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **Admission may gate on sex. A match may not.** The household layer is open in
 * every direction, pinned by a swap test and by a scan of every identifier and
 * string in that directory against a gendered vocabulary. Both stay green, and
 * the assertion below that nothing in `src/engine/household` imports this is the
 * mechanical form of it.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    A_HOUSE_THAT_TAKES_ONE_SEX,
    theDoorIsShutTo,
    whoAHouseWillTake
} from '../../src/data/cultivation/the-three-floors-a-house-admits-at.js';
import { SECTS, getSect, intakeRouteOf } from '../../src/data/cultivation/sects.js';
import { AZURE_INTAKE } from '../../src/data/cultivation/sects.js';

describe('a Court that takes one sex', () => {
    it('names houses that exist and actually recruit', () => {
        for (const id of Object.keys(A_HOUSE_THAT_TAKES_ONE_SEX)) {
            const sect = getSect(id);
            expect(sect, id).toBeDefined();
            // A gate on a house nobody can apply to is a rule with no consumer.
            expect(sect!.recruits, id).toBe(true);
            expect(intakeRouteOf(id), id).not.toBe('adoption');
        }
    });

    /**
     * A gate is only interesting if what is behind it is worth wanting. A minor
     * house refusing half of everybody costs those players nothing.
     */
    it('gates only Courts', () => {
        for (const id of Object.keys(A_HOUSE_THAT_TAKES_ONE_SEX)) {
            expect(getSect(id)!.name, id).toContain('Court');
        }
    });

    /**
     * The two Courts a rule must never be hung on. The Azure Mist Court's bar
     * is zero by design with its own test; the Hollow Court is the catalog's
     * exception in every direction and generalises wrongly.
     */
    it('leaves the two exceptional Courts alone', () => {
        expect(whoAHouseWillTake('sect-azure-mist-court')).toBeNull();
        expect(whoAHouseWillTake('sect-hollow-court')).toBeNull();
        expect(AZURE_INTAKE).toBeDefined();
    });

    it('stays a small minority of the catalog', () => {
        expect(Object.keys(A_HOUSE_THAT_TAKES_ONE_SEX).length)
            .toBeLessThanOrEqual(Math.floor(SECTS.length / 10));
    });

    it('answers null for every other house rather than undefined', () => {
        for (const sect of SECTS) {
            if (sect.id in A_HOUSE_THAT_TAKES_ONE_SEX) continue;
            expect(whoAHouseWillTake(sect.id), sect.id).toBeNull();
            expect(theDoorIsShutTo(sect.id, 'female'), sect.id).toBeNull();
            expect(theDoorIsShutTo(sect.id, 'male'), sect.id).toBeNull();
        }
        // A body the catalog has never heard of is not a closed house.
        expect(whoAHouseWillTake('sect-that-does-not-exist')).toBeNull();
    });

    /**
     * The refusal has to read as a door rather than as a bar, because a player
     * told "not yet" spends a century finding out it was never.
     */
    it('refuses in a way that cannot be mistaken for a threshold', () => {
        const [id, takes] = Object.entries(A_HOUSE_THAT_TAKES_ONE_SEX)[0];
        const other = takes === 'female' ? 'male' : 'female';

        expect(theDoorIsShutTo(id, takes)).toBeNull();
        const shut = theDoorIsShutTo(id, other)!;
        expect(shut).toContain(getSect(id)!.name);
        expect(shut).toContain('no version of this');
        // And it names where to go instead, which every refusal here owes.
        expect(shut).toContain('another house');
    });
});

describe('admission may gate on sex, and a match may not', () => {
    /**
     * The mechanical form of the rule. `sex` answers who a child's parents are
     * and which of the houses would admit you; it never answers who may marry
     * whom, and the household directory neither imports it nor names it.
     */
    it('never reaches the household layer', () => {
        const dir = 'src/engine/household';
        const files = readdirSync(dir).filter(f => f.endsWith('.ts'));
        expect(files.length).toBeGreaterThan(3);

        for (const file of files) {
            const source = readFileSync(join(dir, file), 'utf8');
            expect(source, file).not.toContain('A_HOUSE_THAT_TAKES_ONE_SEX');
            expect(source, file).not.toContain('what-sex-somebody-is');
            expect(/\bsex\b/i.test(source), `${file} names the field`).toBe(false);
        }
    });
});
