/**
 * The Standing Register's section on what is actually inside each house.
 *
 * A VIEW, like the rest of the register. Every figure is read off a dossier the
 * sheet has already built or off the catalog that owns it, and nothing here is
 * authored, summarised or scored.
 *
 * ── THE QUESTION THIS ANSWERS, WHICH NO OTHER TAB DOES ───────────────────
 *
 * The Factions tab answers what a house IS: where it sits, who backs it, how it
 * came to be here, and how it stands with everybody. That is nine hundred years
 * of context and it is the wrong document for the question somebody standing at
 * the gate actually has:
 *
 *     IF I WALK INTO THIS HOUSE, WHAT IS IN IT - AND WHAT CAN IT DO FOR ME OR
 *     TO ME?
 *
 * Which is a question about inventory, and the inventory is scattered across
 * seven catalogs that have never been read side by side. An artifact's owner is
 * a field on the object; the arts are a teach list on the sect; the doses are a
 * holdings table in a third file; the ground is a grant in a fourth; what is
 * asleep under the mountain is in the ancestral records; the building it is all
 * kept in is a compound record; and the money is a stipend array. A reader who
 * wants to know whether this house is worth joining, robbing or avoiding has to
 * open all seven, and nothing has ever put them on one line.
 *
 * ── FOR ME AND TO ME ARE TWO DIFFERENT COLUMNS ───────────────────────────
 *
 * And they are separated on purpose, because a house is routinely strong in one
 * and empty in the other. What a house can do FOR somebody is its shelf, its
 * gate and its purse: what it will teach, whether it will have you, and what it
 * pays. What it can do TO somebody is what it can put in front of you: the rung
 * its strongest acting member stands on, the strongest object it owns, and -
 * the one that actually kills people - what it could field once, at a cost that
 * is usually the house itself. A body with a modest teach list and something
 * asleep at forty-plus reads as unremarkable on every other tab on this sheet.
 *
 * ── NOTHING IS SCORED ────────────────────────────────────────────────────
 *
 * There is deliberately no total, no rating and no ordering by wealth. The
 * register reports and the engine decides, and a "how rich is this house"
 * number would be this sheet inventing an assessment the engine does not make -
 * on top of which the quantities are not commensurable: doses, arts, nodes and
 * an ordinal do not add up, and any weighting that made them add up would be a
 * balance constant living in a view. Rows are ordered by acting ordinal, which
 * is the order every other table on this sheet uses.
 */

import type { SectDossier } from './register.js';
import { SECTS, getSect, getSectAncestry } from '../data/cultivation/sects.js';
import { STRUCTURAL_REPAIR_HOLDINGS, getStructuralRepairMedicine } from '../data/cultivation/structural-repair-medicine.js';
import { rankName } from '../engine/cultivation/realms.js';

/** One dose line: which medicine, how many, and whether it is a row or a count. */
export interface HouseDoses {
    medicineId: string;
    medicineName: string;
    grade: string;
    count: number;
    /** Nobody below the Lid can refine one, so the figure only ever falls. */
    sentDown: boolean;
    whoDecides: string;
}

/**
 * Everything one body is holding, from every catalog at once.
 *
 * `null` and `0` are different answers throughout and neither is padded: a
 * house with no teach list is not a house that teaches nothing badly, and a
 * body with no compound record is not a body sitting in a ruin.
 */
export interface HouseHoldings {
    id: string;
    name: string;
    /** The anchor its full entry sits at, for the drill-through. */
    anchor: string;
    ordinal: number;
    rank: string;
    alignment: string;

    // ── What it can do to you ─────────────────────────────────────────
    /** What it could field once, at cost. Null where that is just its ordinal. */
    ceiling: number | null;
    ceilingRank: string | null;
    /** Whether rivals can be assumed to know the ceiling is there. */
    ceilingIsPublic: boolean;
    /** What waking it would cost, which is generally the house. */
    wakeCost: string | null;
    /** Objects out of the artifact catalog it owns, strongest first. */
    objects: { name: string; power: number; inVault: boolean; heldBy: string }[];
    strongestObject: number | null;
    /** Somebody asleep under a mountain, and the rung they went under at. */
    asleep: { name: string; ordinal: number; years: number; publiclyKnown: boolean } | null;

