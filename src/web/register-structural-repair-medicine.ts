/**
 * The Standing Register's section on the medicine that mends a cracked
 * cultivator.
 *
 * A VIEW, like the rest of the register: nothing here authors anything. Every
 * figure is read off the catalog and the engine, so the section cannot drift
 * from what the world actually believes, and a content edit moves it without
 * anybody touching this file.
 *
 * IT LIVES IN ITS OWN MODULE ON PURPOSE. `register.ts` is three hundred
 * kilobytes and is worked on by several people at once; a section that can be
 * built by one function and spliced in with one line is a section that does not
 * require anybody to open that file while somebody else is inside it. The
 * renderer is here too, for the same reason.
 *
 * ── WHAT THE SECTION IS FOR ──────────────────────────────────────────────
 *
 * The register is the sheet that states plainly what the world spends enormous
 * effort keeping unstated, and this is one of the things it keeps most quiet.
 * Two questions it answers that nothing else in the register does, and both of
 * them name a body, which is why they are the ledger's:
 *
 *   HOW MANY SENT-DOWN DOSES ARE LEFT. The only medicine that reaches a break
 *   above Deity Transformation cannot be made on this side, so its supply is a
 *   fixed count that only ever falls. That number is the headline, and it is
 *   summed from the holdings rather than restated, so a holdings edit moves it.
 *
 *   WHO IS HOLDING WHAT. Read off the same table, and it should read as strange:
 *   two bureaucracies, one sect, one court, one guild and two houses, and
 *   nobody else in either province holds a single dose of anything.
 *
 * WHAT EACH MEDICINE IS is not here any more - it is a row in the almanac
 * listing on the Objects tab, beside the pills and the materials, where a dose
 * can be compared against them. `buildRepairMedicineRegister` still derives the
 * ceilings and every reading, because both are read from here; what left is the
 * second table that was printing four of the same six columns.
 */

import {
    STRUCTURAL_REPAIR_MEDICINES,
    STRUCTURAL_REPAIR_HOLDINGS,
    SENT_DOWN_SPENDINGS,
    SENT_DOWN_UNACCOUNTED,
    getStructuralRepairMedicine
} from '../data/cultivation/structural-repair-medicine.js';
import {
    readAllRepairMedicine,
    sentDownLedgerTotals,
    ordinaryGradeCeiling,
    NOTHING_REPAIRS_ABOVE_ORDINAL,
    type RepairMedicineReading
} from '../engine/cultivation/what-structural-repair-medicine-can-reach.js';
import { APEX_INSTITUTIONS, COURTS } from '../data/cultivation/governance-and-water-rights.js';
import { SECTS } from '../data/cultivation/sects.js';

export interface RegisterRepairHolding {
    factionId: string;
    name: string;
    medicineId: string;
    medicineName: string;
    grade: string;
    count: number;
    /** Kept as a row with a provenance, rather than as a number. */
    tracked: boolean;
    whyStillHeld: string;
    whoDecides: string;
}

export interface RegisterRepairMedicine {
    counts: {
        /**
         * Sent-down doses standing in the world. The figure the register exists
         * to carry: the entire supply of the only thing that reaches a break
         * above the end of Deity Transformation, and it never goes up.
         */
        sentDownStanding: number;
        sentDownEverArrived: number;
        sentDownSpent: number;
        sentDownUnaccounted: number;
        /** Doses of every grade, everywhere, at the start of the world. */
        allDoses: number;
        holders: number;
    };
    /** The last rung anything reaches, and the last anything made here reaches. */
    ceilings: {
        anythingAtAll: number;
        madeBelowTheLid: number;
    };
    medicines: RepairMedicineReading[];
    holdings: RegisterRepairHolding[];
    /** The dated record of what has been spent, which is three lines long. */
    spendings: {
        yearsAgo: number;
        spentByFactionId: string | null;
        spentByName: string | null;
        onWoundKey: string | null;
        entry: string;
    }[];
    unaccounted: {
        heldByFactionId: string;
        heldByName: string;
        count: number;
        note: string;
    };
}

/**
 * The name of a holder, whatever kind of body it is.
 *
 * Two of the holders are apex institutions that are deliberately not factions,
 * and one is a court with no sect behind it, so a lookup against `SECTS` alone
 * would print an id. The register never prints an id where a name exists.
 */
function nameOf(id: string): string {
    const sect = SECTS.find(s => s.id === id);
    if (sect) return sect.name;
    const apex = APEX_INSTITUTIONS.find(a => a.id === id || a.factionId === id);
    if (apex) return apex.name;
    const court = COURTS.find(c => c.id === id || c.embodiedByFactionId === id);
    if (court) return court.name;
    return id;
}

