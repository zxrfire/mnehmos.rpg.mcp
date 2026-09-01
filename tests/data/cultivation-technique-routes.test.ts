/**
 * Every art has a route, or says why it has none.
 *
 * `scripts/audit-lore.ts` found fifteen arts in `techniques.ts` that no sect
 * taught, no trial awarded, no grave held, no carving had yielded and no
 * parting gift carried. They were not deliberately unobtainable; they were
 * unreferenced, which reads identically from inside the data and is the whole
 * reason this suite exists. The audit is a script and its findings are
 * judgement calls. This one is not a judgement call, so it is a test.
 *
 * The contract, in one sentence: for every entry in the technique catalog,
 * either something in the world can put a copy in somebody's hands, or the
 * catalog states in `NO_SURVIVING_COPY_TECHNIQUE_IDS` that nothing can and
 * gives the reason. Silence is a failure.
 *
 * The routes are enumerated here rather than derived, because the point is
 * that the list of ways an art reaches a person is short, closed and legible.
 * A new route is a deliberate act and should have to be added here.
 */

import { describe, it, expect } from 'vitest';

import {
    FALSE_IMMORTAL_ORDINAL,
    MANUALS_MAY_EXCEED_THE_LID,
    OBJECT_CEILING_BELOW_THE_LID,
    isExpelledFromBelow
} from '../../src/engine/cultivation/realms.js';
import {
    CONTENT_MAX_ORDINAL,
    TECHNIQUES,
    NO_SURVIVING_COPY_TECHNIQUE_IDS,
    NO_SURVIVING_COPY_NOTES,
    RUIN_ONLY_TECHNIQUE_IDS,
    GRAVE_ONLY_TECHNIQUE_IDS,
    getTechnique,
    isWideSpan,
    getTechniquesWithNoSurvivingCopy
} from '../../src/data/cultivation/techniques.js';
import { SECTS, SECT_ANCESTRY } from '../../src/data/cultivation/sects.js';
import { THE_DEEPEST_ROADS } from '../../src/data/cultivation/roads-to-the-top-of-the-ladder.js';
import { INHERITANCE_TRIALS, GRAVES } from '../../src/data/cultivation/inheritance-trials.js';
import { allDaoCarvings } from '../../src/data/cultivation/false-immortals.js';

// ─────────────────────────────────────────────────────────────────────────
// THE ROUTES
// Five, and they are different in kind rather than five difficulties of one
// thing: a teacher, a door, a body, a face somebody cut, and an estate
// somebody put down on the way out of the world.
// ─────────────────────────────────────────────────────────────────────────

type RouteKind = 'taught' | 'trial' | 'grave' | 'carving' | 'parting_gift' | 'apex_road';

interface Route {
    kind: RouteKind;
    /** The catalog entry that actually hands it over. */
    where: string;
}

function routesTo(techniqueId: string): Route[] {
    const out: Route[] = [];
    for (const s of SECTS) {
        if (s.teaches.includes(techniqueId)) out.push({ kind: 'taught', where: s.id });
    }
    // The four roads to the top of the ladder, which two of the four holders
    // cannot express as a teach list because they have no sect row at all.
    // Without this the Deep Survey's and the Long Cut's roads read as arts
    // nothing in the world can hand to anybody, which is the opposite of what
    // is true about them: each is held by one of the four bodies with somebody
    // standing in the band the book is written for, and lent, on terms, to
    // people that body has already decided about.
    for (const road of THE_DEEPEST_ROADS) {
        if (road.techniqueId === techniqueId) out.push({ kind: 'apex_road', where: road.factionId });
    }
    for (const t of INHERITANCE_TRIALS) {
        if (t.interior.prize.techniqueIds.includes(techniqueId)) {
            out.push({ kind: 'trial', where: t.id });
        }
    }
    for (const g of GRAVES) {
        if (g.interior.contents.some(c => c.techniqueId === techniqueId)) {
            out.push({ kind: 'grave', where: g.id });
        }
    }
    // Every face anybody over the Lid has cut, which is not the same list as
    // the seven records: three of them were cut by the one who is still alive
    // and does not belong in a catalog of endings. Same route, same field.
    for (const carving of allDaoCarvings()) {
        if (carving.yieldedTechniqueIds.includes(techniqueId)) {
            out.push({ kind: 'carving', where: carving.id });
        }
    }
    for (const [sectId, records] of Object.entries(SECT_ANCESTRY)) {
        if (records.partingGift?.techniqueIds.includes(techniqueId)) {
            out.push({ kind: 'parting_gift', where: sectId });
        }
    }
    return out;
}

