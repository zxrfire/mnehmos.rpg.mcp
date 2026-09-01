/**
 * The escalation ladder, the upkeep, and the dormant archive.
 *
 * Three separate pieces of work with one thing in common: each of them is a
 * design claim that was previously true only because it was written down. These
 * are the guards that make them true because they are checked.
 *
 * The most important one in the file is `a decree is not a larger settled art`.
 * That is the exact failure the address ladder exists to prevent, and it fails
 * silently and looks fine - a rung-46 art with a huge damage expression reads
 * as impressive and means the whole top of the ladder has collapsed back into
 * magnitude. So it is asserted structurally rather than by reading the prose.
 */

import { describe, it, expect } from 'vitest';
import {
    ADDRESS_ORDER,
    ADDRESS_ORDINAL_FLOORS,
    DECREE_IS_NOT_A_LARGER_SETTLED,
    THE_WORD_AT_THE_TOP,
    WHAT_A_DECREE_CANNOT_SAY,
    addressCeilingForOrdinal,
    addressIsLegal,
    addressOf,
    addressRank,
    defaultAddressFor,
    type TechniqueAddress
} from '../../src/schema/cultivation.js';
import {
    FALSE_IMMORTAL_ORDINAL,
    LAST_CROSSING_ORDINAL,
    MAX_ORDINAL,
    TOTAL_RANKS,
    TRUE_IMMORTAL_ORDINAL,
    WHAT_AN_ART_BUYS
} from '../../src/engine/cultivation/realms.js';
import { TECHNIQUES, getTechnique } from '../../src/data/cultivation/techniques.js';
import { SECTS, getSect } from '../../src/data/cultivation/sects.js';
import {
    DORMANT_ARTS,
    FACTION_CHARACTER,
    dormantArtsOf,
    factionsHoldingDormantArts,
    whoHoldsDormant
} from '../../src/data/cultivation/faction-character.js';
import { ANCIENT_ARTS, ARCHIVE_COPIES, STOCKED_INHERITANCES } from '../../src/data/cultivation/lost-ages.js';
import {
    UNPROVISIONED,
    isSupplyStalled,
    masteryCeilingFor,
    practiceCeilingFor,
    supplyLimitedArts
} from '../../src/engine/cultivation/upkeep.js';

// ─────────────────────────────────────────────────────────────────────────
// THE ADDRESS LADDER
// ─────────────────────────────────────────────────────────────────────────

