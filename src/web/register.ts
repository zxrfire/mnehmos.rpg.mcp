/**
 * The Standing Register: every faction in the world, on the one ladder.
 *
 * This is a VIEW, and the distinction matters more here than usual. Nothing in
 * this file authors anything - it reads the catalogs and arranges them, so
 * regenerating the sheet is a function call rather than an editing session, and
 * it cannot drift from what the engine actually believes. If a figure here looks
 * wrong, the catalog is wrong.
 *
 * Two consumers, one build:
 *
 *   GET /api/admin/register        the structure, as JSON, for tooling
 *   GET /api/admin/register.html   the same structure rendered, for reading
 *   npm run register               writes the rendered sheet to a file
 *
 * ADMIN ONLY, for the ordinary reason rather than a security one: the sheet
 * states plainly what the world spends enormous effort keeping unstated. It
 * names the two apexes a starting cultivator is `unaware` of, prints which
 * sealed ancestors are not publicly known, and lists a wanderer whose entire
 * design is that nobody knows he exists. Handing it to a player is handing them
 * the answer key.
 */

import {
    SECTS,
    SECT_ANCESTRY,
    WITHDRAWN_POWERS,
    getSect,
    sectThreat
} from '../data/cultivation/sects.js';
import {
    APEX_INSTITUTIONS,
    leaderTitleOf,
    leaderTitleOfCourt,
    secondTitleOf,
    COURTS,
    FACTION_PARENTAGE,
    getApexInstitution,
    getCourt
} from '../data/cultivation/hierarchy.js';
import { IMMORTAL_CHANNELS, LINEAGE_STANDINGS } from '../data/cultivation/crossings.js';
import { IMMORTAL_ITEMS, IMMORTAL_HOLDINGS } from '../data/cultivation/immortal-items.js';
import { WANDERERS } from '../data/cultivation/wanderers.js';
import { MEMBERS } from '../data/cultivation/members.js';
import { glossaryGroups } from './register-glossary.js';
import { REALM_TIERS, rankName, realmForOrdinal } from '../engine/cultivation/realms.js';

// ─────────────────────────────────────────────────────────────────────────
// SHAPE
// ─────────────────────────────────────────────────────────────────────────

export interface RegisterRow {
    id: string;
    name: string;
    /** Strongest ACTING member. Never the sealed ceiling. */
    ordinal: number;
    rank: string;
    realm: string;
    alignment: string;
    admissionOrdinal: number;
    recruits: boolean;
    governance: string;
    standing: string;
    parentId: string | null;
    /** Set only where something sealed raises what the faction could field once. */
    sealedCeiling: number | null;
    isDaoHouse: boolean;
}

export interface RegisterApex {
    id: string;
    name: string;
    ordinal: number;
    secondStrongestOrdinal: number;
    heritage: string;
    stock: string;
    startingAwareness: string;
    giftName: string;
    instability: string;
    courts: { id: string; name: string; ordinal: number }[];
}

export interface RegisterSealed {
    hostId: string;
    hostName: string;
    hostOrdinal: number;
    name: string;
    ordinal: number;
    sealGrade: string;
    sealReason: string;
    publiclyKnown: boolean;
    dormantYears: number;
    wakeCondition: string;
}

/**
 * One faction, and everybody attached to it.
 *
 * The register used to be a set of cross-cutting tables - all factions here,
 * all sealed ancestors there - which answers "who is strongest" well and
 * "what am I dealing with" badly. A person reading about the Frostmirror Court
 * had to find it in four places. This is the other arrangement: the sect is the
 * unit, and everything that belongs to it is underneath it.
 *
 * The four states a person can be in are kept separate because they are not
 * degrees of the same thing:
 *
 *   active     alive, in the sect, and can be met
 *   sealed     alive, cannot act without being spent
 *   ascended   through the Lid, and gone
 *   dead/lost  the line stops there
 */
export interface SectDossier {
    id: string;
    name: string;
    /** Strongest ACTING member, which is what orders this list. */
    ordinal: number;
    rank: string;
    alignment: string;
    admissionOrdinal: number;
    recruits: boolean;
    governance: string;
    standing: string;
    parentName: string | null;
    territory: string;
    /** What it could field once, at cost. Null where that is just its ordinal. */
    ceiling: number | null;
    apex: {
        giftName: string;
        heritage: string;
        stock: string;
        secondSeat: number;
        /** Who holds the seat and why they do not leave it. */
        seatNote: string;
        /** What could take the position away. Never the same answer twice. */
        instability: string;
    } | null;
    channel: {
        kind: string;
        crossings: number;
        tier: string | null;
        depletion: string | null;
    } | null;
    withdrawn: { count: number; occupiedBy: string } | null;
    holdings: { item: string; count: number; byGrade: { higher: number; middle: number; lower: number } }[];
    partingGift: { name: string; intact: boolean } | null;
    people: {
        active: { name: string; rank: string; ordinal: number; role: string; wants: string; detail: string }[];
        sealed: { name: string; ordinal: number; grade: string; reason: string; publiclyKnown: boolean; years: number; wakeCondition: string } | null;
        ascended: { name: string; ordinal: number | null; yearsAgo: number; rememberedFor: string }[];
        terminal: { name: string; fate: string; ordinal: number | null; yearsAgo: number; rememberedFor: string }[];
    };
}

/** The floor for the first tab. Grand Ascension begins here. */
export const HIGH_BAND_FLOOR = 37;

/**
 * One person at or above Grand Ascension.
 *
 * Assembled across every catalog at once, because nothing above thirty-six is
 * an ordinary member: the named-member catalog tops out well below it. What is
 * up there is lordships, sealed ancestors and the crossed, and most of them
 * have no name anybody outside their own walls has been given. `named: false` is a fact
 * about the world rather than a hole in the data.
 */
export interface HighPerson {
    name: string;
    named: boolean;
    ordinal: number;
    rank: string;
    /** acting | pinned | withdrawn | sealed | ascended | false immortal */
    state: string;
    /**
     * Whether they still exist anywhere.
     *
     * The axis is existence, not location, which is the correction that matters:
     * ascension is not an ending. Somebody who crossed is alive on the other
     * side of the Lid, can in principle come back down for the ten or fifteen
     * breaths that costs, and belongs in the living list. Somebody who crossed
     * and then died up there does not - the Immortal Realm has dangers and
     * politics of its own, and three thousand years is a long time to survive
     * them.
     *
     * Sealed also counts as alive: under a mountain and wakeable is a completely
     * different fact from gone.
     *
     * This is an operator's page, so it states which. Nobody below the Lid can
     * establish it, and every sect claiming its ancestor still answers is making
     * a claim it has no way to check.
     */
    alive: boolean;
    /**
     * Shown instead of the ordinal where the catalog holds a band rather than a
     * rung. `ordinal` still carries the band floor so the table can sort, and
     * printing that number on its own would assert something nobody recorded.
     */
    ordinalNote: string | null;
    factionName: string;
    factionOrdinal: number;
    note: string;
}

/**
 * Who reports to whom, resolved into a tree.
 *
 * Built by walking `FACTION_PARENTAGE` rather than by hand, so the diagram
 * cannot describe a chain the catalog does not hold. Sub-tenancies are real and
 * are drawn as such: one sect holds from another sect rather than from the
 * court, which no flat table shows.
 */
export interface StackNode {
    id: string;
    name: string;
    ordinal: number;
    standing: string;
    /**
     * The dossier this node opens, or null where there is nothing to open.
     *
     * Resolved here rather than in the renderer because the ids do not line up
     * on their own: an apex is filed under its apex id and its dossier under a
     * sect id, and a court has no dossier at all - it is an office, not a
     * faction, and the Factions tab is right not to list it. A card with no
     * destination is drawn as a card rather than as a link that goes nowhere.
     */
    linkId: string | null;
    children: StackNode[];
}