    // ── What it can do for you ────────────────────────────────────────
    /** Whether there is a door at all, and what it wants. */
    admissionOrdinal: number;
    recruits: boolean;
    intake: string;
    /** Arts on the teach list, and how much of that list is this house's alone. */
    artsTaught: number;
    artsOnlyHere: number;
    hardestArt: { name: string; grade: string; requiredOrdinal: number } | null;
    /** A road that runs to the top of the ladder. Four bodies hold one. */
    holdsADeepRoad: boolean;
    /** Spirit stones a month at the top of its own ladder, where it pays one. */
    topStipend: number | null;
    topRank: string | null;

    // ── What is in the building ───────────────────────────────────────
    /** Immortal objects, which are the only things that buy a crossing. */
    immortalObjects: { item: string; count: number; higher: number; middle: number; lower: number }[];
    immortalObjectCount: number;
    /** Structural repair medicine, at the opening of the world. */
    doses: HouseDoses[];
    doseCount: number;
    /**
     * How much of its own inheritance it can still operate.
     *
     * `lit` over `total` is the single most useful number for describing a
     * house honestly, and it is a fraction rather than a rating: nine of
     * forty-one is a body camping in something it did not build and cannot run.
     */
    compound: { lit: number; total: number; inherited: boolean } | null;
    /** What an ascending ancestor left on the way out, and whether it still works. */
    partingGift: { name: string; intact: boolean } | null;
    /** The ground it holds, and in whose gift. Null where nothing records one. */
    holds: string | null;
    holdsFromName: string | null;
}

export interface RegisterHoldings {
    counts: {
        houses: number;
        withAnObject: number;
        withAnImmortalObject: number;
        withDoses: number;
        withSomethingAsleep: number;
        withADeepRoad: number;
        holdingNothingAtAll: number;
    };
    houses: HouseHoldings[];
}

// ─────────────────────────────────────────────────────────────────────────
// BUILD
// ─────────────────────────────────────────────────────────────────────────

/**
 * The opening repair-medicine holdings for one body.
 *
 * The catalog figure is what the house had when the world was made, which is
 * the only figure a sheet built from catalogs can honestly print - a running
 * world's live count is `repairMedicineHeldBy` against `state.objects`, and it
 * moves. The column says which one it is.
 */
function dosesOf(factionId: string): HouseDoses[] {
    return STRUCTURAL_REPAIR_HOLDINGS
        .filter(h => h.factionId === factionId)
        .map(h => {
            const medicine = getStructuralRepairMedicine(h.medicineId);
            return {
                medicineId: h.medicineId,
                medicineName: medicine?.name ?? h.medicineId,
                grade: medicine?.grade ?? 'unknown',
                count: h.count,
                sentDown: medicine ? !medicine.madeBelowTheLid : false,
                whoDecides: h.whoDecides
            };
        })
        .sort((a, b) => b.count - a.count || a.medicineName.localeCompare(b.medicineName));
}

/**
 * What a body pays at the top of its own ladder.
 *
 * The last entry of the stipend array against the last rank title, because the
 * two arrays are parallel on the record and the top of one is the top of the
 * other. A body with neither pays nothing anybody has written down, which is
 * a real answer on the several here that are not sects at all.
 */
function topStipendOf(factionId: string): { stones: number; rank: string } | null {
    const sect = getSect(factionId);
    if (!sect || sect.stipend.length === 0 || sect.ranks.length === 0) return null;
    const stones = sect.stipend[sect.stipend.length - 1];
    const rank = sect.ranks[Math.min(sect.stipend.length, sect.ranks.length) - 1];
    return { stones, rank };
}

/**
 * Read one dossier, plus the four catalogs the dossier does not carry.
 *
 * The compound, the stipend and the opening doses are not on the dossier and
 * are not put there: the dossier is the faction entry's shape and it is already
 * enormous, and these three are only interesting when a reader is comparing
 * houses side by side, which is exactly what this section is and nothing else
 * is.
 */