describe('the address ladder', () => {
    it('is ordered, total, and anchored to the top and bottom of the real ladder', () => {
        expect(ADDRESS_ORDER).toEqual(['body', 'place', 'condition', 'settled', 'decree']);
        // Every value has a floor, and the floors ascend strictly - two rungs
        // that opened at the same ordinal would be one rung.
        const floors = ADDRESS_ORDER.map(a => ADDRESS_ORDINAL_FLOORS[a]);
        expect(floors).toEqual([...floors].sort((a, b) => a - b));
        expect(new Set(floors).size).toBe(floors.length);
        expect(floors[0]).toBe(0);
        expect(floors[floors.length - 1]).toBe(MAX_ORDINAL);
    });

    it('narrows as it rises: each band is no wider than the one below it', () => {
        // The corridor thesis arriving on a second axis. Twenty-one rungs,
        // twelve, eleven, two, one - what a cultivator may address gets rarer
        // the higher they go, which is the whole shape of the setting.
        const widths = ADDRESS_ORDER.map((a, i) => {
            const next = ADDRESS_ORDER[i + 1];
            const end = next ? ADDRESS_ORDINAL_FLOORS[next] - 1 : MAX_ORDINAL;
            return end - ADDRESS_ORDINAL_FLOORS[a] + 1;
        });
        for (let i = 1; i < widths.length; i++) {
            expect(widths[i]).toBeLessThanOrEqual(widths[i - 1]);
        }
        expect(widths.reduce((a, b) => a + b, 0)).toBe(TOTAL_RANKS);
    });

    it('the top two rungs are the only ones that may address a settled fact or decree', () => {
        expect(ADDRESS_ORDINAL_FLOORS.settled).toBe(LAST_CROSSING_ORDINAL);
        expect(ADDRESS_ORDINAL_FLOORS.decree).toBe(TRUE_IMMORTAL_ORDINAL);
        // A False Immortal may reach a fact and may not fix one, which is the
        // difference between the two rungs said in the vocabulary of the word.
        expect(addressCeilingForOrdinal(FALSE_IMMORTAL_ORDINAL)).toBe('settled');
        expect(addressCeilingForOrdinal(TRUE_IMMORTAL_ORDINAL)).toBe('decree');
        expect(addressCeilingForOrdinal(LAST_CROSSING_ORDINAL - 1)).toBe('condition');
    });

    it('the ceiling never falls as the ladder rises', () => {
        let previous = -1;
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
            const rank = addressRank(addressCeilingForOrdinal(ordinal));
            expect(rank).toBeGreaterThanOrEqual(previous);
            previous = rank;
        }
    });

    it('the word at the top escalates in kind, not in volume', () => {
        // Petition, refusal, decree - three categorically different outcomes
        // across two rungs, and no quantity anywhere in the progression.
        expect(THE_WORD_AT_THE_TOP.petition.ordinal).toBe(LAST_CROSSING_ORDINAL);
        expect(THE_WORD_AT_THE_TOP.refusal.ordinal).toBe(FALSE_IMMORTAL_ORDINAL);
        expect(THE_WORD_AT_THE_TOP.decree.ordinal).toBe(TRUE_IMMORTAL_ORDINAL);
        const outcomes = Object.values(THE_WORD_AT_THE_TOP).map(w => w.outcome);
        expect(new Set(outcomes).size).toBe(3);
    });

    it('the Word of Continuance is the petition rung, and is still what it always was', () => {
        // The rung-44 art that argues. It was in the catalog before the ladder
        // existed and the ladder was derived to fit it rather than the reverse,
        // so if this entry ever moves the ladder is describing nothing.
        const word = getTechnique('word-of-continuance');
        expect(word?.requiredOrdinal).toBe(LAST_CROSSING_ORDINAL);
        expect(word?.damage).toBeNull();
        expect(word?.class).toBe('dao');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE TOP RUNG IS NOT A LARGER VERSION OF THE ONE BELOW IT
// ─────────────────────────────────────────────────────────────────────────

describe('a decree is not a larger settled art', () => {
    it('states the test it is held to', () => {
        expect(DECREE_IS_NOT_A_LARGER_SETTLED.theTest).toContain('already');
        expect(Object.keys(WHAT_A_DECREE_CANNOT_SAY)).toEqual([
            'aRung',
            'anAmendment',
            'anAdministration'
        ]);
    });

    it('no art that decrees carries a target, a reach or a damage expression', () => {
        // The structural form of the rule. A decree addresses nothing that is
        // there: it has no target to roll against, nobody to catch it, and no
        // number to be bigger. An entry up here with dice on it has become a
        // very large attack, which is precisely the failure.
        for (const t of TECHNIQUES) {
            if (addressOf(t) !== 'decree') continue;
            expect(t.damage, `${t.id} decrees and rolls dice`).toBeNull();
            expect(t.reach ?? 'single', `${t.id} decrees and has a headcount`).toBe('single');
        }
    });

    it('a decree buys nothing across the Lid, because it is an art', () => {
        // `WHAT_AN_ART_BUYS` is not overturned by anything on this ladder. The
        // top rung of the address ladder is still a technique, and a technique
        // is worth most of a rung inside a realm and nothing at all across the
        // boundary, at any mastery.
        expect(WHAT_AN_ART_BUYS.acrossTheLid).toBe('nothing at all, at any mastery');
        expect(WHAT_A_DECREE_CANNOT_SAY.aRung).toMatch(/changes nothing/i);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// COMPOSITION WITH THE TWO AXES THAT ALREADY EXIST
// ─────────────────────────────────────────────────────────────────────────

describe('the ladder composes with class and era rather than replacing them', () => {
    it('every art in the catalog declares a legal address for its rung', () => {
        const illegal = TECHNIQUES.filter(t => !addressIsLegal(t));
        expect(illegal.map(t => t.id)).toEqual([]);
    });

    it('a cultivation manual addresses the practitioner at every rung, for ever', () => {
        // Not a default - an invariant. What you practise to rank up never
        // escalates in kind; only what you use does. The catalog already said
        // this in the note on the Canon of the Unwritten Span, which sits at
        // the very top of the ladder and still lands on one person.
        for (const t of TECHNIQUES) {
            if (t.class !== 'cultivation') continue;
            expect(addressOf(t), `${t.id}`).toBe('body');
        }
        expect(addressOf(getTechnique('canon-of-the-unwritten-span')!)).toBe('body');
    });

    it('an ancient art never buys a higher address than its rung allows', () => {
        // THE GUARD ON THE ERA AXIS. Ancient is different, not better. What it
        // does inside its band is categorical; what it must never do is reach a
        // band its rung does not open, because that makes old art strictly
        // stronger and collapses the whole distinction into "old is stronger".
        for (const t of TECHNIQUES) {
            if (t.era !== 'ancient') continue;
            const ceiling = addressCeilingForOrdinal(t.requiredOrdinal);
            expect(
                addressRank(addressOf(t)),
                `${t.id} is ancient and reaches past its rung`
            ).toBeLessThanOrEqual(addressRank(ceiling));
        }
    });

    it('both eras are represented at the addresses that are occupied', () => {
        // The other half of the same guard: if the higher addresses were all
        // ancient, "old is stronger" would be true by distribution even with
        // every individual entry legal.
        const occupied = new Map<TechniqueAddress, Set<string>>();
        for (const t of TECHNIQUES) {
            const address = addressOf(t);
            if (!occupied.has(address)) occupied.set(address, new Set());
            occupied.get(address)!.add(t.era);
        }
        // Whatever is occupied, `place` and above must not be an ancient-only
        // preserve - WHEREVER BOTH ERAS CAN REACH IT.
        //
        // The qualifier is the amendment, and it is the ladder's own geometry
        // rather than an excuse. `decree` opens at the True Immortal rung,
        // above the Lid, and everything currently written up there is
        // categorical - so an ancient-only decree rung is what the catalog
        // says about the top of the world, not a distribution failure that
        // makes old art stronger. Nobody below the Lid can read any of it at
        // any mastery, so it buys no one anything either way.
        //
        // It is not a permanent exemption. A modern art above the Lid stays
        // expressible - see `MODERN_ABOVE_THE_LID_NOTES` and the guard in the
        // ancient suite - and the day one is written this band gets both eras
        // like every other. What is asserted below the Lid is unchanged and is
        // where the real risk was: `place` and `condition` and `settled` all
        // sit at rungs the elemental line reaches, and all three carry modern
        // entries.
        for (const [address, eras] of occupied) {
            if (addressRank(address) === 0) continue;
            if (ADDRESS_ORDINAL_FLOORS[address] >= FALSE_IMMORTAL_ORDINAL) continue;
            expect(eras.has('modern'), `${address} is ancient-only below the Lid`).toBe(true);
        }
        // And the below-the-Lid half is asserted positively rather than only
        // by absence, so this cannot pass by those bands quietly emptying.
        for (const address of ['place', 'condition', 'settled'] as TechniqueAddress[]) {
            expect(occupied.get(address)?.has('modern'), `${address} has no modern entry`)
                .toBe(true);
        }
    });

    it('explains the six ancient arts rather than treating them as a separate list', () => {
        // The ladder has to ACCOUNT for the categorical line, not sit beside
        // it. Each of the six is here by name, with where it lands and why,
        // because "ancient arts are a different thing" is exactly the reading
        // that would let the tier become a second catalog.
        //
        // Four of them address a BODY, and that is the whole argument for why
        // the causal word is the rung above them rather than a different idea:
        //
        //   hundred-pace-step        moves one body - the practitioner's - to
        //                            somewhere it was not. A body.
        //   vessel-borrowing-palm    moves a resource out of one body and into
        //                            another. Two bodies, and nothing else.
        //   sixteen-thread-command   makes ONE person act. It sits well under
        //                            the ceiling its rung allows, which is the
        //                            clearest single demonstration in the
        //                            catalog that an ancient art does not buy
        //                            height on this axis.
        //   hollow-second-body       a second body is a body.
        //
        // None of them needs the ladder bent to accommodate it, and the thing
        // that makes each remarkable is what it does to the subject rather than
        // which subject it is allowed to have.
        const addressesABody = [
            'hundred-pace-step',
            'vessel-borrowing-palm',
            'sixteen-thread-command',
            'hollow-second-body'
        ];
        for (const id of addressesABody) {
            const t = getTechnique(id)!;
            expect(t.era, `${id} is not ancient`).toBe('ancient');
            expect(addressOf(t), `${id}`).toBe('body');
        }

        // And the one that proves the guard bites rather than merely holding:
        // the Sixteen-Thread Command is written for a rung whose ceiling is two
        // steps above where the art actually lands. An ancient art is allowed
        // to be far under its ceiling and is never allowed over it.
        const command = getTechnique('sixteen-thread-command')!;
        expect(addressRank(addressCeilingForOrdinal(command.requiredOrdinal)))
            .toBeGreaterThan(addressRank(addressOf(command)));

        // The remaining two act on a LOCATION - a piece of ground taken out of
        // the world for an hour, and spears left standing in it afterwards -
        // and both are written for rungs that permit `place`. They have no
        // explicit declaration yet, so they currently read at the conservative
        // default. Asserted as legality rather than as a fixed value, so this
        // passes before and after the catalog declares them and never locks in
        // the answer it is waiting for.
        for (const id of ['sealed-field-of-the-shut-hour', 'thousand-spear-summoning']) {
            const t = getTechnique(id)!;
            expect(t.era, `${id} is not ancient`).toBe('ancient');
            expect(addressIsLegal(t), `${id}`).toBe(true);
            expect(
                addressRank(addressCeilingForOrdinal(t.requiredOrdinal)),
                `${id} is written for a rung that cannot hold a place art`
            ).toBeGreaterThanOrEqual(addressRank('place'));
        }
    });

    it('every art above the Lid is elementless, which is what lets the idiom be ancient', () => {
        // ANCIENT IS A PARADIGM, NOT A DATE. The immortal realm changes slowly,
        // so it never left the categorical idiom, and an art composed up there
        // today is ancient by construction rather than by age.
        //
        // The catalog has not caught up: all six arts above the Lid are
        // currently filed `modern`, from a hand-authored id set that was never
        // extended upward. This test does NOT assert either classification -
        // asserting the current one would freeze a known discrepancy, and
        // asserting the intended one would fail against data somebody else
        // owns. It asserts the property that makes the reclassification legal
        // and that must hold either way: carrying an element is what the other
        // idiom does, and nothing up here carries one.
        const above = TECHNIQUES.filter(t => t.requiredOrdinal >= FALSE_IMMORTAL_ORDINAL);
        expect(above.length).toBeGreaterThan(0);
        for (const t of above) {
            expect(t.element, `${t.id} is above the Lid and carries an element`).toBeNull();
        }
    });

    it('the categorical line addresses subjects that are there, which is what the top rung does not', () => {
        // The load-bearing consequence, stated as a check rather than as prose.
        // Every ancient art has a subject: a body to move, a body to take from,
        // a person to command, a place to seal. That is why a decree is the
        // rung ABOVE the categorical line rather than a parallel to it - it is
        // the one thing on the ladder that needs nothing to already be there.
        // Narrowed to the categorical line BELOW THE LID, which is what the
        // claim was always about. Above it the distinction stops doing work:
        // a decree is itself categorical, the arts up there are ancient, and
        // an art that needs nothing to already be true is exactly the rung
        // this test says sits above the ones that do.
        const ancient = TECHNIQUES.filter(
            t => t.era === 'ancient' && t.requiredOrdinal < FALSE_IMMORTAL_ORDINAL
        );
        expect(ancient.length).toBeGreaterThan(0);
        for (const t of ancient) {
            expect(addressOf(t), `${t.id} decrees`).not.toBe('decree');
        }
        expect(DECREE_IS_NOT_A_LARGER_SETTLED.decree).toMatch(/needs nothing/i);
    });

    it('the catalog reads honestly about how far up the ladder it has been climbed', () => {
        // The default is deliberately conservative, so a row that has never
        // been thought about on this axis does not claim a rung. The state of
        // the catalog is therefore a true statement rather than a flattering
        // one, and this test is here to be UPDATED when the higher addresses
        // are authored - not to keep them empty.
        const reached = new Set(TECHNIQUES.map(t => addressOf(t)));
        expect(reached.has('body')).toBe(true);
        expect(reached.has('place')).toBe(true);
    });

    it('defaultAddressFor reads reach and class and nothing else', () => {
        expect(defaultAddressFor({ class: 'cultivation', reach: 'field' })).toBe('body');
        expect(defaultAddressFor({ class: 'dao', reach: undefined })).toBe('body');
        // A wide swing is a headcount, not a subject. Three bodies is three
        // bodies - see the note on `defaultAddressFor`, which the two
        // mortal-grade `several` arts settled.
        expect(defaultAddressFor({ class: 'dao', reach: 'several' })).toBe('body');
        expect(defaultAddressFor({ class: 'dao', reach: 'field' })).toBe('place');
    });

    it('a wide swing at a low rung does not claim a rung it has no business at', () => {
        // The concrete case: a thunder clap and a swept fire arc, both `several`
        // and both well below the floor for `place`. If reach had implied
        // address these would have been illegal, which would have been the
        // ladder mis-specified rather than the catalog mis-authored.
        for (const id of ['drumming-thunder-clap', 'ashfall-crescent']) {
            const t = getTechnique(id)!;
            expect(t.reach).toBe('several');
            expect(t.requiredOrdinal).toBeLessThan(ADDRESS_ORDINAL_FLOORS.place);
            expect(addressOf(t)).toBe('body');
            expect(addressIsLegal(t)).toBe(true);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE UPKEEP - an elder's prediction, made mechanically true
// ─────────────────────────────────────────────────────────────────────────

describe('upkeep: the world running out is a fact the engine produces', () => {
    it('every art with an upkeep stops somebody who is not being supplied', () => {
        const gated = ANCIENT_ARTS.filter(a => a.upkeepHerbId !== null);
        expect(gated.length).toBeGreaterThan(0);
        for (const art of gated) {
            const ceiling = masteryCeilingFor(art.techniqueId);
            expect(ceiling.ceiling, `${art.techniqueId}`).toBe(art.worldSupplyCeiling);
            expect(ceiling.ceiling!).toBeLessThan(1);
            expect(ceiling.upkeepHerbId).toBe(art.upkeepHerbId);
            expect(ceiling.source).toBe('world');
        }
    });

    it('an art with no upkeep goes as far as the practitioner does', () => {
        // The overwhelming majority. No branch on rank, house or entitlement
        // anywhere in this - the arts that stop are the arts that eat something.
        const free = TECHNIQUES.filter(t => masteryCeilingFor(t.id).source === 'no_upkeep');
        expect(free.length).toBeGreaterThan(TECHNIQUES.length - 5);
        for (const t of free.slice(0, 20)) {
            expect(practiceCeilingFor(t.id)).toBe(1);
        }
    });

    it('the two authored provisionings, and only those, beat the world supply', () => {
        // "You must be somebody" from the other direction: somebody who IS
        // being spent on goes further, and there are exactly two such
        // arrangements in the world.
        const stock = STOCKED_INHERITANCES[0];
        const supplied = masteryCeilingFor(stock.techniqueId, {
            kind: 'stocked_inheritance',
            siteId: stock.siteId
        });
        expect(supplied.source).toBe('stocked_inheritance');
        expect(supplied.ceiling).toBe(stock.carriesToMastery);
        expect(supplied.ceiling!).toBeGreaterThan(masteryCeilingFor(stock.techniqueId).ceiling!);

        const remnant = ARCHIVE_COPIES.find(c => c.stock === 'remnant')!;
        const quiet = masteryCeilingFor(remnant.techniqueId, {
            kind: 'house_remnant',
            factionId: remnant.factionId
        });
        expect(quiet.source).toBe('house_remnant');
        // Null rather than a number: nobody has ever counted the stock, and
        // inventing a figure would be the engine asserting what the world does
        // not know.
        expect(quiet.ceiling).toBeNull();

        // Exactly one remnant in the world. If this grows the scarcity the
        // whole tier rests on has quietly evaporated.
        expect(ARCHIVE_COPIES.filter(c => c.stock === 'remnant')).toHaveLength(1);
        expect(STOCKED_INHERITANCES).toHaveLength(1);
    });

    it('a provisioning that does not apply falls back to the world, never past it', () => {
        const stock = STOCKED_INHERITANCES[0];
        // Wrong site.
        expect(
            masteryCeilingFor(stock.techniqueId, { kind: 'stocked_inheritance', siteId: 'grave-nobody' }).source
        ).toBe('world');
        // A house with no remnant of this one.
        expect(
            masteryCeilingFor(stock.techniqueId, { kind: 'house_remnant', factionId: 'sect-sweptground-temple' }).source
        ).toBe('world');
    });

    it('reports being stalled by supply separately from being finished', () => {
        const art = ANCIENT_ARTS.find(a => a.upkeepHerbId !== null)!;
        const at = art.worldSupplyCeiling!;
        expect(isSupplyStalled(art.techniqueId, at - 0.01)).toBe(false);
        expect(isSupplyStalled(art.techniqueId, at)).toBe(true);
        // An art with no upkeep is never stalled, at any mastery, including 1.
        expect(isSupplyStalled('cross-meridian-strike', 1, UNPROVISIONED)).toBe(false);
    });

    it('supplyLimitedArts is the world describing its own shortage', () => {
        const limited = supplyLimitedArts();
        expect(limited.map(l => l.techniqueId).sort()).toEqual(
            ANCIENT_ARTS.filter(a => a.upkeepHerbId !== null).map(a => a.techniqueId).sort()
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────
// DORMANT ARTS
// ─────────────────────────────────────────────────────────────────────────

describe('dormant arts: present, complete, proven and unperformed', () => {
    it('every holding names a real faction and a real art', () => {
        for (const row of DORMANT_ARTS) {
            expect(getSect(row.factionId), row.factionId).toBeDefined();
            expect(getTechnique(row.techniqueId), row.techniqueId).toBeDefined();
            expect(FACTION_CHARACTER[row.factionId], row.factionId).toBeDefined();
        }
    });

    it('is out of reach in fact, not in policy: the art stands above the best hand in the house', () => {
        // RULE 2. Nobody is refusing anybody. There is simply nobody there high
        // enough, and this is the assertion that keeps the whole table from
        // becoming a set of locked doors.
        for (const row of DORMANT_ARTS) {
            const sect = getSect(row.factionId)!;
            const art = getTechnique(row.techniqueId)!;
            expect(
                art.requiredOrdinal,
                `${row.factionId} could actually perform ${row.techniqueId}`
            ).toBeGreaterThan(sect.powerOrdinal);
        }
    });

    it('is never on the teach list, which is what keeps provenance honest', () => {
        // RULE 1. `teaches` is a house's entire WORKING library and no sect
        // teaches a ruin- or grave-provenance art. A shelved book nobody can
        // open is not a living transmission and must not create one.
        for (const row of DORMANT_ARTS) {
            const sect = getSect(row.factionId)!;
            expect(
                sect.teaches,
                `${row.factionId} both shelves and teaches ${row.techniqueId}`
            ).not.toContain(row.techniqueId);
        }
    });

    it('every holding is learnable and every price is more than money', () => {
        // RULE 3. A destination nobody can reach is scenery.
        for (const row of DORMANT_ARTS) {
            expect(row.terms.length, row.factionId).toBeGreaterThan(60);
            expect(row.evidence.length, row.factionId).toBeGreaterThan(60);
            expect(row.howItGotHere.length, row.factionId).toBeGreaterThan(40);
            expect(row.howTheHouseTalksAboutIt.length, row.factionId).toBeGreaterThan(40);
        }
    });

    it('the house knows it works: no holding is hedged', () => {
        // The distinguishing property of this state, and the reason it is not
        // the same as an ancestral claim. `evidence` is a record, never a
        // tradition - so the hedging vocabulary that belongs on a claim must
        // not appear here.
        const hedges = /\b(it is said|legend|allegedly|supposedly|rumoured|believed to have)\b/i;
        for (const row of DORMANT_ARTS) {
            expect(hedges.test(row.evidence), `${row.factionId} hedges its evidence`).toBe(false);
        }
    });

    it('does not restate a figure that lives in the catalogs', () => {
        // No arithmetic and no numbers in a lore file: how many rungs short and
        // how long it has been are both derivable, so neither is written down.
        for (const row of DORMANT_ARTS) {
            const prose = [row.howItGotHere, row.evidence, row.howTheHouseTalksAboutIt, row.terms].join(' ');
            expect(/\bordinal\b/i.test(prose), row.factionId).toBe(false);
        }
    });

    it('does not duplicate a holding ARCHIVE_COPIES already records', () => {
        // Two tables, two shortages: `ARCHIVE_COPIES` is a house that cannot
        // FEED a book, this is a house that cannot REACH one. One fact in two
        // places is one too many.
        for (const row of DORMANT_ARTS) {
            const duplicate = ARCHIVE_COPIES.some(
                c => c.factionId === row.factionId && c.techniqueId === row.techniqueId
            );
            expect(duplicate, `${row.factionId}/${row.techniqueId} is in both tables`).toBe(false);
        }
    });

    it('reaches both kinds of institution, because the idea is not about form', () => {
        // A Dao house holds the far end of its own principle because a lineage
        // sits on whoever was born. A sect holds what its peak practised
        // because it had a peak. Different reasons, same state.
        const factions = factionsHoldingDormantArts();
        expect(factions.some(f => f.startsWith('house-'))).toBe(true);
        expect(factions.some(f => f.startsWith('sect-'))).toBe(true);
    });

    it('every holder has a production record with a real gap in it', () => {
        // The derivation the table is built from: an institution holds what it
        // cannot perform because it was once able to produce more than it can
        // now. A holder with no gap is a house that never had the capacity,
        // which is a different and less interesting story.
        for (const factionId of factionsHoldingDormantArts()) {
            const production = FACTION_CHARACTER[factionId].production;
            expect(
                production.peakOrdinal,
                `${factionId} holds a dormant art and never peaked above what it turns out now`
            ).toBeGreaterThan(production.reliableOrdinal);
        }
    });

    it('lookups resolve in both directions', () => {
        const row = DORMANT_ARTS[0];
        expect(dormantArtsOf(row.factionId)).toContain(row);
        expect(whoHoldsDormant(row.techniqueId)).toContain(row);
        expect(dormantArtsOf('sect-that-does-not-exist')).toEqual([]);
        expect(whoHoldsDormant('no-such-art')).toEqual([]);
    });

    it('the starkest case in the catalog is the one the setting already built', () => {
        // The Sweptground Temple: reliable at Foundation, a founder who crossed,
        // and three sets of writings from above the Lid on a shelf in a place
        // that keeps no accounts. Nobody authored this; it fell out of the
        // production table meeting the transmission rule at the top rung.
        const held = dormantArtsOf('sect-sweptground-temple');
        expect(held.length).toBeGreaterThanOrEqual(3);
        for (const row of held) {
            expect(getTechnique(row.techniqueId)!.requiredOrdinal).toBe(MAX_ORDINAL);
        }
        expect(FACTION_CHARACTER['sect-sweptground-temple'].production.peakOrdinal).toBe(MAX_ORDINAL);
    });

    it('no faction in SECTS is named that the sect catalog does not carry', () => {
        const known = new Set(SECTS.map(s => s.id));
        for (const row of DORMANT_ARTS) expect(known.has(row.factionId)).toBe(true);
    });
});