export interface WorldRegister {
    generatedAt: string;
    counts: {
        factions: number;
        apexes: number;
        courts: number;
        sealed: number;
        wanderers: number;
        immortalObjects: number;
    };
    ladder: { key: string; name: string; start: number; end: number }[];
    apexes: RegisterApex[];
    rows: RegisterRow[];
    sealed: RegisterSealed[];
    channels: {
        factionId: string;
        name: string;
        kind: string;
        crossings: number;
        tier: string | null;
        depletion: string | null;
        mostRecentCrossingYearsAgo: number | null;
    }[];
    /**
     * The two objects, and what each grade of them actually does.
     *
     * Grade is not dosage and the counts are not evenly spread: the higher
     * grade of each is a single object, and the lower grade is the one anybody
     * has actually seen. A holdings figure that does not say which grade is
     * being held is close to meaningless, which is why this sits beside them.
     */
    items: {
        id: string;
        name: string;
        form: string;
        effect: string;
        knownCount: number;
        /** How many were ever known, which is a larger and unhappier figure. */
        everKnown: number;
        knownByGrade: { higher: number; middle: number; lower: number };
        grades: { higher: string; middle: string; lower: string };
    }[];
    holdings: { factionId: string; name: string; itemId: string; count: number }[];
    wanderers: {
        id: string;
        recordName: string;
        commonName: string;
        lastOrdinal: number;
        outcome: string;
        crossingYearsAgo: number;
        affiliationId: string | null;
    }[];
    withdrawn: { factionId: string; name: string; count: number; occupiedBy: string }[];
    /** The reporting tree, one root per apex. */
    stack: StackNode[];
    /** Everybody at or above Grand Ascension, strongest first. */
    high: HighPerson[];
    /** Every faction with everything attached to it, strongest acting member first. */
    dossiers: SectDossier[];
    /**
     * Everybody at Grand Ascension, drawn from every kind of entity at once.
     *
     * This band is the top of the world anyone can actually meet, and it is the
     * one the faction table hides: courts are not factions, an apex second is
     * not an institution, and a sealed ancestor is not an acting member. Read
     * the catalogs one at a time and the band looks nearly empty. It is not.
     */
    grandAscension: {
        name: string;
        ordinal: number;
        kind: string;
        note: string;
    }[];
}

// ─────────────────────────────────────────────────────────────────────────
// BUILD
// ─────────────────────────────────────────────────────────────────────────

function nameOf(id: string): string {
    return getSect(id)?.name ?? getApexInstitution(id)?.name ?? getCourt(id)?.name ?? id;
}

/**
 * Every faction, as one tree.
 *
 * Roots are ordered by acting ordinal, so an apex heads the list because it is
 * strongest rather than because it is an apex. A faction that holds from nobody
 * is a root with no children, which is the honest drawing of it: independence
 * is not a separate category of thing, it is a branch that stops immediately.
 *
 * A court is a node rather than a label because a court is a real intermediary:
 * it issues the grant, it arbitrates, and losing it would not be the same event
 * as losing the apex. Sub-tenancies hang off the sect that granted them, which
 * is the shape the parentage table holds and the shape a flat register loses.
 */
function buildStack(dossierIds: ReadonlySet<string>): StackNode[] {
    /** An apex is filed under two ids; a court under none. */
    const linkFor = (id: string): string | null => {
        if (dossierIds.has(id)) return id;
        const apex = getApexInstitution(id);
        if (apex) {
            const match = [...dossierIds].find(
                d => nameOf(d).replace(/^The /, '') === apex.name.replace(/^The /, '')
            );
            return match ?? null;
        }
        return null;
    };

    const ordinalOf = (id: string): number =>
        getSect(id)?.powerOrdinal
        ?? getApexInstitution(id)?.powerOrdinal
        ?? getCourt(id)?.powerOrdinal
        ?? 0;

    const childrenOf = (parentId: string): StackNode[] =>
        Object.values(FACTION_PARENTAGE)
            .filter(p => p.parentFactionId === parentId)
            .map(p => ({
                id: p.factionId,
                name: nameOf(p.factionId),
                ordinal: ordinalOf(p.factionId),
                standing: p.standing,
                linkId: linkFor(p.factionId),
                children: childrenOf(p.factionId)
            }))
            .sort((a, b) => b.ordinal - a.ordinal);

    const claimed = new Set<string>();
    const roots: StackNode[] = APEX_INSTITUTIONS
        .map(apex => ({
            id: apex.id,
            name: apex.name,
            ordinal: apex.powerOrdinal,
            standing: 'not_applicable',
            linkId: linkFor(apex.id),
            children: [
                ...COURTS.filter(c => c.apexId === apex.id).map(c => ({
                    id: c.id,
                    name: c.name,
                    ordinal: c.powerOrdinal,
                    standing: 'not_applicable',
                    linkId: linkFor(c.id),
                    children: childrenOf(c.id)
                })),
                // Held direct, with no court in between. Rare, and worth seeing.
                // Both ids, because an apex that is also a sect is granted from
                // under its sect id and would otherwise lose its own tenants.
                ...childrenOf(apex.id),
                ...(linkFor(apex.id) && linkFor(apex.id) !== apex.id
                    ? childrenOf(linkFor(apex.id) as string)
                    : [])
            ].sort((a, b) => b.ordinal - a.ordinal)
        }));

    // Anything already drawn somewhere in the tree must not appear again at the
    // root, or the Pavilion would be listed twice: once as an apex and once as
    // a faction that holds from nobody, which are the same fact said twice.
    const walk = (n: StackNode): void => {
        claimed.add(n.id);
        if (n.linkId) claimed.add(n.linkId);
        n.children.forEach(walk);
    };
    roots.forEach(walk);

    for (const p of Object.values(FACTION_PARENTAGE)) {
        if (p.parentFactionId) continue;
        if (claimed.has(p.factionId)) continue;
        roots.push({
            id: p.factionId,
            name: nameOf(p.factionId),
            ordinal: ordinalOf(p.factionId),
            standing: p.standing,
            linkId: linkFor(p.factionId),
            children: []
        });
    }

    return roots.sort((a, b) => b.ordinal - a.ordinal || a.name.localeCompare(b.name));
}

/**
 * Everybody at or above Grand Ascension, from every catalog at once.
 *
 * A faction whose acting ordinal sits in the band contributes a seat rather
 * than a name, unless an apex records one. That is not a shortcut: the sect
 * catalog stores a number for its strongest member and no identity for them,
 * and the honest rendering of that is a row which says so.
 */
