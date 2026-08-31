/**
 * Validation for the consumables that came down from above.
 *
 * The assertions that matter here are the ones that keep the design honest
 * rather than the ones that keep the data tidy:
 *
 *   - no price, anywhere, in any form
 *   - the world counts are tiny, exact, and equal to the sum of the holdings
 *   - the two effects are declared as engine gaps rather than implemented in
 *     the catalog, and neither is expressible by the existing PillEffect set
 *   - exactly one holder can be persuaded; the other two are arithmetic
 *   - a good case was refused, on the record, and it cost the refuser anyway
 */

import { describe, it, expect } from 'vitest';

import { PillEffectSchema } from '../../src/schema/cultivation.js';
import { SECTS, getSect } from '../../src/data/cultivation/sects.js';
import { getApexInstitution } from '../../src/data/cultivation/hierarchy.js';
import { PILLS } from '../../src/data/cultivation/pills.js';
import { PRICES } from '../../src/data/cultivation/mortal-world.js';
import {
    IMMORTAL_ITEMS,
    ImmortalItemSchema,
    IMMORTAL_HOLDINGS,
    HoldingSchema,
    RecordedRefusalSchema,
    ENGINE_GAPS,
    getImmortalItem,
    getHoldingsOf,
    getHoldersOf,
    worldCountOf,
    persuadableHolders,
    recordedRefusals,
    getEngineGap
} from '../../src/data/cultivation/immortal-items.js';

describe('items from above', () => {
    it('parses, and there are almost none of them', () => {
        expect(IMMORTAL_ITEMS.length).toBeLessThanOrEqual(3);
        for (const item of IMMORTAL_ITEMS) {
            expect(() => ImmortalItemSchema.parse(item), item.id).not.toThrow();
            expect(item.id.startsWith('immortal-'), `${item.id} needs the immortal- prefix`).toBe(true);
            // Tiny and explicit, never "a few".
            expect(item.knownCount).toBeGreaterThan(0);
            expect(item.knownCount).toBeLessThanOrEqual(8);
            expect(item.everKnown, `${item.id} cannot have fewer ever than exist now`)
                .toBeGreaterThanOrEqual(item.knownCount);
        }
        expect(new Set(IMMORTAL_ITEMS.map(i => i.id)).size).toBe(IMMORTAL_ITEMS.length);
    });

    it('has no price, in stones or otherwise', () => {
        // The economy does not reach these, and a number would imply it did.
        for (const item of IMMORTAL_ITEMS) {
            const record = item as unknown as Record<string, unknown>;
            for (const field of ['value', 'price', 'cash', 'stones', 'cost']) {
                expect(record[field], `${item.id} carries a ${field}`).toBeUndefined();
            }
            expect(item.notForSale.length).toBeGreaterThan(120);
        }
        // And nothing in the purchasable catalogs refers to them.
        for (const price of PRICES) {
            expect(price.id.includes('immortal'), `${price.id} prices an immortal item`).toBe(false);
        }
        for (const pill of PILLS) {
            expect(pill.id.startsWith('immortal-'), `${pill.id} is in the buyable pill catalog`).toBe(false);
        }
    });

    it('states a provenance that admits no alternative, and a shrinking supply', () => {
        for (const item of IMMORTAL_ITEMS) {
            expect(item.provenance).toMatch(/came down/i);
            expect(item.cannotBeMade.length).toBeGreaterThan(150);
            // Somebody has tried, or it is stated that there is nothing to try.
            expect(item.cannotBeMade).toMatch(/tried|attempt|no theory|would not know/i);
            // Ruins are the rarest case and never a supply.
            expect(item.ruinAvailability).toMatch(/grave|rarest|never|no cache|forger/i);
            expect(item.ruinAvailability).toMatch(/supply|cache/i);
        }
    });

    it('writes the root-change like something that should not exist', () => {
        const dealing = IMMORTAL_ITEMS.find(i => i.effect === 'change_spirit_root')!;
        expect(dealing, 'the world-historic exception is missing').toBeDefined();
        // Rarer than the pill, by construction.
        const step = IMMORTAL_ITEMS.find(i => i.effect === 'promote_realm')!;
        expect(dealing.knownCount).toBeLessThan(step.knownCount);
        expect(dealing.knownCount).toBeLessThanOrEqual(2);
        // It states the rule it breaks rather than quietly breaking it.
        expect(`${dealing.effectNote} ${dealing.description}`)
            .toMatch(/dealt once|permanent|impossible|should not/i);
    });
});