function holdingsOf(d: SectDossier): HouseHoldings {
    const sect = getSect(d.id);
    const ancestry = getSectAncestry(d.id);
    const stipend = topStipendOf(d.id);
    const doses = dosesOf(d.id);
    const objects = d.artifacts.map(a => ({
        name: a.name,
        power: a.power,
        inVault: a.inVault,
        heldBy: a.possessorName || 'nobody'
    }));

    return {
        id: d.id,
        name: d.name,
        anchor: `faction-${d.id}`,
        ordinal: d.ordinal,
        rank: d.rank,
        alignment: d.alignment,

        ceiling: d.fielded.ceiling,
        ceilingRank: d.fielded.ceilingRank,
        ceilingIsPublic: d.fielded.ceilingIsPublic,
        wakeCost: d.fielded.wakeCost,
        objects,
        strongestObject: objects.length ? Math.max(...objects.map(o => o.power)) : null,
        asleep: d.people.sealed
            ? {
                name: d.people.sealed.name,
                ordinal: d.people.sealed.ordinal,
                years: d.people.sealed.dormantYears,
                publiclyKnown: d.people.sealed.publiclyKnown
            }
            : null,

        admissionOrdinal: d.admissionOrdinal,
        recruits: d.recruits,
        intake: d.intake,
        artsTaught: d.curriculum?.arts.length ?? 0,
        artsOnlyHere: d.curriculum?.exclusiveCount ?? 0,
        hardestArt: d.curriculum?.hardest
            ? {
                name: d.curriculum.hardest.name,
                grade: d.curriculum.hardest.grade,
                requiredOrdinal: d.curriculum.hardest.requiredOrdinal
            }
            : null,
        holdsADeepRoad: d.deepRoad !== null,
        topStipend: stipend?.stones ?? null,
        topRank: stipend?.rank ?? null,

        immortalObjects: d.holdings.map(h => ({
            item: h.item,
            count: h.count,
            higher: h.byGrade.higher,
            middle: h.byGrade.middle,
            lower: h.byGrade.lower
        })),
        immortalObjectCount: d.holdings.reduce((n, h) => n + h.count, 0),
        doses,
        doseCount: doses.reduce((n, h) => n + h.count, 0),
        compound: sect
            ? {
                lit: sect.compound.formationNodesLit,
                total: sect.compound.formationNodesTotal,
                inherited: sect.compound.inherited
            }
            : null,
        partingGift: d.partingGift ?? (ancestry?.partingGift
            ? { name: ancestry.partingGift.name, intact: ancestry.partingGift.intact }
            : null),
        holds: d.holdsFrom?.holds ?? null,
        holdsFromName: d.holdsFrom?.parentName ?? null
    };
}

/** Build the section. Pure; reads the dossiers and the catalogs, decides nothing. */
export function buildHoldings(dossiers: readonly SectDossier[]): RegisterHoldings {
    const houses = dossiers.map(holdingsOf);
    // "Nothing at all" is a real and useful state, and it is deliberately
    // measured on the four things somebody could take rather than on the
    // teach list: a house with a shelf and no objects is poor, not empty.
    const empty = houses.filter(h =>
        h.objects.length === 0
        && h.immortalObjectCount === 0
        && h.doseCount === 0
        && h.asleep === null
        && h.partingGift === null);

    return {
        counts: {
            houses: houses.length,
            withAnObject: houses.filter(h => h.objects.length > 0).length,
            withAnImmortalObject: houses.filter(h => h.immortalObjectCount > 0).length,
            withDoses: houses.filter(h => h.doseCount > 0).length,
            withSomethingAsleep: houses.filter(h => h.asleep !== null).length,
            withADeepRoad: houses.filter(h => h.holdsADeepRoad).length,
            holdingNothingAtAll: empty.length
        },
        houses
    };
}

/** How many bodies the sect catalog holds. Never hardcode this anywhere. */
export function houseCount(): number {
    return SECTS.length;
}

// ─────────────────────────────────────────────────────────────────────────
// RENDERING
// ─────────────────────────────────────────────────────────────────────────