function buildHighBand(rows: RegisterRow[], sealedList: RegisterSealed[]): HighPerson[] {
    const out: HighPerson[] = [];

    for (const apex of APEX_INSTITUTIONS) {
        out.push({
            name: apex.lastRealm.holderName ?? leaderTitleOf(apex),
            named: apex.lastRealm.holderName !== null,
            ordinal: apex.powerOrdinal,
            rank: rankName(apex.powerOrdinal),
            state: 'pinned',
            alive: true,
            ordinalNote: null,
            factionName: apex.name,
            factionOrdinal: apex.powerOrdinal,
            note: apex.lastRealm.note
        });
        if (apex.secondStrongestOrdinal >= HIGH_BAND_FLOOR) {
            out.push({
                name: secondTitleOf(apex),
                named: false,
                ordinal: apex.secondStrongestOrdinal,
                rank: rankName(apex.secondStrongestOrdinal),
                state: 'acting',
                alive: true,
                ordinalNote: null,
                factionName: apex.name,
                factionOrdinal: apex.powerOrdinal,
                note: apex.depthNote
            });
        }
    }

    // A court is an office, but somebody holds it, and that person is in the
    // band. Listed as a seat rather than a name for the same reason as the rest:
    // the catalog stores a realm for the office and no identity for the holder.
    for (const court of COURTS) {
        const hwm = court.highWaterMark;
        if (hwm) {
            out.push({
                name: hwm.name,
                named: true,
                ordinal: hwm.ordinal,
                ordinalNote: null,
                rank: rankName(hwm.ordinal),
                state: hwm.end === 'attempted' ? 'failed the crossing' : 'declined the crossing',
                alive: false,
                factionName: court.name,
                factionOrdinal: court.powerOrdinal,
                note: hwm.yearsAgo.toLocaleString() + ' years ago. ' + hwm.note
            });
        }

        if (court.powerOrdinal < HIGH_BAND_FLOOR) continue;
        out.push({
            name: leaderTitleOfCourt(court),
            named: false,
            ordinal: court.powerOrdinal,
            rank: rankName(court.powerOrdinal),
            state: 'acting',
            alive: true,
            ordinalNote: null,
            factionName: court.name,
            factionOrdinal: court.powerOrdinal,
            note: 'Administers an arterial vein for '
                + (getApexInstitution(court.apexId)?.name ?? court.apexId)
                + ', and issues the grants every tenant beneath it holds on.'
        });
    }

    for (const row of rows) {
        const apexForRow = APEX_INSTITUTIONS.find(
            a => a.name.replace(/^The /, '') === row.name.replace(/^The /, '')
        );
        // Already emitted above from the apex catalog.
        if (apexForRow) continue;
        const withdrawn = WITHDRAWN_POWERS[row.id];

        if (row.ordinal >= HIGH_BAND_FLOOR) {
            if (withdrawn) {
                // Every seat, with the rung it actually stands on. Second and
                // Third share one, which is the age tiebreak visible in the
                // data: equal ordinals, younger seat first.
                for (const seat of withdrawn.seats) {
                    out.push({
                        name: seat.position,
                        named: false,
                        ordinal: seat.ordinal,
                        ordinalNote: null,
                        rank: rankName(seat.ordinal),
                        state: 'withdrawn',
                        alive: true,
                        factionName: row.name,
                        factionOrdinal: row.ordinal,
                        note: seat.position === 'Third Seat'
                            ? 'Holds the north mountain. ' + withdrawn.occupiedBy
                            : withdrawn.occupiedBy
                    });
                }
            } else {
                const top = MEMBERS
                    .filter(m => m.factionId === row.id && m.outlier)
                    .sort((a, b) => b.realmOrdinal - a.realmOrdinal)[0];
                out.push({
                    name: top?.name ?? 'strongest member',
                    named: top !== undefined,
                    ordinal: row.ordinal,
                    rank: row.rank,
                    state: 'acting',
                    alive: true,
                    ordinalNote: null,
                    factionName: row.name,
                    factionOrdinal: row.ordinal,
                    note: top
                        ? top.rank + '. ' + top.detail
                        : 'The catalog records the realm and not the person. Whoever holds it answers for the faction.'
                });
            }
        }

    }

    for (const sl of sealedList) {
        if (sl.ordinal < HIGH_BAND_FLOOR) continue;
        out.push({
            name: sl.name,
            named: true,
            ordinal: sl.ordinal,
            rank: rankName(sl.ordinal),
            state: 'sealed',
            alive: true,
            ordinalNote: null,
            factionName: sl.hostName,
            factionOrdinal: sl.hostOrdinal,
            note: sl.sealGrade + ' seal, sealed as a ' + sl.sealReason.replace(/_/g, ' ') + ', '
                + sl.dormantYears.toLocaleString() + ' years. '
                + (sl.publiclyKnown ? 'Known.' : 'Not publicly known.')
                + ' Wakes on: ' + sl.wakeCondition
        });
    }

    for (const [hostId, record] of Object.entries(SECT_ANCESTRY)) {
        for (const a of record.ancestors) {
            if (a.fate !== 'ascended') continue;
            if ((a.realmOrdinal ?? 0) < HIGH_BAND_FLOOR) continue;
            out.push({
                name: a.name,
                named: true,
                ordinal: a.realmOrdinal as number,
                rank: rankName(a.realmOrdinal as number),
                state: a.afterCrossing === 'died_above' ? 'died above' : 'ascended',
                alive: a.afterCrossing !== 'died_above',
                ordinalNote: null,
                factionName: nameOf(hostId),
                factionOrdinal: getSect(hostId)?.powerOrdinal ?? 0,
                note: a.yearsAgo.toLocaleString() + ' years ago. '
                    + (a.afterCrossing === 'died_above'
                        ? 'Crossed, and did not survive what was up there. '
                        : 'Crossed, and is still above. ')
                    + a.rememberedFor
            });
        }
    }

    // Every house that has produced a crossing, which is not the same as a
    // founder - most of these are people the house made rather than people who
    // made the house. The Court has produced
    // six. None of them are in SECT_ANCESTRY, because none of those bodies is a
    // sect, so the ascended half of this page was missing them entirely.
    //
    // Only the most recent is named. A house that produced six across four
    // thousand years does not remember six people - it remembers the last one
    // and a number - so the rest are carried as a count, which is what the
    // catalog actually holds.
    //
    // Whether they are still up there is derived rather than guessed: an
    // answering channel means somebody above the Lid is picking up. That is what
    // the channel IS. A body whose channel still answers has at least one
    // founder alive on the other side.
    for (const standing of LINEAGE_STANDINGS) {
        const alreadyNamed = (SECT_ANCESTRY[standing.factionId]?.ancestors ?? [])
            .filter(a => a.fate === 'ascended').length;
        const unnamed = standing.count - alreadyNamed;
        if (unnamed <= 0) continue;

        const channel = IMMORTAL_CHANNELS.find(c => c.factionId === standing.factionId);
        const answering = channel?.kind === 'answering_channel';
        const ordinal = REALM_TIERS[REALM_TIERS.length - 1].ordinalStart;

        out.push({
            name: standing.mostRecentCrossingName ?? `${unnamed} who crossed`,
            named: standing.mostRecentCrossingName !== null,
            ordinal,
            rank: rankName(ordinal),
            state: answering ? 'ascended' : 'ascended, unheard',
            alive: answering,
            ordinalNote: null,
            factionName: nameOf(standing.factionId),
            factionOrdinal: getSect(standing.factionId)?.powerOrdinal
                ?? getApexInstitution(standing.factionId)?.powerOrdinal
                ?? 0,
            note: `Crossed ${standing.mostRecentCrossingYearsAgo.toLocaleString()} years ago, the most recent this house has produced. `
                + (standing.mostRecentCrossingNote ? standing.mostRecentCrossingNote + ' ' : '')
                + (unnamed > 1
                    ? `${unnamed - 1} earlier crossing${unnamed === 2 ? '' : 's'} from this house, and the names have gone. `
                    : '')
                + (answering
                    ? 'The channel still answers, which is how the sheet knows somebody is up there: an answering channel is somebody picking up.'
                    : 'Nothing has answered in a long time, and the sheet does not claim to know why.')
        });
    }

    for (const w of WANDERERS) {
        if (w.lastOrdinal < HIGH_BAND_FLOOR) continue;
        out.push({
            name: w.recordName,
            named: true,
            ordinal: w.lastOrdinal,
            rank: rankName(w.lastOrdinal),
            state: w.crossingOutcome.replace(/_/g, ' '),
            alive: true,
            ordinalNote: null,
            factionName: w.affiliation ? nameOf(w.affiliation.factionId) : 'none',
            factionOrdinal: w.affiliation ? getSect(w.affiliation.factionId)?.powerOrdinal ?? 0 : 0,
            note: 'Called ' + w.commonName + '. Crossed ' + w.crossingYearsAgo.toLocaleString()
                + ' years ago and did not complete it.'
        });
    }

    return out.sort((a, b) =>
        Number(b.alive) - Number(a.alive)
        || b.ordinal - a.ordinal
        || a.factionName.localeCompare(b.factionName));
}

/**
 * Attach every person and object in the world to the faction that holds them.
 *
 * Sorted by acting ordinal because that is the order somebody reads a register
 * in: strongest first, and everything about that faction before the next one
 * starts. Factions with nobody named and nothing buried still get an entry - an
 * empty dossier is a fact about a sect, and omitting it would quietly make the
 * world look better staffed than it is.
 */