describe('who holds them', () => {
    it('every holding resolves to a real faction and a real item', () => {
        for (const h of IMMORTAL_HOLDINGS) {
            expect(() => HoldingSchema.parse(h), `${h.factionId}/${h.itemId}`).not.toThrow();
            const holder = getSect(h.factionId) ?? getApexInstitution(h.factionId);
            expect(holder, `holding by unknown faction ${h.factionId}`).toBeDefined();
            expect(getImmortalItem(h.itemId), `holding of unknown item ${h.itemId}`).toBeDefined();
            expect(h.count).toBeGreaterThan(0);
            expect(h.count).toBeLessThanOrEqual(4);
        }
        // Three holders in the whole world, and no more.
        const holders = new Set(IMMORTAL_HOLDINGS.map(h => h.factionId));
        expect(holders.size).toBe(3);
        expect(holders.has('sect-azure-cloud-pavilion')).toBe(true);
        // The other two are the administrators of the world, not sects.
        expect(holders.has('apex-deep-survey')).toBe(true);
        expect(holders.has('apex-long-cut')).toBe(true);
        // Nobody else holds anything.
        for (const sect of SECTS) {
            if (holders.has(sect.id)) continue;
            expect(getHoldingsOf(sect.id), `${sect.id} should hold nothing`).toEqual([]);
        }
    });

    it('makes the world count the sum of the holdings, exactly', () => {
        for (const item of IMMORTAL_ITEMS) {
            expect(worldCountOf(item.id), `${item.id} count disagrees with its holders`)
                .toBe(item.knownCount);
            expect(getHoldersOf(item.id).length).toBeGreaterThan(0);
        }
    });

    it('names the count rather than describing it as small', () => {
        for (const h of IMMORTAL_HOLDINGS) {
            expect(h.countIsKnownTo.length, `${h.factionId} hides its own count`).toBeGreaterThan(60);
            // The people who hold them know the number.
            expect(h.countIsKnownTo).toMatch(/know|number|it is (one|two|three|four)|plainly/i);
        }
    });

    it('gives exactly one holder somebody who can be convinced', () => {
        const persuadable = persuadableHolders();
        expect(persuadable.length, 'there should be one door that opens on persuasion').toBe(1);
        expect(persuadable[0].factionId).toBe('sect-azure-cloud-pavilion');
        expect(persuadable[0].anyoneMayRefuse).toBe(false);
        // Instructions exist, so an office can act on them.
        expect(persuadable[0].decidedBy).toMatch(/Pavilion Master/i);
        expect(persuadable[0].sufficientReason.length).toBeGreaterThan(120);
        // And saying yes costs them something internally.
        expect(persuadable[0].costOfSayingYes).toMatch(/one of three|named|doctrine|petition/i);
    });

    it('makes the other holders arithmetic, with nobody able to release one', () => {
        const collective = IMMORTAL_HOLDINGS.filter(h => h.releaseMode === 'collective_consent');
        expect(collective.length).toBeGreaterThanOrEqual(3);
        for (const h of collective) {
            // A body, not an office, and any member ends it.
            expect(h.anyoneMayRefuse, `${h.factionId} has a single decider`).toBe(true);
            expect(h.decidedBy.length).toBeGreaterThan(80);
            expect(h.decidedBy, `${h.factionId} names an office rather than a body`)
                .toMatch(/all four|unanimous|body|together|Keepers/i);
            // Saving the institution is not a transaction.
            expect(h.savingTheSect, `${h.factionId} should say what saving it does`).not.toBeNull();
            expect(h.savingTheSect!).toMatch(/does not buy|not a transaction|indefensible|acknowledg|category error|receipt/i);
        }
        // The Hollow Court has no patriarch to appeal over.
        // Rank does not help: a Surveyor asking is one voice among four.
        const survey = collective.find(h => h.factionId === 'apex-deep-survey')!;
        expect(survey.decidedBy).toMatch(/no office above|one voice/i);
        // And the bureaucracies have a form, which has been submitted.
        for (const h of collective) {
            expect(h.theForm, `${h.factionId} has no instrument`).not.toBeNull();
            expect(h.theForm!.length).toBeGreaterThan(120);
        }
        expect(collective.some(h => /submitted/i.test(h.theForm!))).toBe(true);
    });

    it('records a good case that was refused, and what refusing cost', () => {
        const refusals = recordedRefusals();
        expect(refusals.length, 'nobody has ever been told no on the record')
            .toBeGreaterThanOrEqual(2);
        for (const { holding, refusal } of refusals) {
            expect(() => RecordedRefusalSchema.parse(refusal), holding.factionId).not.toThrow();
            expect(refusal.yearsAgo).toBeGreaterThan(0);
            // The case was genuinely good.
            expect(refusal.theCase.length).toBeGreaterThan(120);
            // A named refuser, and the reason given at the time.
            expect(refusal.refusedBy.length).toBeGreaterThan(60);
            // The sect was probably right, said without softening.
            expect(refusal.probablyRight).toMatch(/right|correct/i);
            // And it cost them anyway, which is the point of recording it.
            expect(refusal.costAnyway.length).toBeGreaterThan(80);
        }
        // Only collective holders refuse on the record; the Pavilion decides.
        for (const { holding } of refusals) {
            expect(holding.releaseMode).toBe('collective_consent');
        }
    });
});