function esc(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

const stones = (v: number): string => v.toLocaleString('en-US');

const dim = (s: string): string => `<span class="dim">${esc(s)}</span>`;

/** The drill-through: everything on the row, spelled out. */
function houseDetail(h: HouseHoldings): string {
    const parts: string[] = [];

    if (h.objects.length) {
        parts.push(`<dt>Objects</dt><dd>${h.objects.map(o =>
            `<strong>${esc(o.name)}</strong> at ${o.power}, ${o.inVault ? 'in its own vault' : `carried by ${esc(o.heldBy)}`}`
        ).join('. ')}.</dd>`);
    }
    if (h.immortalObjects.length) {
        parts.push(`<dt>Immortal objects</dt><dd>${h.immortalObjects.map(i =>
            `${i.count} ${esc(i.item)} - higher ${i.higher}, middle ${i.middle}, lower ${i.lower}`
        ).join('. ')}. Grade caps the destination rather than the distance: every grade performs one crossing, and a higher grade buys permission to perform it further up the ladder.</dd>`);
    }
    if (h.doses.length) {
        parts.push(`<dt>Repair medicine</dt><dd>${h.doses.map(x =>
            `${x.count} ${esc(x.medicineName)} (${esc(x.grade)}${x.sentDown ? ', sent down and irreplaceable' : ''}), ${esc(x.whoDecides)}`
        ).join('. ')}.</dd>`);
    }
    if (h.asleep) {
        parts.push(`<dt>Under the mountain</dt><dd><strong>${esc(h.asleep.name)}</strong> at ordinal ${h.asleep.ordinal} (${esc(rankName(h.asleep.ordinal))}), ${stones(h.asleep.years)} years dormant. ${h.asleep.publiclyKnown ? 'The world knows this is there.' : 'Not publicly known, which is most of what it is worth.'}${h.wakeCost ? ` Waking it costs: ${esc(h.wakeCost)}` : ''}</dd>`);
    }
    if (h.partingGift) {
        parts.push(`<dt>Left on the way out</dt><dd>${esc(h.partingGift.name)}${h.partingGift.intact ? '' : ', and it no longer works'}.</dd>`);
    }
    if (h.hardestArt) {
        parts.push(`<dt>What it will teach you</dt><dd>${h.artsTaught} art${h.artsTaught === 1 ? '' : 's'}, ${h.artsOnlyHere === 0 ? 'none of them exclusive to it' : `${h.artsOnlyHere} of which nobody else in the world teaches`}. The hardest is <strong>${esc(h.hardestArt.name)}</strong>, ${esc(h.hardestArt.grade)} grade, written for ordinal ${h.hardestArt.requiredOrdinal}.${h.holdsADeepRoad ? ' It also holds a road that runs to the top of the ladder, which four bodies in the world do.' : ''}</dd>`);
    }
    if (h.topStipend !== null && h.topRank) {
        parts.push(`<dt>What it pays</dt><dd>${stones(h.topStipend)} spirit stones a month at ${esc(h.topRank)}, its top rank.</dd>`);
    }
    if (h.compound) {
        // A house with no nodes at all is not a fraction. "0 of 0 formation
        // nodes lit... that fraction is how much of its own inheritance it can
        // still operate" says nothing, because nought over nought is not a
        // proportion of anything - and it rendered four times on the sheet.
        // What is true about such a house is that its compound was never
        // formed, which is a different and more interesting fact than a house
        // that has lost its lights.
        const whose = h.compound.inherited
            ? 'a compound it did not build'
            : 'a compound it built itself';
        parts.push(h.compound.total === 0
            ? `<dt>The building</dt><dd>No formation nodes at all, in ${whose}. Nothing here was ever lit, so there is nothing for it to have lost.</dd>`
            : `<dt>The building</dt><dd>${h.compound.lit} of ${h.compound.total} formation nodes lit, in ${whose}. That fraction is how much of its own inheritance it can still operate.</dd>`);
    }
    if (h.holds) {
        parts.push(`<dt>The ground</dt><dd>${esc(h.holds)}${h.holdsFromName ? ` In the gift of ${esc(h.holdsFromName)}.` : ''}</dd>`);
    }

    if (!parts.length) {
        return `<p class="none">Nothing in any catalog is filed against this body: no object, no dose, nobody asleep, and nothing left on the way out. That is a body whose whole standing is the people in it.</p>`;
    }
    return `<dl class="holdset">${parts.join('')}</dl>`;
}

/**
 * One house's inventory, spelled out, keyed by faction id.
 *
 * WHY THIS IS EXPORTED. The Holdings tab used to end on a flat alphabet of
 * disclosures - every body in the world in one list, in a shape that appeared
 * nowhere else on the sheet. It now draws the same house structure the
 * Factions tab draws, so a reader who has learned where a body sits once knows
 * where to find its inventory. That structure lives in `register.ts` because
 * it is read out of the hierarchy catalogs; what this module owns is what is
 * INSIDE a house, so it hands over the bodies and keeps the question.
 */
export function holdingsByHouse(dossiers: readonly SectDossier[]): Map<string, string> {
    return new Map(buildHoldings(dossiers).houses.map(h => [h.id, houseDetail(h)]));
}

/** What a house is holding, at a glance, for its closed card. */
export function holdingsFacts(dossiers: readonly SectDossier[]): Map<string, string[]> {
    return new Map(buildHoldings(dossiers).houses.map(h => [h.id, [
        h.objects.length ? `${h.objects.length} object${h.objects.length === 1 ? '' : 's'}, top ${h.strongestObject}` : '',
        h.immortalObjectCount ? `${h.immortalObjectCount} immortal object${h.immortalObjectCount === 1 ? '' : 's'}` : '',
        h.doseCount ? `${h.doseCount} dose${h.doseCount === 1 ? '' : 's'}` : '',
        h.asleep ? `somebody asleep at ${h.asleep.ordinal}` : '',
        h.compound ? `${h.compound.lit}/${h.compound.total} nodes lit` : ''
    ].filter(Boolean)]));
}

/**
 * The pane, as HTML. Takes the dossiers the sheet has already built, so nothing
 * is read twice and nothing here can disagree with the faction entries.
 */
export function renderHoldingsSection(dossiers: readonly SectDossier[]): string {
    const r = buildHoldings(dossiers);
    const c = r.counts;

    const rows = r.houses.map(h => `<tr>
    <td class="nm"><span class="jump" data-goto="${esc(h.anchor)}">${esc(h.name)}</span> ${dim(h.alignment)}</td>
    <td class="n">${h.ordinal}${h.ceiling !== null ? ` <span class="chip pin">${h.ceiling} once</span>` : ''}</td>
    <td class="n">${h.objects.length === 0 ? dim('-') : `${h.objects.length} <span class="dim">top ${h.strongestObject}</span>`}</td>
    <td class="n">${h.immortalObjectCount === 0 ? dim('-') : String(h.immortalObjectCount)}</td>
    <td class="n">${h.doseCount === 0 ? dim('-') : String(h.doseCount)}</td>
    <td class="n">${h.asleep === null ? dim('-') : `${h.asleep.ordinal}${h.asleep.publiclyKnown ? '' : ' <span class="chip">quiet</span>'}`}</td>
    <td class="n">${h.artsTaught === 0 ? dim('teaches nobody') : `${h.artsTaught}${h.artsOnlyHere ? ` <span class="dim">${h.artsOnlyHere} its own</span>` : ''}`}</td>
    <td class="n">${h.compound === null ? dim('-') : `${h.compound.lit}/${h.compound.total}`}</td>
    <td class="n">${h.topStipend === null ? dim('-') : stones(h.topStipend)}</td>
    <td class="m">${h.recruits ? `gate ${h.admissionOrdinal}` : dim('takes nobody')}</td>
  </tr>`).join('');

    return `
<section>
  <div class="sh"><h2>What each house holds</h2><span class="r">${c.houses} bodies &middot; strongest acting member first</span></div>
  <p class="note"><strong>For you</strong> is the shelf, the gate and the purse: what it will teach, whether it will have you at all, and what it pays at the top of its own ladder. <strong>To you</strong> is what it can put in front of you: the rung its strongest acting member stands on, the strongest object it owns, and what it could field once at a cost that is usually the house. A body with a modest teach list and something asleep at forty-plus reads as unremarkable everywhere else on this sheet.</p>
  <div class="scroll"><table class="holdtbl">
    <colgroup><col style="width:22%"><col style="width:10%"><col style="width:10%"><col style="width:8%"><col style="width:7%"><col style="width:9%"><col style="width:11%"><col style="width:7%"><col style="width:8%"><col style="width:8%"></colgroup>
    <caption>${c.houses} bodies &middot; ${c.withAnObject} own an object &middot; ${c.withAnImmortalObject} hold an immortal object &middot; ${c.withDoses} hold repair medicine &middot; ${c.withSomethingAsleep} have somebody asleep &middot; ${c.holdingNothingAtAll} hold nothing anybody could take</caption>
    <thead><tr>
      <th>House</th><th>Ord</th><th>Objects</th><th>Immortal</th><th>Doses</th>
      <th>Asleep</th><th>Arts</th><th>Nodes</th><th>Stipend</th><th>Gate</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <p class="note"><em>Ord</em> is the strongest acting member and a second figure beside it is what the body could field once, at cost. <em>Objects</em> counts the artifact catalog's own rows filed to this owner, with the strongest rating beside it. <em>Asleep</em> is the rung a sealed ancestor went under at, and a body marked <span class="chip">quiet</span> is one whose rivals have no reason to think it is there - which is the whole of what that asset is worth. <em>Nodes</em> is formation nodes lit over the total the compound has, and it is the honest measure of how much of its own inheritance a house can still operate. <em>Doses</em> is the opening holding rather than a live count: a running world spends them, and the record follows the dose rather than the number.</p>
  <p class="note">${c.holdingNothingAtAll} of the ${c.houses} hold nothing anybody could carry away - no object, no dose, nobody asleep, nothing left on the way out. That is not a gap in the data. It is a body whose entire standing is the people standing in it, and it is the ordinary case rather than the exceptional one.</p>
</section>
`;
}