function buildDossiers(
    rows: RegisterRow[],
    sealed: RegisterSealed[],
    channels: WorldRegister['channels']
): SectDossier[] {
    const fromSects = rows.map(row => {
        const sect = getSect(row.id);
        const record = SECT_ANCESTRY[row.id];
        const ancestors = record?.ancestors ?? [];
        // Matched on the object rather than the name: the sect catalog and the
        // hierarchy catalog spell the Pavilion differently, and the thing that
        // actually ties an apex to a faction is what it is sitting on.
        const apex = APEX_INSTITUTIONS.find(
            a => a.sentDown.id === record?.partingGift?.id
                || a.name === row.name
                || a.name.replace(/^The /, '') === row.name.replace(/^The /, '')
        );
        const channel = channels.find(c => c.factionId === row.id) ?? null;
        const withdrawn = WITHDRAWN_POWERS[row.id] ?? null;
        const mine = sealed.find(x => x.hostId === row.id) ?? null;

        return {
            id: row.id,
            name: row.name,
            ordinal: row.ordinal,
            rank: row.rank,
            alignment: row.alignment,
            admissionOrdinal: row.admissionOrdinal,
            recruits: row.recruits,
            governance: row.governance,
            standing: row.standing,
            parentName: row.parentId ? nameOf(row.parentId) : null,
            territory: sect?.territory ?? '',
            ceiling: row.sealedCeiling,
            apex: apex
                ? {
                    giftName: apex.sentDown.name,
                    heritage: apex.heritage,
                    stock: apex.stock.remaining,
                    secondSeat: apex.secondStrongestOrdinal,
                    seatNote: apex.lastRealm.note,
                    instability: apex.instability
                }
                : null,
            channel: channel
                ? {
                    kind: channel.kind,
                    crossings: channel.crossings,
                    tier: channel.tier,
                    depletion: channel.depletion
                }
                : null,
            withdrawn: withdrawn
                ? { count: withdrawn.count, occupiedBy: withdrawn.occupiedBy }
                : null,
            holdings: IMMORTAL_HOLDINGS
                .filter(h => h.factionId === row.id)
                .map(h => ({
                    item: IMMORTAL_ITEMS.find(i => i.id === h.itemId)?.name ?? h.itemId,
                    count: h.count,
                    byGrade: { ...h.byGrade }
                })),
            partingGift: record?.partingGift
                ? { name: record.partingGift.name, intact: record.partingGift.intact }
                : null,
            people: {
                active: MEMBERS
                    .filter(m => m.factionId === row.id)
                    .sort((a, b) => b.realmOrdinal - a.realmOrdinal)
                    .map(m => ({
                        name: m.name,
                        rank: m.rank,
                        ordinal: m.realmOrdinal,
                        role: m.role,
                        wants: m.wants,
                        detail: m.detail
                    })),
                sealed: mine
                    ? {
                        name: mine.name,
                        ordinal: mine.ordinal,
                        grade: mine.sealGrade,
                        reason: mine.sealReason,
                        publiclyKnown: mine.publiclyKnown,
                        years: mine.dormantYears,
                        wakeCondition: mine.wakeCondition
                    }
                    : null,
                ascended: ancestors
                    .filter(a => a.fate === 'ascended')
                    .map(a => ({
                        name: a.name,
                        ordinal: a.realmOrdinal,
                        yearsAgo: a.yearsAgo,
                        rememberedFor: a.rememberedFor
                    })),
                terminal: ancestors
                    .filter(a => a.fate === 'dead' || a.fate === 'lost')
                    .map(a => ({
                        name: a.name,
                        fate: a.fate,
                        ordinal: a.realmOrdinal,
                        yearsAgo: a.yearsAgo,
                        rememberedFor: a.rememberedFor
                    }))
            }
        };
    });

    // The Deep Survey and the Long Cut hold no sect row because they are not
    // sects. Synthesising an entry for them is not padding: they are the first
    // and second factions on this list, and a register whose top two entries are
    // missing describes a different world.
    const covered = new Set(fromSects.map(d => d.name.replace(/^The /, '')));
    const apexOnly: SectDossier[] = APEX_INSTITUTIONS
        .filter(a => !covered.has(a.name.replace(/^The /, '')))
        .map(a => ({
            id: a.id,
            name: a.name,
            ordinal: a.powerOrdinal,
            rank: rankName(a.powerOrdinal),
            alignment: 'neutral',
            admissionOrdinal: 0,
            recruits: false,
            governance: 'apex',
            standing: 'not_applicable',
            parentName: null,
            territory: a.holds,
            ceiling: null,
            apex: {
                giftName: a.sentDown.name,
                heritage: a.heritage,
                stock: a.stock.remaining,
                secondSeat: a.secondStrongestOrdinal,
                seatNote: a.lastRealm.note,
                instability: a.instability
            },
            channel: (channels.find(c => c.factionId === a.id) ?? null) && {
                kind: channels.find(c => c.factionId === a.id)!.kind,
                crossings: channels.find(c => c.factionId === a.id)!.crossings,
                tier: channels.find(c => c.factionId === a.id)!.tier,
                depletion: channels.find(c => c.factionId === a.id)!.depletion
            },
            withdrawn: null,
            holdings: IMMORTAL_HOLDINGS
                .filter(h => h.factionId === a.id)
                .map(h => ({
                    item: IMMORTAL_ITEMS.find(i => i.id === h.itemId)?.name ?? h.itemId,
                    count: h.count,
                    byGrade: { ...h.byGrade }
                })),
            partingGift: null,
            people: {
                active: [
                    {
                        name: a.lastRealm.holderName ?? leaderTitleOf(a),
                        rank: rankName(a.powerOrdinal),
                        ordinal: a.powerOrdinal,
                        role: 'pinned',
                        wants: 'not to be required elsewhere',
                        detail: a.lastRealm.note
                    },
                    {
                        name: secondTitleOf(a),
                        rank: rankName(a.secondStrongestOrdinal),
                        ordinal: a.secondStrongestOrdinal,
                        role: 'senior',
                        wants: 'the position to hold without anybody testing what is behind it',
                        detail: a.depthNote
                    }
                ],
                sealed: null,
                ascended: [],
                terminal: []
            }
        }));

    return [...fromSects, ...apexOnly].sort((a, b) => b.ordinal - a.ordinal || a.name.localeCompare(b.name));
}

/**
 * Assemble the whole sheet from the catalogs.
 *
 * Pure apart from the timestamp: no database, no run, no player. The register
 * describes the world, not a game in progress, which is why it is safe to call
 * before a run exists and why two calls a second apart agree.
 */
export function buildRegister(): WorldRegister {
    const rows: RegisterRow[] = SECTS.map(sect => {
        const parentage = FACTION_PARENTAGE[sect.id];
        const threat = sectThreat(sect.id);
        return {
            id: sect.id,
            name: sect.name,
            ordinal: sect.powerOrdinal,
            rank: rankName(sect.powerOrdinal),
            realm: realmForOrdinal(sect.powerOrdinal).name,
            alignment: sect.alignment,
            admissionOrdinal: sect.admissionOrdinal,
            recruits: sect.recruits,
            governance: parentage?.governance ?? 'unrecorded',
            standing: parentage?.standing ?? 'not_applicable',
            parentId: parentage?.parentFactionId ?? null,
            // Only report a ceiling that is genuinely higher. Not everything
            // sealed raises one, and claiming otherwise would overstate a host
            // whose sealed ancestor is weaker than its own elders.
            sealedCeiling: threat && threat.ceiling > threat.acting ? threat.ceiling : null,
            isDaoHouse: sect.id.startsWith('house-')
        };
    }).sort((a, b) => b.ordinal - a.ordinal || a.name.localeCompare(b.name));

    const apexes: RegisterApex[] = APEX_INSTITUTIONS.map(a => ({
        id: a.id,
        name: a.name,
        ordinal: a.powerOrdinal,
        secondStrongestOrdinal: a.secondStrongestOrdinal,
        heritage: a.heritage,
        stock: a.stock.remaining,
        startingAwareness: a.startingAwareness,
        giftName: a.sentDown.name,
        instability: a.instability,
        courts: COURTS.filter(c => c.apexId === a.id)
            .map(c => ({ id: c.id, name: c.name, ordinal: c.powerOrdinal }))
    })).sort((x, y) => y.ordinal - x.ordinal);

    const sealed: RegisterSealed[] = Object.entries(SECT_ANCESTRY)
        .flatMap(([hostId, record]) => {
            const d = record.dormant;
            if (!d) return [];
            return [{
                hostId,
                hostName: nameOf(hostId),
                hostOrdinal: getSect(hostId)?.powerOrdinal ?? 0,
                name: d.name,
                ordinal: d.realmOrdinal,
                sealGrade: d.sealGrade,
                sealReason: d.sealReason,
                publiclyKnown: d.publiclyKnown,
                dormantYears: d.dormantYears,
                wakeCondition: d.wakeCondition
            }];
        })
        .sort((a, b) => b.ordinal - a.ordinal);

    const channels = IMMORTAL_CHANNELS.map(ch => {
        const standing = LINEAGE_STANDINGS.find(s => s.factionId === ch.factionId);
        return {
            factionId: ch.factionId,
            name: nameOf(ch.factionId),
            kind: ch.kind,
            crossings: standing?.count ?? 0,
            tier: standing?.tier ?? null,
            depletion: standing?.depletion ?? null,
            mostRecentCrossingYearsAgo: standing?.mostRecentCrossingYearsAgo ?? null
        };
    }).sort((a, b) => b.crossings - a.crossings);

    const dossiers = buildDossiers(rows, sealed, channels);

    return {
        generatedAt: new Date().toISOString(),
        counts: {
            factions: rows.length,
            apexes: apexes.length,
            courts: COURTS.length,
            sealed: sealed.length,
            wanderers: WANDERERS.length,
            immortalObjects: IMMORTAL_HOLDINGS.reduce((n, h) => n + h.count, 0)
        },
        ladder: REALM_TIERS.map(t => ({
            key: t.key, name: t.name, start: t.ordinalStart, end: t.ordinalEnd
        })),
        apexes,
        rows,
        sealed,
        channels,
        items: IMMORTAL_ITEMS.map(i => ({
            id: i.id,
            name: i.name,
            form: i.form,
            effect: i.effect,
            knownCount: i.knownCount,
            everKnown: i.everKnown,
            knownByGrade: { ...i.knownByGrade },
            grades: { higher: i.grades.higher, middle: i.grades.middle, lower: i.grades.lower }
        })),
        holdings: IMMORTAL_HOLDINGS.map(h => ({
            factionId: h.factionId, name: nameOf(h.factionId), itemId: h.itemId, count: h.count
        })),
        wanderers: WANDERERS.map(w => ({
            id: w.id,
            recordName: w.recordName,
            commonName: w.commonName,
            lastOrdinal: w.lastOrdinal,
            outcome: w.crossingOutcome,
            crossingYearsAgo: w.crossingYearsAgo,
            affiliationId: w.affiliation?.factionId ?? null
        })),
        withdrawn: Object.entries(WITHDRAWN_POWERS).map(([factionId, w]) => ({
            factionId, name: nameOf(factionId), count: w.count, occupiedBy: w.occupiedBy
        })),
        stack: buildStack(new Set(dossiers.map(d => d.id))),
        high: buildHighBand(rows, sealed),
        dossiers,
        grandAscension: [
            ...rows
                .filter(r => r.ordinal >= 37 && r.ordinal <= 40)
                .map(r => ({ name: r.name, ordinal: r.ordinal, kind: 'faction', note: 'strongest acting member' })),
            ...COURTS.map(c => ({
                name: c.name,
                ordinal: c.powerOrdinal,
                kind: 'court',
                note: 'administers an arterial vein for ' + (getApexInstitution(c.apexId)?.name ?? c.apexId)
            })).filter(c => c.ordinal >= 37 && c.ordinal <= 40),
            ...APEX_INSTITUTIONS.map(a => ({
                name: secondTitleOf(a),
                ordinal: a.secondStrongestOrdinal,
                kind: 'apex second',
                note: 'the strongest at ' + a.name + ' after the one who does not stand up'
            })).filter(a => a.ordinal >= 37 && a.ordinal <= 40),
            ...sealed
                .filter(x => x.ordinal >= 37 && x.ordinal <= 40)
                .map(x => ({
                    name: x.name,
                    ordinal: x.ordinal,
                    kind: 'sealed',
                    note: 'asleep under ' + x.hostName + ', ' + x.sealGrade + ' seal'
                }))
        ].sort((a, b) => b.ordinal - a.ordinal || a.name.localeCompare(b.name))
    };
}