describe('engine gaps', () => {
    it('declares both effects as gaps rather than inventing a mechanic', () => {
        const effects = new Set(IMMORTAL_ITEMS.map(i => i.effect));
        for (const effect of effects) {
            const gap = getEngineGap(effect);
            expect(gap, `${effect} is not declared as a gap`).toBeDefined();
            expect(gap!.missing.length).toBeGreaterThan(100);
            expect(gap!.blockedBy.length).toBeGreaterThan(80);
            expect(gap!.note.length).toBeGreaterThan(80);
        }
        expect(ENGINE_GAPS.length).toBe(effects.size);
    });

    it('confirms neither effect is expressible by the current PillEffect set', () => {
        const pillEffects = PillEffectSchema.options as readonly string[];
        for (const item of IMMORTAL_ITEMS) {
            expect(pillEffects.includes(item.effect),
                `${item.effect} is now a PillEffect - the gap note needs updating`).toBe(false);
        }
        // The nearest existing effect is named, so the difference is on record.
        expect(getEngineGap('promote_realm')!.missing).toMatch(/advance_progress/);
        // And the permanence rule the root change breaks is cited, not implied.
        expect(getEngineGap('change_spirit_root')!.missing).toMatch(/spiritRoot|permanent|never editable/i);
    });

    it('leaves the root change deliberately unresolvable', () => {
        const gap = getEngineGap('change_spirit_root')!;
        expect(gap.note).toMatch(/deliberately|should not be the place|ceremony/i);
        expect(gap.blockedBy).toMatch(/cultivation rate|deviation|derived|recalculation/i);
    });
});

describe('what happens afterwards', () => {
    it('says what the world does about a visible use', () => {
        for (const item of IMMORTAL_ITEMS) {
            expect(item.socialConsequence.length, `${item.id} social consequence`).toBeGreaterThan(200);
            // Named institutions react, rather than "people talk".
            expect(item.socialConsequence).toMatch(/Ledger|Held Names|Narrow Hour|Quiet Cut|Frostmirror|Storm Tyrant/);
        }
        const step = IMMORTAL_ITEMS.find(i => i.effect === 'promote_realm')!;
        // A jumped realm is arithmetic anybody can do.
        expect(step.socialConsequence).toMatch(/arithmetic|accumulation was not there|audit/i);
        // And the recipient is not admired for it.
        expect(step.socialConsequence).toMatch(/not admired|could not be given/i);

        const dealing = IMMORTAL_ITEMS.find(i => i.effect === 'change_spirit_root')!;
        // The register is the loudest signal in the world for this.
        expect(dealing.socialConsequence).toMatch(/register/i);
        // And the two sects with an intake problem are the danger.
        expect(dealing.socialConsequence).toMatch(/Frostmirror/);
        expect(dealing.socialConsequence).toMatch(/Storm Tyrant/);
    });
});