/** The fifteen the audit found, with the route each one was actually given. */
const THE_FIFTEEN: Readonly<Record<string, RouteKind>> = {
    'bramble-crown-spear': 'taught',
    'bloodwarm-battle-chant': 'taught',
    'abyssal-gate-torrent': 'trial',
    'dragonbone-severing-decree': 'trial',
    'calamity-word-of-the-open-sky': 'trial',
    'chaos-origin-scripture': 'grave',
    'debt-collection-in-arrears': 'grave',
    'heart-of-the-ten-thousand-corpses': 'grave',
    'lifespan-devouring-heaven-theft': 'grave',
    'immovable-heaven-pillar': 'carving',
    'heaven-conversing-primordial-canon': 'parting_gift',
    'undying-kalpa-body': 'parting_gift',
    'one-thought-ten-thousand-li': 'parting_gift',
    'rebirth-in-the-lotus-furnace': 'parting_gift',
    // The one that is genuinely unobtainable, and says so.
    'word-of-continuance': 'taught'
} as const;

// ─────────────────────────────────────────────────────────────────────────
describe('every art is reachable, or is declared unreachable', () => {
    it('gives every technique in the catalog at least one route', () => {
        const stranded: string[] = [];
        for (const t of TECHNIQUES) {
            if (!t.survivingCopy) continue;
            if (routesTo(t.id).length === 0) stranded.push(`${t.id} (${t.grade})`);
        }
        expect(stranded, 'arts nothing in the world can hand to anybody').toEqual([]);
    });

    it('declares the arts nothing can hand over, rather than leaving them silent', () => {
        for (const id of NO_SURVIVING_COPY_TECHNIQUE_IDS) {
            const entry = getTechnique(id);
            expect(entry, `no such technique ${id}`).toBeDefined();
            expect(entry!.survivingCopy, `${id} is marked and does not read as marked`).toBe(false);
            // A marker with no reason attached is the same silence somewhere else.
            const note = NO_SURVIVING_COPY_NOTES[id];
            expect(note, `${id} is unobtainable and does not say why`).toBeDefined();
            expect(note.length, `${id} reason is too thin to be a reason`).toBeGreaterThan(150);
            expect(entry!.sourceNote).toBe(note);
        }
        // And the note table never names anything that is not marked.
        for (const id of Object.keys(NO_SURVIVING_COPY_NOTES)) {
            expect(NO_SURVIVING_COPY_TECHNIQUE_IDS.has(id), `${id} has a reason and no marker`).toBe(true);
        }
        expect(getTechniquesWithNoSurvivingCopy().map(t => t.id).sort())
            .toEqual([...NO_SURVIVING_COPY_TECHNIQUE_IDS].sort());
    });

    it('keeps the declaration honest in the other direction', () => {
        // Something that is handed over is obtainable, whatever the marker says.
        for (const id of NO_SURVIVING_COPY_TECHNIQUE_IDS) {
            expect(routesTo(id), `${id} claims no copy exists and something hands one over`).toEqual([]);
        }
        // The exemption is meant to be the rare answer, not the convenient one.
        expect(NO_SURVIVING_COPY_TECHNIQUE_IDS.size / TECHNIQUES.length,
            'the unobtainable marker is becoming the way holes get closed')
            .toBeLessThan(0.05);
    });

    it('gives each of the fifteen the audit found the route it was assigned', () => {
        for (const [id, kind] of Object.entries(THE_FIFTEEN)) {
            const entry = getTechnique(id);
            expect(entry, `${id} left the catalog`).toBeDefined();
            if (!entry!.survivingCopy) {
                expect(routesTo(id)).toEqual([]);
                continue;
            }
            const kinds = routesTo(id).map(r => r.kind);
            expect(kinds, `${id} lost its ${kind} route`).toContain(kind);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE ROUTE HAS TO MATCH THE PROVENANCE
// `provenance` is a claim about how a copy reaches a reader. A route that
// contradicts it is two catalogs disagreeing, which is the class of bug this
// whole exercise came out of.
// ─────────────────────────────────────────────────────────────────────────

describe('the route agrees with the provenance', () => {
    it('gives every taught art a living teacher and every teacher a taught art', () => {
        for (const t of TECHNIQUES) {
            if (t.provenance !== 'taught') continue;
            expect(routesTo(t.id).some(r => r.kind === 'taught' || r.kind === 'apex_road'),
                `${t.id} is taught provenance and nobody hands it over`).toBe(true);
        }
        for (const s of SECTS) {
            for (const id of s.teaches) {
                expect(getTechnique(id)!.provenance, `${s.id} teaches ${id}`).toBe('taught');
            }
        }
    });

    it('never lets a recovered art be taught by anybody, through any route', () => {
        for (const id of [...RUIN_ONLY_TECHNIQUE_IDS, ...GRAVE_ONLY_TECHNIQUE_IDS]) {
            expect(routesTo(id).some(r => r.kind === 'taught'),
                `${id} has a living teacher and is supposed to be dug up`).toBe(false);
        }
    });

    it('surfaces every grave-only art in a grave and nowhere a trial could cache it', () => {
        for (const id of GRAVE_ONLY_TECHNIQUE_IDS) {
            const kinds = routesTo(id).map(r => r.kind);
            expect(kinds, `${id} only ever comes off a body`).toContain('grave');
            expect(kinds, `${id} is cached behind a door`).not.toContain('trial');
        }
    });

    it('keeps the upper grades off the ordinary teaching route', () => {
        // Off the ORDINARY route, which is the claim that was always meant.
        // A chaos art is not something a house puts on a shelf and teaches to
        // its disciples - except at the four bodies that stand in the band the
        // books are written for, each of which holds exactly one and hands it
        // over on terms no shelf could express. Everything else is a ruin or a
        // grave, which is the Late Age rule and is unchanged.
        const deepRoads = new Set(THE_DEEPEST_ROADS.map(r => r.techniqueId));
        for (const t of TECHNIQUES.filter(x => x.grade === 'chaos')) {
            if (deepRoads.has(t.id)) continue;
            expect(routesTo(t.id).some(r => r.kind === 'taught'),
                `${t.id} is chaos grade and somebody is teaching it`).toBe(false);
        }
        // And the four are one per body, held rather than published: each is on
        // at most one sect shelf, and the holder is the body the road catalog
        // names.
        for (const road of THE_DEEPEST_ROADS) {
            const shelves = SECTS.filter(x => x.teaches.includes(road.techniqueId)).map(x => x.id);
            expect(shelves.length, `${road.techniqueId} is on ${shelves.length} shelves`)
                .toBeLessThanOrEqual(1);
            if (shelves.length === 1) expect(shelves[0]).toBe(road.factionId);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE ROUTE HAS TO BE REACHABLE FROM THE ART'S OWN BAND
// A door set five ranks under the art behind it is how chaos-grade material
// ends up in a Foundation-tier hoard, which is the failure the fifteen were
// nearly fixed into.
// ─────────────────────────────────────────────────────────────────────────

describe('the route sits at the altitude of the art', () => {
    it('never teaches an art a sect could not itself perform', () => {
        for (const s of SECTS) {
            for (const id of s.teaches) {
                expect(getTechnique(id)!.requiredOrdinal, `${s.id} teaches ${id} above its own power`)
                    .toBeLessThanOrEqual(s.powerOrdinal);
            }
        }
    });

    it('puts no chaos-grade art behind the lowest doors in the catalog', () => {
        // Not a rule about gate ordinals, which measure something different on
        // each of the three gate kinds. It is a rule about the site as a whole:
        // wherever a chaos-grade art is the prize, the entry is one of the ones
        // written for the top of the ladder, and the strength gates it does
        // carry are set there.
        for (const t of INHERITANCE_TRIALS) {
            const chaos = t.interior.prize.techniqueIds
                .map(id => getTechnique(id)!)
                .filter(x => x.grade === 'chaos');
            if (chaos.length === 0) continue;
            for (const gate of t.interior.gates) {
                if (gate.kind !== 'strength') continue;
                expect(gate.ordinal, `${t.id} guards a chaos-grade art at ordinal ${gate.ordinal}`)
                    .toBeGreaterThanOrEqual(33);
            }
        }
    });

    it('takes a chaos-grade art off a body only where the body stood at the top of the ladder', () => {
        // Deliberately about the occupant rather than the art. A cultivator can
        // carry a manual they were never going to be able to read, and one of
        // them does: the jade slip on the forty-first boundary is four ranks
        // above the man holding it and that is the point of the entry. What may
        // not happen is a chaos-grade art coming off somebody who was nowhere
        // near the altitude the thing was written at.
        for (const g of GRAVES) {
            const chaos = g.interior.contents
                .map(c => (c.techniqueId === null ? null : getTechnique(c.techniqueId)!))
                // A wide-span manual is exempt, for the same reason it is
                // exempt from `GRADE_ORDINAL_BANDS`: its grade no longer
                // implies where it opens. The Canon of the First and Last
                // Breath is chaos grade and opens at five, so a carrier at
                // thirty-three is not somebody holding a thing they were
                // nowhere near - they are somebody who could read it and had
                // twelve rungs of it left when they stopped.
                .filter(x => x !== null && x.grade === 'chaos' && !isWideSpan(x));
            if (chaos.length === 0) continue;
            expect(g.occupantOrdinal, `${g.id} carries a chaos-grade art at ordinal ${g.occupantOrdinal}`)
                .toBeGreaterThanOrEqual(37);
        }
    });

    it('still requires a wide-span carrier to have been able to open the book', () => {
        // The exemption is not a licence. A body carrying a manual it could
        // not have opened is a different entry - see the jade slip four ranks
        // above the man holding it - and that is deliberate. What must not
        // happen is the catalog quietly using the wide-span exemption to put
        // treasures on people at random.
        for (const g of GRAVES) {
            const wide = g.interior.contents
                .map(c => (c.techniqueId === null ? null : getTechnique(c.techniqueId)!))
                .filter(x => x !== null && isWideSpan(x));
            for (const art of wide) {
                expect(
                    g.occupantOrdinal,
                    `${g.id} carries ${art!.id}, which opens at ${art!.requiredOrdinal}`
                ).toBeGreaterThanOrEqual(art!.requiredOrdinal);
            }
        }
    });

    it('puts no ordinal ceiling on a routed art, because a manual is paper', () => {
        // The expulsion rule in `realms.ts` caps objects, not arts. An object
        // rated at a rung lets whoever holds it strike at that rung, so one
        // from above the Lid would be a way for somebody below it to reach
        // somebody above it, and it goes back up inside fifteen breaths rather
        // than being left, looted or inherited. A manual does nothing of the
        // kind: it can be studied to full mastery and the reader is still
        // exactly the rung they were, which is why an art may sit anywhere on
        // the ladder and still legitimately be handed over down here.
        expect(MANUALS_MAY_EXCEED_THE_LID).toBe(true);
        expect(OBJECT_CEILING_BELOW_THE_LID).toBe(FALSE_IMMORTAL_ORDINAL);
        expect(isExpelledFromBelow(OBJECT_CEILING_BELOW_THE_LID)).toBe(false);
        expect(isExpelledFromBelow(OBJECT_CEILING_BELOW_THE_LID + 1)).toBe(true);

        // What does bound the routes is what this catalog chooses to author,
        // which stops at the last crossing for a stated reason of its own and
        // has nothing to do with the Lid. If that ceiling moves, arts above it
        // may be routed and this assertion follows the constant rather than a
        // number somebody typed.
        for (const t of TECHNIQUES) {
            if (routesTo(t.id).length === 0) continue;
            expect(t.requiredOrdinal, `${t.id} is routed and sits above what the catalog authors`)
                .toBeLessThanOrEqual(CONTENT_MAX_ORDINAL);
        }
    });

    it('does not let a parting gift become a curriculum', () => {
        // The estate is held, not taught. A sect standing over a library it
        // cannot read is the interesting case; a sect quietly teaching out of
        // one is a power raise nobody wrote down, which is the thing this whole
        // exercise was under instruction not to do.
        for (const [sectId, records] of Object.entries(SECT_ANCESTRY)) {
            const sect = SECTS.find(s => s.id === sectId);
            for (const id of records.partingGift?.techniqueIds ?? []) {
                const art = getTechnique(id);
                expect(art, `${sectId} hands down unknown art ${id}`).toBeDefined();
                expect(art!.provenance, `${sectId} holds ${id}, which a teacher could supply`)
                    .not.toBe('taught');
                if (!sect) continue;
                expect(sect.teaches.includes(id), `${sectId} teaches out of its ancestor's estate`)
                    .toBe(false);
                expect(art!.requiredOrdinal, `${sectId} holds ${id} and could actually use it`)
                    .toBeGreaterThan(sect.powerOrdinal);
            }
        }
    });
});