// ─────────────────────────────────────────────────────────────────────────
// RENDER
//
// Self-contained: one document, inline styles, no fetches. It is served to an
// operator, saved to a file, and pasted into things, and every one of those
// stops working the moment it needs a stylesheet from somewhere.
// ─────────────────────────────────────────────────────────────────────────

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const STYLE = `
:root{--ground:#EDF0F1;--panel:#F7F9F9;--ink:#12181C;--quiet:#5C6E74;--faint:#8C9BA0;
--rule:#C4D0D3;--strong:#9AAAAF;--datum:#14545F;--datum-soft:#DCE8EA;--signal:#9E4A16;--signal-soft:#F0E0D3;}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--ground:#0C1113;--panel:#131A1D;
--ink:#DFE7E9;--quiet:#93A5AA;--faint:#64777D;--rule:#263337;--strong:#3A4C52;--datum:#6BB6C4;
--datum-soft:#173136;--signal:#D2884D;--signal-soft:#342315;}}
:root[data-theme="dark"]{--ground:#0C1113;--panel:#131A1D;--ink:#DFE7E9;--quiet:#93A5AA;--faint:#64777D;
--rule:#263337;--strong:#3A4C52;--datum:#6BB6C4;--datum-soft:#173136;--signal:#D2884D;--signal-soft:#342315;}
*{box-sizing:border-box}
body{background:var(--ground);color:var(--ink);margin:0;padding:0 clamp(14px,4vw,44px) 80px;
font:16px/1.6 Newsreader,Georgia,"Times New Roman",serif;-webkit-font-smoothing:antialiased}
.sheet{max-width:1080px;margin:0 auto}
.mast{padding:clamp(30px,6vw,64px) 0 24px;border-bottom:2px solid var(--ink)}
.mark{font:11px/1.6 "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;
color:var(--faint);display:flex;flex-wrap:wrap;gap:6px 20px;margin-bottom:18px}
h1{font:700 clamp(34px,7vw,68px)/.97 Archivo,"Helvetica Neue",Arial,sans-serif;letter-spacing:-.025em;
margin:0 0 12px;text-wrap:balance}
.stand{font-size:clamp(16px,2vw,20px);line-height:1.5;color:var(--quiet);max-width:60ch;margin:0;font-weight:300}
.stand em{color:var(--ink);font-style:italic}
section{padding-top:clamp(36px,5vw,60px)}
.sh{display:flex;align-items:baseline;gap:16px;border-bottom:1px solid var(--strong);padding-bottom:8px;margin-bottom:20px}
.sh h2{font:600 clamp(19px,2.4vw,26px)/1.2 Archivo,"Helvetica Neue",Arial,sans-serif;letter-spacing:-.012em;margin:0;flex:1}
.sh .r{font:11px/1.6 "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;
color:var(--faint);white-space:nowrap}
.note{max-width:68ch;color:var(--quiet);margin:0 0 20px}
.note strong{color:var(--ink);font-weight:500}
.chip{display:inline-block;font:500 10px/1.5 "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.1em;
text-transform:uppercase;padding:2px 7px;border:1px solid var(--strong);color:var(--quiet);white-space:nowrap}
.chip.pin{border-color:var(--datum);color:var(--datum);background:var(--datum-soft)}
.chip.wd{border-color:var(--datum);color:var(--datum)}
.chip.sl{border-style:dashed}
.chip.ex{border-color:var(--signal);color:var(--signal);background:var(--signal-soft)}
.scroll{overflow-x:auto;border:1px solid var(--rule);background:var(--panel);margin-bottom:14px}
table{border-collapse:collapse;width:100%;font-size:15px;min-width:600px}
caption{text-align:left;font:11px/1.6 "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.12em;
text-transform:uppercase;color:var(--faint);padding:10px 14px;border-bottom:1px solid var(--rule)}
th{text-align:left;font:600 10px/1.6 "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.1em;
text-transform:uppercase;color:var(--quiet);padding:9px 14px;border-bottom:1px solid var(--strong);white-space:nowrap}
td{padding:9px 14px;border-bottom:1px solid var(--rule);vertical-align:top}
tbody tr:last-child td{border-bottom:none}
td.n{font:500 15px "IBM Plex Mono",ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums;
color:var(--datum);white-space:nowrap}
td.nm{font:500 15px Archivo,"Helvetica Neue",Arial,sans-serif;white-space:nowrap}
td.q{color:var(--quiet);font-size:14.5px}
td.m{font:12.5px "IBM Plex Mono",ui-monospace,Menlo,monospace;color:var(--quiet);white-space:nowrap}
tr.brk td{border-top:2px solid var(--strong)}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;vertical-align:middle;margin-right:7px}
.dot.righteous{background:var(--datum)}.dot.neutral{background:var(--faint)}.dot.demonic{background:var(--signal)}
.cards{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(270px,1fr))}
.card{border:1px solid var(--rule);border-top:3px solid var(--datum);background:var(--panel);padding:18px;
display:flex;flex-direction:column;gap:10px}
.card.recent{border-top-color:var(--signal)}
.card h3{font:600 19px Archivo,"Helvetica Neue",Arial,sans-serif;margin:0;letter-spacing:-.01em}
.card .gift{font:600 14px Archivo,"Helvetica Neue",Arial,sans-serif;color:var(--ink)}
.card p{margin:0;font-size:14.5px;color:var(--quiet)}
.met{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--rule);border:1px solid var(--rule)}
.met div{background:var(--panel);padding:8px 10px}
.met dt{font:10px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;
color:var(--faint);margin:0 0 3px}
.met dd{margin:0;font:500 15px "IBM Plex Mono",ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums}
.prose{border-left:3px solid var(--datum);background:var(--datum-soft);padding:14px 18px;margin:0 0 14px;max-width:70ch;display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.prose p{margin:0;font-size:15.5px;line-height:1.62;color:var(--ink);font-style:italic}
.govgrp{margin-bottom:26px}
.bandhead{font:600 11px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--datum);margin:22px 0 8px;display:flex;gap:9px;align-items:baseline}
.bandhead span{color:var(--faint);font-weight:400}
.govhead{font:600 11px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;
color:var(--datum);margin:0 0 10px;padding-bottom:6px;border-bottom:1px solid var(--strong);display:flex;gap:9px;align-items:baseline}
.govhead span{color:var(--faint);font-weight:400;letter-spacing:.06em}
.govlist{display:flex;flex-direction:column;gap:8px}
.orgchart{border:1px solid var(--rule);background:var(--panel);padding:18px 20px;overflow-x:auto}
.orgchart ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
/* Children hang off a rail dropped from the card above them. */
.orgchart ul ul{margin:10px 0 0 26px;padding-left:24px;border-left:2px solid var(--rule)}
.orgchart li{position:relative}
.orgchart ul ul>li::before{content:"";position:absolute;left:-24px;top:24px;width:22px;height:2px;background:var(--rule)}
.ncard{background:var(--ground);border:1px solid var(--rule);border-left:3px solid var(--faint);max-width:none}
.ncard>summary{list-style:none;cursor:pointer;padding:11px 14px;display:grid;gap:3px}
.ncard>summary::-webkit-details-marker{display:none}
.ncard>summary:hover{background:var(--datum-soft)}
.ncard>summary:focus-visible{outline:2px solid var(--datum);outline-offset:-2px}
.ncard[open]{border-color:var(--datum);border-left-color:var(--datum)}
.ncard[open]>summary{border-bottom:1px solid var(--rule)}
.ncard--flat{padding:11px 14px;display:grid;gap:3px}
.nbody{padding:14px}
.nbody .dos{border:none;border-left:none;background:transparent;padding:0}
.ncard[open] .ngo::after{content:" (open)"}
.ncard:focus-visible{outline:2px solid var(--datum);outline-offset:2px}
.node.apex>.ncard{border-left-color:var(--datum);border-left-width:5px;background:var(--datum-soft)}
.node.court>.ncard{border-left-color:var(--datum)}
.nhead{display:flex;align-items:baseline;gap:10px}
.nname{font:600 16px Archivo,"Helvetica Neue",Arial,sans-serif;letter-spacing:-.01em}
.nord{font:500 14px "IBM Plex Mono",ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums;color:var(--datum)}
.nkind{font:10px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.11em;text-transform:uppercase;color:var(--faint);display:flex;align-items:center;gap:8px}
.ngo{font:11px "IBM Plex Mono",ui-monospace,Menlo,monospace;color:var(--datum);opacity:0;transition:opacity .12s}
.ncard:hover .ngo,.ncard:focus-visible .ngo{opacity:1}
.objblk{border:1px solid var(--rule);background:var(--panel);padding:16px 18px;margin-bottom:12px}
.objblk h3{font:600 18px Archivo,"Helvetica Neue",Arial,sans-serif;margin:0 0 12px;display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}
.objcount{margin:-6px 0 12px;font:12px "IBM Plex Mono",ui-monospace,Menlo,monospace;color:var(--datum);font-variant-numeric:tabular-nums}
.objmeta{font:11px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}
.grades{margin:0;display:grid;grid-template-columns:78px 1fr;gap:8px 16px}
.grades dt{font:600 10px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--datum);padding-top:3px}
.grades dd{margin:0;font-size:14.5px;line-height:1.55;color:var(--quiet)}
.jump{color:var(--datum);text-decoration:underline;text-underline-offset:2px;cursor:pointer}
.dos:target,.dos.flash{border-left-color:var(--datum);box-shadow:0 0 0 2px var(--datum-soft)}
.tabs{display:flex;gap:2px;margin-top:clamp(22px,3vw,32px);border-bottom:2px solid var(--ink)}
.tab{appearance:none;background:transparent;border:1px solid var(--rule);border-bottom:none;color:var(--quiet);
font:600 12px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.09em;text-transform:uppercase;
padding:10px 16px;cursor:pointer;display:flex;gap:8px;align-items:center}
.tab span{color:var(--faint);font-weight:400}
.tab[aria-selected="true"]{background:var(--ink);color:var(--ground);border-color:var(--ink)}
.tab[aria-selected="true"] span{color:var(--ground);opacity:.65}
.tab:focus-visible{outline:2px solid var(--datum);outline-offset:2px}
.dim{font:12px "IBM Plex Mono",ui-monospace,Menlo,monospace;color:var(--faint)}
.grp.weapons h4,.grp.weapons .wo{color:var(--signal)}
.grp.terminal h4{color:var(--faint)}
.legend{padding-top:clamp(28px,4vw,44px)}
.keys{display:grid;gap:1px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));background:var(--rule);border:1px solid var(--rule)}
.key{background:var(--panel);padding:14px 16px}
.key h4{font:600 10px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.13em;text-transform:uppercase;color:var(--datum);margin:0 0 9px}
.key dl{margin:0;display:flex;flex-direction:column;gap:7px}
.key dt{font:500 13.5px Archivo,"Helvetica Neue",Arial,sans-serif;color:var(--ink)}
.key dd{margin:1px 0 0;font-size:13.5px;line-height:1.5;color:var(--quiet)}
.stack{display:flex;flex-direction:column;gap:16px}
.dos{border:1px solid var(--rule);border-left:3px solid var(--faint);background:var(--panel);padding:16px 18px;display:flex;flex-direction:column;gap:12px}
.dos.apex{border-left-color:var(--datum)}
.dos header{display:flex;gap:16px;align-items:flex-start}
.dos .ord{font:500 30px "IBM Plex Mono",ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums;color:var(--datum);line-height:1;min-width:46px}
.dos h3{font:600 19px Archivo,"Helvetica Neue",Arial,sans-serif;margin:0 0 3px;letter-spacing:-.01em;display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.dos .terr b{color:var(--ink);font-weight:600}
.dos .terr{margin:0;font-size:14.5px;color:var(--quiet);max-width:70ch}
.meta{display:flex;flex-wrap:wrap;gap:4px 20px;font:12px "IBM Plex Mono",ui-monospace,Menlo,monospace;color:var(--quiet);border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:8px 0}
.meta b{font-weight:500;color:var(--faint);text-transform:uppercase;letter-spacing:.08em;font-size:10px;margin-right:5px}
.grps{display:flex;flex-direction:column;gap:12px}
.grp h4{font:600 10px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);margin:0 0 6px;display:flex;gap:8px;align-items:center}
.grp h4 span{color:var(--datum)}
.grp h4 .gap{color:var(--faint);font-weight:400;letter-spacing:.04em;text-transform:none}
.grp.sealed h4,.grp.sealed .wo{color:var(--signal)}
.grp.ascended .wo{color:var(--datum)}
.who{display:grid;grid-template-columns:minmax(140px,auto) 34px minmax(120px,auto) 1fr;gap:4px 14px;padding:5px 0;border-top:1px solid var(--rule);align-items:baseline}
.who:first-of-type{border-top:none}
.wn{font:500 15px Archivo,"Helvetica Neue",Arial,sans-serif}
.wo{font:500 14px "IBM Plex Mono",ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums;color:var(--quiet);text-align:right}
.wr{font:11.5px "IBM Plex Mono",ui-monospace,Menlo,monospace;color:var(--faint)}
.wd{font-size:14px;color:var(--quiet)}
.none{margin:0;font-size:14px;color:var(--faint);font-style:italic}
@media (max-width:720px){.who{grid-template-columns:1fr 34px;gap:2px 10px}.wr,.wd{grid-column:1 / -1}}
foot,footer{margin-top:clamp(48px,7vw,80px);border-top:2px solid var(--ink);padding-top:16px;
font:11px "IBM Plex Mono",ui-monospace,Menlo,monospace;letter-spacing:.06em;color:var(--faint);
display:flex;flex-wrap:wrap;gap:8px 26px}
`;