/** Build the section. Pure; reads catalogs and derives, decides nothing. */
export function buildRepairMedicineRegister(): RegisterRepairMedicine {
    const ledger = sentDownLedgerTotals();
    const holdings: RegisterRepairHolding[] = STRUCTURAL_REPAIR_HOLDINGS.map(h => {
        const medicine = getStructuralRepairMedicine(h.medicineId);
        return {
            factionId: h.factionId,
            name: nameOf(h.factionId),
            medicineId: h.medicineId,
            medicineName: medicine?.name ?? h.medicineId,
            grade: medicine?.grade ?? 'unknown',
            count: h.count,
            // The tracked/counted line, read off the terms rather than restated:
            // anything money cannot buy is a row with a provenance.
            tracked: medicine ? medicine.terms !== 'private_sale' : false,
            whyStillHeld: h.whyStillHeld,
            whoDecides: h.whoDecides
        };
    });

    return {
        counts: {
            sentDownStanding: ledger.standing,
            sentDownEverArrived: ledger.everArrived,
            sentDownSpent: ledger.spent,
            sentDownUnaccounted: ledger.unaccounted,
            allDoses: STRUCTURAL_REPAIR_HOLDINGS.reduce((n, h) => n + h.count, 0),
            holders: new Set(STRUCTURAL_REPAIR_HOLDINGS.map(h => h.factionId)).size
        },
        ceilings: {
            anythingAtAll: NOTHING_REPAIRS_ABOVE_ORDINAL,
            madeBelowTheLid: ordinaryGradeCeiling()
        },
        medicines: readAllRepairMedicine(),
        holdings,
        spendings: SENT_DOWN_SPENDINGS.map(s => ({
            yearsAgo: s.yearsAgo,
            spentByFactionId: s.spentByFactionId,
            spentByName: s.spentByFactionId ? nameOf(s.spentByFactionId) : null,
            onWoundKey: s.onWoundKey,
            entry: s.entry
        })),
        unaccounted: {
            heldByFactionId: SENT_DOWN_UNACCOUNTED.heldByFactionId,
            heldByName: nameOf(SENT_DOWN_UNACCOUNTED.heldByFactionId),
            count: SENT_DOWN_UNACCOUNTED.count,
            note: SENT_DOWN_UNACCOUNTED.note
        }
    };
}

/** Every medicine, for a caller that only wants the table. */
export function repairMedicineTable(): RepairMedicineReading[] {
    return readAllRepairMedicine();
}

/** How many medicines the catalog holds. Never hardcode this anywhere. */
export function repairMedicineCount(): number {
    return STRUCTURAL_REPAIR_MEDICINES.length;
}

// ─────────────────────────────────────────────────────────────────────────
// RENDERING
//
// Kept here rather than in `renderRegisterHtml` so that adding this section to
// the sheet is one call rather than an edit inside a file several people are
// working in. The escaping helper is local for the same reason.
// ─────────────────────────────────────────────────────────────────────────

function esc(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/*
 * WHAT THE MEDICINE IS HAS NO RENDERER HERE ANY MORE, AND THAT IS THE FIX.
 *
 * There was one: a section of its own on the Objects tab, four rows, six
 * columns - name, grade, what it reaches, its worth, its price and its terms.
 * Four of those six were already being printed, for the same four rows, on the
 * same tab, in the almanac listing that carries every catalogued thing. Two
 * tables of one set of rows is two authorities on them, and the day one catalog
 * edit moved only one of them is the day the sheet started disagreeing with
 * itself.
 *
 * The listing won, because it is the one where a dose can be compared against a
 * pill and a comprehension material - which is the whole argument for having a
 * listing. `repairRows` in `register-items.ts` carries the worth and the terms
 * now, so nothing was lost, and the ceilings that no cell could hold are the
 * note above that table.
 *
 * The holder half below stays, because it answers the other question: who has
 * one. That is the ledger's, it names a body on every row, and nothing else on
 * the sheet says it.
 */

/**
 * WHO HAS A DOSE, AND WHAT HAS BEEN SPENT. The ledger half, for the Items tab.
 *
 * Every row here names a body. That is the whole test for what belongs on that
 * tab, and it is why this material was in the wrong place: a holder list and a
 * dated record of who spent what on whom is as pure a ledger as this sheet has,
 * and it was filed under the column glossary.
 */
export function renderRepairMedicineHolders(): string {
    const r = buildRepairMedicineRegister();

    const held = r.holdings.map(h => `<tr>
      <td class="nm">${esc(h.name)}</td>
      <td class="nm">${esc(h.medicineName)}</td>
      <td class="pw">${h.count}</td>
      <td class="m">${h.tracked ? 'tracked' : 'counted'}</td>
      <td class="q">${esc(h.whoDecides)}</td>
    </tr>`).join('\n');

    const spent = r.spendings.map(s => `<li><strong>${s.yearsAgo} years ago</strong>`
        + ` - ${esc(s.spentByName ?? 'unrecorded')}`
        + `${s.onWoundKey ? ` (${esc(s.onWoundKey)})` : ''}: ${esc(s.entry)}</li>`).join('\n');

    return `
<section id="who-holds-repair-medicine">
  <div class="sh"><h2>Who holds repair medicine</h2><span class="r">${r.counts.allDoses} doses &middot; ${r.counts.holders} bodies</span></div>
  <p class="note"><strong>Sent down and still standing: ${r.counts.sentDownStanding}.</strong>
     ${r.counts.sentDownEverArrived} have ever arrived; ${r.counts.sentDownSpent} are
     spent in the dated record; ${r.counts.sentDownUnaccounted} cannot be accounted
     for by ${esc(r.unaccounted.heldByName)}. Nobody below the Lid can make another,
     so this figure only ever falls.</p>
  <div class="scroll"><table class="itemtbl">
    <colgroup><col style="width:24%"><col style="width:22%"><col style="width:8%"><col style="width:10%"><col style="width:36%"></colgroup>
    <thead><tr><th>Holder</th><th>Medicine</th><th>Count</th><th>Kept as</th><th>Who decides</th></tr></thead>
    <tbody>${held}</tbody>
  </table></div>
  <h3 class="bandhead">The sent-down record <span>${r.spendings.length}</span></h3>
  <ul class="spendlist">${spent}</ul>
  <p class="note">${esc(r.unaccounted.note)}</p>
</section>`;
}