/**
 * Render one curated paragraph, where there is one.
 *
 * Visually distinct from everything around it on purpose. The tables are the
 * catalog and this is a model talking about the catalog, and a reader must
 * never have to guess which they are looking at. A stale block keeps its text
 * and says so rather than vanishing - a dated paragraph that admits it is dated
 * is worth more than a hole.
 */
function prose(blocks: Record<string, { text: string; stale?: boolean }> | undefined, id: string): string {
    const block = blocks?.[id];
    if (!block || !block.text) return '';
    const flag = block.stale
        ? '<span class="chip ex">behind the catalog</span>'
        : '';
    return `<aside class="prose">${flag}<p>${esc(block.text)}</p></aside>`;
}

/** A row of small labelled facts under a dossier heading. */
function metaRow(pairs: [string, string][]): string {
    return `<div class="meta">${pairs
        .filter(([, v]) => v !== '' && v !== null && v !== undefined)
        .map(([k, v]) => `<span><b>${esc(k)}</b> ${esc(v)}</span>`)
        .join('')}</div>`;
}

/**
 * One faction and everyone attached to it.
 *
 * The four people-groups are rendered as separate labelled lists rather than
 * one table with a status column, because they are not comparable: an active
 * member is somebody you can meet, a sealed one is an event waiting for a
 * trigger, and the other two are history. A single sortable table would invite
 * exactly the comparison the register exists to prevent.
 */
function dossier(d: SectDossier): string {
    const groups: string[] = [];

    if (d.people.active.length) {
        groups.push(`<div class="grp healthy"><h4>Members <span>${d.people.active.length}</span></h4>`
            + d.people.active.map(p =>
                `<div class="who"><span class="wn">${esc(p.name)}</span>`
                + `<span class="wo">${p.ordinal}</span>`
                + `<span class="wr">${esc(p.rank)} · ${esc(p.role)}</span>`
                + `<span class="wd">wants ${esc(p.wants)}</span></div>`).join('')
            + '</div>');
    }

    if (d.people.sealed) {
        const sl = d.people.sealed;
        const kind = sl.reason === 'protector' ? 'Protector' : 'Final breath';
        groups.push(`<div class="grp sealed"><h4>Sealed ancestors &middot; ${kind} <span>1</span></h4>`
            + `<div class="who"><span class="wn">${esc(sl.name)}</span>`
            + `<span class="wo">${sl.ordinal}</span>`
            + `<span class="wr">${esc(sl.grade)} seal · ${sl.years.toLocaleString()} yr · ${sl.publiclyKnown ? 'known' : 'hidden'}</span>`
            + `<span class="wd">${esc(sl.wakeCondition)}</span></div></div>`);
    }

    if (d.people.ascended.length) {
        groups.push(`<div class="grp ascended"><h4>Ascended <span>${d.people.ascended.length}</span></h4>`
            + d.people.ascended.map(p =>
                `<div class="who"><span class="wn">${esc(p.name)}</span>`
                + `<span class="wo">${p.ordinal ?? '-'}</span>`
                + `<span class="wr">${p.yearsAgo.toLocaleString()} yr ago</span>`
                + `<span class="wd">${esc(p.rememberedFor)}</span></div>`).join('')
            + '</div>');
    }

    if (d.people.terminal.length) {
        groups.push(`<div class="grp terminal"><h4>Dead and lost <span>${d.people.terminal.length}</span></h4>`
            + d.people.terminal.map(p =>
                `<div class="who"><span class="wn">${esc(p.name)}</span>`
                + `<span class="wo">${p.ordinal ?? '-'}</span>`
                + `<span class="wr">${esc(p.fate)} · ${p.yearsAgo.toLocaleString()} yr ago</span>`
                + `<span class="wd">${esc(p.rememberedFor)}</span></div>`).join('')
            + '</div>');
    }



    // Weapons are a group rather than a meta field: an object that came down
    // through the Lid is closer to a member of the faction than to a statistic
    // about it, and the sheet should not bury it in a strip of small print.
    const weapons: string[] = [];
    if (d.apex) weapons.push(`<div class="who"><span class="wn">${esc(d.apex.giftName)}</span><span class="wo">-</span><span class="wr">sent down</span><span class="wd">Permanent, unreproducible, and the reason this faction is an apex.</span></div>`);
    if (d.partingGift) weapons.push(`<div class="who"><span class="wn">${esc(d.partingGift.name)}</span><span class="wo">-</span><span class="wr">parting gift${d.partingGift.intact ? '' : ' · spent'}</span><span class="wd">Left on the way out by somebody who crossed.</span></div>`);
    for (const h of d.holdings) {
        const mix = (['higher', 'middle', 'lower'] as const)
            .filter(g => h.byGrade[g] > 0)
            .map(g => `${h.byGrade[g]} ${g}`)
            .join(', ');
        weapons.push(`<div class="who"><span class="wn">${esc(h.item)}</span><span class="wo">${h.count}</span><span class="wr">${esc(mix)}</span><span class="wd">Came down. Cannot be made or reordered here; every use is permanent.</span></div>`);
    }
    if (weapons.length) {
        groups.unshift(`<div class="grp weapons"><h4>Immortal weapons <span>${weapons.length}</span></h4>${weapons.join('')}</div>`);
    }

    if (!groups.length) {
        groups.push('<div class="grp"><p class="none">Nobody recorded and nothing held. The faction exists; the register has no names for it.</p></div>');
    }

    return `<article class="dos${d.apex ? ' apex' : ''}">
  <header>
    <span class="ord">${d.ordinal}</span>
    <div>
      <h3><span class="dot ${esc(d.alignment)}"></span>${esc(d.name)}
        ${d.apex ? '<span class="chip pin">apex</span>' : ''}
        ${d.withdrawn ? `<span class="chip wd">withdrawn x${d.withdrawn.count}</span>` : ''}
        ${d.ceiling ? `<span class="chip sl">ceiling ${d.ceiling}</span>` : ''}
      </h3>
      <p class="terr">${esc(d.territory)}</p>
    </div>
  </header>
  ${metaRow([
      ['rank', d.rank],
      ['gate', d.recruits ? String(d.admissionOrdinal) : 'closed'],
      ['governance', d.governance],
      ['standing', d.standing === 'not_applicable' ? '' : d.standing],
      ['holds from', d.parentName ?? 'nobody'],
      ['gift', d.partingGift ? d.partingGift.name + (d.partingGift.intact ? '' : ' (spent)') : ''],
      ['sent down', d.apex?.giftName ?? ''],
      ['heritage', d.apex?.heritage ?? ''],
      ['stock', d.apex ? d.apex.stock.replace(/_/g, ' ') : ''],
      ['second', d.apex ? String(d.apex.secondSeat) : ''],
      ['channel', d.channel ? `${d.channel.kind.replace(/_/g, ' ')} · ${d.channel.crossings} crossing${d.channel.crossings === 1 ? '' : 's'} · ${d.channel.depletion ?? '-'}` : '']
  ])}
  ${d.withdrawn ? `<p class="terr">${esc(d.withdrawn.occupiedBy)}</p>` : ''}
  ${d.apex ? `<p class="terr"><b>The lordship.</b> ${esc(d.apex.seatNote)}</p>
  <p class="terr"><b>What could end it.</b> ${esc(d.apex.instability)}</p>` : ''}
  <div class="grps">${groups.join('')}</div>
</article>`;
}

/**
 * One faction: a card that opens its full entry in place.
 *
 * `<details>` rather than a scripted panel. It is keyboard-operable, it works
 * with the page's own find, and a reader who opens six keeps all six open -
 * which is what an operator comparing factions actually does, and what a
 * jump-to-anchor would have taken away.
 *
 * The card head carries who it holds from, so grouping by governance does not
 * cost the reporting relation: the group says what kind of arrangement it is,
 * and the line says who the other party is.
 */
function factionCard(d: SectDossier): string {
    const flag = d.standing === 'strained' || d.standing === 'probationary'
        ? ` <span class="chip ex">${esc(d.standing)}</span>`
        : '';
    const from = d.parentName
        ? `holds from ${esc(d.parentName)}`
        : 'holds from nobody';

    return `<details class="ncard" id="faction-${esc(d.id)}">
      <summary>
        <span class="nhead"><span class="nname"><span class="dot ${esc(d.alignment)}"></span>${esc(d.name)}</span><span class="nord">${d.ordinal}</span></span>
        <span class="nkind">${from}${flag}${d.apex ? ' <span class="chip pin">apex</span>' : ''}${d.ceiling ? ` <span class="chip sl">ceiling ${d.ceiling}</span>` : ''}</span>
      </summary>
      <div class="nbody">${dossier(d)}</div>
    </details>`;
}

/**
 * One node of an apex hierarchy.
 *
 * Only drawn where there is something to draw. A root with no children is not a
 * one-node tree, it is a card, and rendering it with rails and an indent would
 * dress up independence as a structure it does not have.
 *
 * A court gets a flat card: it is an office rather than a faction, so there is
 * no entry behind it and a disclosure control would open onto nothing.
 */
function treeNode(node: StackNode, byId: ReadonlyMap<string, SectDossier>): string {
    const entry = node.linkId ? byId.get(node.linkId) : undefined;
    const kind = getApexInstitution(node.id) ? 'apex' : getCourt(node.id) ? 'court' : 'faction';

    const card = entry
        ? factionCard(entry)
        : `<div class="ncard ncard--flat">
        <span class="nhead"><span class="nname">${esc(node.name)}</span><span class="nord">${node.ordinal || ''}</span></span>
        <span class="nkind">${kind} &middot; no separate entry</span>
      </div>`;

    return `<li class="node ${kind}">${card}`
        + (node.children.length
            ? `<ul>${node.children.map(c => treeNode(c, byId)).join('')}</ul>`
            : '')
        + '</li>';
}

/**
 * Governance groups, strongest group first, strongest faction first inside.
 *
 * Ordered by the strongest member of each group rather than by a fixed list, so
 * the ordering says something true about the world instead of encoding an
 * opinion about which arrangement matters most.
 */
function byGovernance(
    dossiers: SectDossier[],
    inTree: ReadonlySet<string>
): { governance: string; members: SectDossier[] }[] {
    const groups = new Map<string, SectDossier[]>();
    for (const d of dossiers) {
        if (inTree.has(d.id)) continue;
        if (!groups.has(d.governance)) groups.set(d.governance, []);
        groups.get(d.governance)!.push(d);
    }
    return [...groups.entries()]
        .map(([governance, members]) => ({
            governance,
            members: members.slice().sort((a, b) => b.ordinal - a.ordinal || a.name.localeCompare(b.name))
        }))
        .sort((a, b) => b.members[0].ordinal - a.members[0].ordinal);
}

/** The whole sheet as one self-contained document. */
export function renderRegisterHtml(
    reg: WorldRegister,
    blocks?: Record<string, { text: string; stale?: boolean }>
): string {
    const c = reg.counts;
    const dossierById = new Map(reg.dossiers.map(d => [d.id, d]));
    // A root with children is a hierarchy worth drawing. A root without is a
    // faction that holds from nobody, and belongs with its governance group.
    const hierarchies = reg.stack.filter(n => n.children.length > 0);
    const inTree = new Set<string>();
    const claim = (n: typeof reg.stack[number]): void => {
        if (n.linkId) inTree.add(n.linkId);
        inTree.add(n.id);
        n.children.forEach(claim);
    };
    hierarchies.forEach(claim);
    const stamp = reg.generatedAt.replace('T', ' ').slice(0, 16) + ' UTC';



    return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Standing Register</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,500&display=swap">
<style>${STYLE}</style></head><body><div class="sheet">

<header class="mast">
  <div class="mark">
    <span>Standing Register</span>
    <span>${c.factions} factions · ${c.apexes} apexes · ${c.courts} courts</span>
    <span>${c.sealed} sealed · ${c.wanderers} wanderer${c.wanderers === 1 ? '' : 's'}</span>
    <span>${c.immortalObjects} immortal objects</span>
    <span>${esc(stamp)}</span>
  </div>
  <h1>The Standing Register</h1>
  <p class="stand">Every faction in the world, placed on the one ladder. Ordinal is the realm of the strongest <em>acting</em> member - the person who answers a challenge, walks a border, sits at a negotiation. It is not what a faction could field once, at cost, and that distinction is the whole of the register.</p>
</header>

<nav class="tabs" role="tablist">
  <button class="tab" role="tab" data-tab="people" aria-selected="true">People &ge; Grand Ascension <span>${reg.high.length}</span></button>
  <button class="tab" role="tab" data-tab="factions" aria-selected="false">Factions <span>${c.factions}</span></button>
  <button class="tab" role="tab" data-tab="key" aria-selected="false">Key</button>
</nav>

<div class="pane" data-pane="people">
<section>
  <div class="sh"><h2>People at or above Grand Ascension</h2><span class="r">Ordinal 37+ · strongest first</span></div>
  <p class="note">Everyone in the band, from every catalog at once, with the faction they belong to. The named-member catalog stops well below this, so most of what is up here is lordships, sealed ancestors and the crossed - and a row marked <em>unnamed</em> is a fact about the world rather than a gap in the data. Lesser people are listed under their faction in the next tab.</p>
  ${[
      { label: 'Alive', hint: 'Still exists somewhere. Sealed counts - under a mountain is not gone - and so does ascended: somebody above the Lid is alive, and can come back down for the ten or fifteen breaths that costs.', alive: true },
      { label: 'Deceased', hint: 'Gone. Includes the ascended who did not survive what was up there, because tribulation and old age stop being able to kill you and nothing else does.', alive: false }
  ].map(band => {
      const rows = reg.high.filter(p => p.alive === band.alive);
      if (!rows.length) return '';
      return `<h3 class="bandhead">${band.label} <span>${rows.length}</span></h3>
  <p class="note">${band.hint}</p>
  <div class="scroll"><table>
  <thead><tr><th>Ord</th><th>Who</th><th>State</th><th>Faction</th><th>Detail</th></tr></thead><tbody>
  ${rows.map(p => `<tr><td class="n">${esc(p.ordinalNote ?? String(p.ordinal))}</td>`
        + `<td class="nm">${esc(p.name)}${p.named ? '' : ' <span class="chip">unnamed</span>'}</td>`
        + `<td class="m">${esc(p.state)}</td>`
        + `<td class="q">${esc(p.factionName)} <span class="dim">${p.factionOrdinal || ''}</span></td>`
        + `<td class="q">${esc(p.note)}</td></tr>`).join('')}
  </tbody></table></div>`;
  }).join('')}
</section>
</div>

<div class="pane" data-pane="factions" hidden>
<section>
  <div class="sh"><h2>Every faction</h2><span class="r">${c.factions} · by governance · click to open</span></div>
  <p class="note">Grouped by how each faction holds its ground, strongest group first and strongest faction first inside it. The group says what kind of arrangement it is; the line under each name says who the other party is, so the reporting relation survives the grouping. The people under each faction are weighted to the bottom of the ladder, because that is where the player starts and where almost everybody is - and each list now ends on the strongest member, who is the person the faction ordinal has always been naming. <strong>Click any faction to open its full entry.</strong></p>
  ${prose(blocks, 'register')}
  ${hierarchies.length ? `<div class="govgrp">
    <h3 class="govhead">apex hierarchies <span>${hierarchies.length}</span></h3>
    <div class="orgchart"><ul>${hierarchies.map(n => treeNode(n, dossierById)).join('')}</ul></div>
    ${prose(blocks, 'apexes')}
  </div>` : ''}
  ${byGovernance(reg.dossiers, inTree).map(g => `<div class="govgrp">
    <h3 class="govhead">${esc(g.governance)} <span>${g.members.length}</span></h3>
    <div class="govlist">${g.members.map(factionCard).join('')}</div>
  </div>`).join('')}
</section>


</div>

<section>
  <div class="sh"><h2>The immortal objects</h2><span class="r">Two kinds, three grades each</span></div>
  <p class="note">Holdings are listed under each faction; this is what a holding is <em>worth</em>. <strong>Grade caps the destination, not the distance.</strong> Every grade performs the same single crossing - Perfection of one realm to Early of the next - and what a higher grade buys is permission to perform it further up the ladder. Lower reaches ordinal 25, middle 29, higher 37, <strong>and nothing reaches 41</strong>: the last realm is walked to or it is not reached.</p>
  ${reg.items.map(i => `<div class="objblk">
    <h3>${esc(i.name)} <span class="objmeta">${esc(i.form.replace(/_/g, ' '))} · ${esc(i.effect.replace(/_/g, ' '))} · ${i.knownCount} of ${i.everKnown} ever known</span></h3>
    <p class="objcount">higher ${i.knownByGrade.higher} · middle ${i.knownByGrade.middle} · lower ${i.knownByGrade.lower}</p>
    <dl class="grades">
      <dt>Higher</dt><dd>${esc(i.grades.higher)}</dd>
      <dt>Middle</dt><dd>${esc(i.grades.middle)}</dd>
      <dt>Lower</dt><dd>${esc(i.grades.lower)}</dd>
    </dl>
  </div>`).join('')}
  ${prose(blocks, 'items')}
</section>

<div class="pane" data-pane="key" hidden>
<section class="legend">
  <div class="sh"><h2>How to read this</h2><span class="r">Column meanings</span></div>
  <div class="keys">${glossaryGroups().map(g => `<div class="key">
    <h4>${esc(g.group)}</h4>
    <dl>${g.entries.map(e => `<dt>${esc(e.term)}</dt><dd>${esc(e.meaning)}</dd>`).join('')}</dl>
  </div>`).join('')}</div>
</section>
</div>

<footer>
  <span>Ordinal = strongest acting member</span>
  <span>Ceiling is not availability</span>
  <span>Generated from the catalogs</span>
  <span>${esc(stamp)}</span>
</footer>

</div>
<script>
// Tabs, and nothing else. Three panes, one visible, state in the DOM - an
// admin panel that needed a framework to switch a tab would be the wrong
// trade for a page served straight out of the engine.
function showPane(want) {
  document.querySelectorAll('.tab').forEach(function (t) {
    t.setAttribute('aria-selected', String(t.dataset.tab === want));
  });
  document.querySelectorAll('.pane').forEach(function (p) {
    p.hidden = p.dataset.pane !== want;
  });
}

// An org chart that ends at a name loses the detail. Every node and every
// cross-reference opens the full entry: switch to the Factions tab, scroll it
// into view, and flash the border so it is obvious which one was meant.
document.addEventListener('click', function (e) {
  var target = e.target.closest('[data-goto]');
  if (!target) return;
  var id = target.dataset.goto;
  showPane('factions');
  var el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block: 'start' });
  el.classList.add('flash');
  setTimeout(function () { el.classList.remove('flash'); }, 1400);
});

document.querySelectorAll('.tab').forEach(function (tab) {
  tab.addEventListener('click', function () {
    showPane(tab.dataset.tab);
    window.scrollTo({ top: 0 });
  });
});
</script>
</body></html>`;
}

/** One call: read the catalogs, return the sheet. */
export function renderRegister(): string {
    return renderRegisterHtml(buildRegister());
}
