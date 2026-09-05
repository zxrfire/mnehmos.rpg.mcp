/**
 * Ruins along two axes that do not talk to each other.
 */

import { forStream } from '../cultivation/rng.js';
import { MAX_ORDINAL, clampOrdinal, rankName } from '../cultivation/realms.js';
import {
    assessCapability,
    makeRequirements,
    makeSubject,
    type CapabilityActor,
    type CapabilitySubject
} from './capability.js';
import { applyLocationChange, type ChangeResult, type LocationRecord } from './locations.js';

// ─────────────────────────────────────────────────────────────────────────
// AXIS ONE: WHO LEFT IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * How much survives about the builder, in the world rather than in a person.
 */
export type ProvenanceStanding =
    /** Named in something anybody literate can consult. Everyone knows. */
    | 'documented'
    /** In an archive. A scholar places it; a soldier stands in front of it. */
    | 'attributed'
    /** Three stories, one of them right, and no way to tell from outside. */
    | 'rumoured'
    /** Nothing survives. Not even a scholar gets a name out of this one. */
    | 'anonymous';

export const PROVENANCE_STANDINGS: readonly ProvenanceStanding[] = [
    'documented', 'attributed', 'rumoured', 'anonymous'
];

/**
 * The `understand` bar each standing sits behind.
 */
export const PROVENANCE_READ_ORDINAL: Record<ProvenanceStanding, number> = {
    documented: 0,
    attributed: 6,
    rumoured: 14,
    anonymous: MAX_ORDINAL
};

export interface Provenance {
    standing: ProvenanceStanding;
    /** Faction id of the builder, when the world holds one. */
    builderId: string | null;
    /** What the records call them. Null when nothing calls them anything. */
    builderName: string | null;
    /** Which age it was left in, as a year. */
    builtInYear: number | null;
    /**
     * The knowledge id that places this site outright.
     */
    key: string | null;
    /** The `understand` bar for placing it without the key. */
    readOrdinal: number;
}

/** What a site looks like when nothing has ever been recorded about it. */
export function anonymousProvenance(): Provenance {
    return {
        standing: 'anonymous',
        builderId: null,
        builderName: null,
        builtInYear: null,
        key: null,
        readOrdinal: PROVENANCE_READ_ORDINAL.anonymous
    };
}

/**
 * The provenance a site carries, or the honest default.
 */
export function readProvenance(location: LocationRecord): Provenance {
    const raw = String(location.data.provenanceStanding ?? '');
    const standing = (PROVENANCE_STANDINGS as readonly string[]).includes(raw)
        ? raw as ProvenanceStanding
        : 'anonymous';
    if (standing === 'anonymous') return anonymousProvenance();

    const builderId = location.data.builderId == null ? null : String(location.data.builderId);
    const builderName = location.data.builderName == null ? null : String(location.data.builderName);
    const year = Number(location.data.builtInYear);
    const bar = Number(location.data.provenanceReadOrdinal);
    return {
        standing,
        builderId,
        builderName,
        builtInYear: Number.isFinite(year) ? year : null,
        key: location.data.provenanceKey == null ? null : String(location.data.provenanceKey),
        readOrdinal: clampOrdinal(Number.isFinite(bar) ? bar : PROVENANCE_READ_ORDINAL[standing])
    };
}

/** Write provenance onto a site. Pure: a new record comes back. */
export function withProvenance(location: LocationRecord, p: Provenance): LocationRecord {
    return {
        ...location,
        data: {
            ...location.data,
            provenanceStanding: p.standing,
            builderId: p.builderId,
            builderName: p.builderName,
            builtInYear: p.builtInYear,
            provenanceKey: p.key,
            provenanceReadOrdinal: p.readOrdinal
        }
    };
}

/**
 * The site's provenance as a thing to be read.
 */
export function subjectFromProvenance(location: LocationRecord): CapabilitySubject {
    const p = readProvenance(location);
    return makeSubject({
        kind: 'inscription',
        id: `${location.id}:provenance`,
        name: `whose ${location.name} was`,
        requirements: makeRequirements({ understand: p.readOrdinal }),
        tags: ['provenance', p.standing],
        comprehensionKeys: p.key ? [p.key] : []
    });
}

/**
 * What one person, standing here, can say about who built this.
 */
export interface ProvenanceReading {
    placed: boolean;
    standing: ProvenanceStanding;
    builderId: string | null;
    builderName: string | null;
    builtInYear: number | null;
    /**
     * What anybody sees whether or not they can place it: old, large,
     * somebody's. Always populated, because a failed read is still a read.
     */
    plain: string[];
    /** Habits of the house, once placed. Empty when it was not. */
    expectations: RuinExpectation[];
    /**
     * Named when the read fails. What is missing, in words, so the answer is
     * an instruction rather than a wall.
     */
    missing: string | null;
    /** The bar, and what the reader brought, for a narrator that wants to say. */
    readOrdinal: number;
}

/** A habit of the builder, and what it implies about where to look. */
export interface RuinExpectation {
    /** The wing this narrows to, when it narrows to one. */
    wingId: string | null;
    /** The habit, stated as a fact about the house. */
    because: string;
    /** What that implies for somebody deciding where to dig. */
    implies: string;
}

/**
 * Place the builder, or say what is missing.
 */
export function identifyBuilder(
    location: LocationRecord,
    actor: CapabilityActor
): ProvenanceReading {
    const p = readProvenance(location);
    const plain = plainSightOf(location);

    const assessment = assessCapability(actor, subjectFromProvenance(location));
    const placed = assessment.understand.holds && p.builderName !== null;

    if (!placed) {
        return {
            placed: false,
            standing: p.standing,
            builderId: null,
            builderName: null,
            builtInYear: null,
            plain,
            expectations: [],
            missing: missingFor(p),
            readOrdinal: p.readOrdinal
        };
    }

    return {
        placed: true,
        standing: p.standing,
        builderId: p.builderId,
        builderName: p.builderName,
        builtInYear: p.builtInYear,
        plain,
        expectations: expectationsFor(location),
        missing: null,
        readOrdinal: p.readOrdinal
    };
}

/**
 * What is true of the site to anybody with eyes.
 */
export function plainSightOf(location: LocationRecord): string[] {
    const out: string[] = [];
    const wings = wingsOf(location);
    out.push(location.qiDensity >= 70
        ? 'The ground under it still holds more than anything worked nearby.'
        : 'The ground under it is no better than the valley outside.');
    out.push(`Whatever was set to keep people out was set for ${rankName(location.thresholds.mastery)}.`);
    out.push(wings.length > 1
        ? `${wings.length} ways in that are still standing.`
        : 'One way in.');
    return out;
}

/**
 * The refusal, and it names what would fix it.
 */
function missingFor(p: Provenance): string {
    switch (p.standing) {
        case 'documented':
            return 'It is on record somewhere. You have not read the record.';
        case 'attributed':
            return 'Somebody\'s archive names the house that built this. You would need '
                + 'the reading, or somebody who has it.';
        case 'rumoured':
            return 'Three houses locally will tell you whose this was and they do not '
                + 'agree. Nothing here settles it; a scholar might narrow it.';
        default:
            return 'Nothing survives about who built this. Not in any archive, not in '
                + 'anybody\'s memory. It is old, it is large, and it is somebody\'s.';
    }
}

/**
 * Habits, derived from what the house DID, never from a table of houses.
 */
export function expectationsFor(location: LocationRecord): RuinExpectation[] {
    const out: RuinExpectation[] = [];
    const wings = wingsOf(location);
    const deepest = wings.length > 0 ? wings[wings.length - 1] : null;
    const sealedWing = wings.find(w => w.sealed) ?? null;

    if (location.qiDensity >= 70) {
        out.push({
            wingId: deepest?.id ?? null,
            because: 'They sealed a pocket this rich rather than working it out.',
            implies: 'A house that seals rather than spends puts what it is keeping at '
                + 'the deepest point, not the nearest one.'
        });
    } else {
        out.push({
            wingId: wings.length > 0 ? wings[0].id : null,
            because: 'The pocket under it was ordinary when they left.',
            implies: 'They were not here for the ground. Whatever they wanted kept was '
                + 'portable, and portable things are stored near the door.'
        });
    }

    const trials = location.thresholds.mastery;
    out.push({
        wingId: null,
        because: `Their trials were cut for ${rankName(trials)}.`,
        implies: `A house does not calibrate a door above its own people. Nothing in `
            + `here was meant to be carried out by anyone under ${rankName(Math.max(0, trials - 6))}.`
    });

    if (Number(location.data.techniqueCount ?? 0) > 0) {
        out.push({
            wingId: sealedWing?.id ?? deepest?.id ?? null,
            because: 'They left written material behind rather than burning it.',
            implies: 'A house that meant to come back stores paper dry and deep. A house '
                + 'that did not would have burnt it. This one meant to come back.'
        });
    }

    if (location.hazards.includes('guardian')) {
        out.push({
            wingId: sealedWing?.id ?? null,
            because: 'Something was left running rather than left standing.',
            implies: 'They spent upkeep on one room in particular, and it is not the hall '
                + 'anybody walks into first.'
        });
    }

    return out;
}

// ─────────────────────────────────────────────────────────────────────────
// AXIS TWO: HOW MUCH IS LEFT
// ─────────────────────────────────────────────────────────────────────────

/**
 * How thoroughly a wing has been gone through.
 */
export type Depletion =
    /** Nobody has been in. Either sealed, or nobody has found the way. */
    | 'untouched'
    /** Somebody got in, took what was loose, and left. */
    | 'probed'
    /** Worked more than once. What is left needed something they lacked. */
    | 'picked_over'
    /** Nothing portable remains. The ground and the formations are still here. */
    | 'stripped';

export const DEPLETIONS: readonly Depletion[] = ['untouched', 'probed', 'picked_over', 'stripped'];

const DEPLETION_ORDER: Record<Depletion, number> = {
    untouched: 0, probed: 1, picked_over: 2, stripped: 3
};

/** What a further working leaves behind, as a share of what was there. */
export const REMAINING_SHARE: Record<Depletion, number> = {
    untouched: 1,
    probed: 0.55,
    picked_over: 0.2,
    stripped: 0
};

export interface RuinWing {
    id: string;
    name: string;
    /**
     * Shut, and not by depletion. A sealed wing in a stripped ruin is the whole
     * reason the two axes are separate.
     */
    sealed: boolean;
    state: Depletion;
    /** How many separate parties have worked it. */
    workings: number;
    /** Absolute day of the last one, or null. */
    lastWorkedOnDay: number | null;
    /**
     * Days from the door.
     */
    depthDays: number;
}

/**
 * The wings of a site.
 */
export function wingsOf(location: LocationRecord): RuinWing[] {
    const stored = parseWings(location.data.wings);
    if (stored) return stored;
    return deriveWings(location);
}

function parseWings(raw: unknown): RuinWing[] | null {
    if (typeof raw !== 'string' || raw.length === 0) return null;
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return null;
        const out: RuinWing[] = [];
        for (const entry of parsed) {
            const w = entry as Partial<RuinWing>;
            if (typeof w.id !== 'string' || typeof w.name !== 'string') return null;
            const state = (DEPLETIONS as readonly string[]).includes(String(w.state))
                ? w.state as Depletion : 'untouched';
            out.push({
                id: w.id,
                name: w.name,
                sealed: Boolean(w.sealed),
                state,
                workings: Number.isFinite(Number(w.workings)) ? Number(w.workings) : 0,
                // `Number(null)` is 0 and `isFinite(0)` is true, so the obvious
                // spelling of this turned every never-worked wing into one
                // worked on day zero the first time a site round-tripped
                // through storage. Caught by the round-trip test.
                lastWorkedOnDay: typeof w.lastWorkedOnDay === 'number'
                    && Number.isFinite(w.lastWorkedOnDay)
                    ? w.lastWorkedOnDay : null,
                // Defaulted rather than refused, so a wing list written before
                // the convergence clock existed reads as one day in rather
                // than taking the world down.
                depthDays: Number.isFinite(Number(w.depthDays)) ? Number(w.depthDays) : 1
            });
        }
        return out;
    } catch {
        return null;
    }
}

/** Wing names, in the order somebody walks them. Structure, not decoration. */
const WING_NAMES = [
    'the outer hall',
    'the disciples\' quarters',
    'the archive',
    'the refining floor',
    'the inner court',
    'the vault'
] as const;

function deriveWings(location: LocationRecord): RuinWing[] {
    const rng = forStream('wings', location.id);
    const stocked = Number(location.data.techniqueCount ?? 0) + Number(location.data.treasureCount ?? 0);
    // A bigger house has more of itself. Two at minimum, so "one door nobody
    // opened" is always expressible.
    const count = Math.max(2, Math.min(WING_NAMES.length, 2 + Math.floor(stocked / 2) + rng.int(0, 1)));

    const out: RuinWing[] = [];
    for (let i = 0; i < count; i++) {
        const deepest = i === count - 1;
        out.push({
            id: `${location.id}-w${i + 1}`,
            name: WING_NAMES[i],
            // Days from the door, and the reason the far rooms survive. Scaled
            // off how high the trials were cut, because a house that calibrated
            // for a high rung built on a scale to match: a great ancient site is
            // deeper than a small one and is correspondingly less reachable in
            // one window.
            depthDays: (i + 1) * Math.max(1, Math.round(1 + location.thresholds.mastery / 8)),
            // SEPARATELY sealed, and only the deepest room is. Whether the SITE is
            // shut is a different fact living on the location record and answered
            // by `evaluateAccess` - conflating the two meant a sealed site derived
            // every wing shut, so breaking the outer seal left a place nobody could
            // enter any part of. The inner door is the one that stays shut after
            // somebody gets in, which is what makes "picked over twice with one
            // wing nobody has opened" a reachable state.
            sealed: deepest,
            state: 'untouched',
            workings: 0,
            lastWorkedOnDay: null
        });
    }
    return out;
}

/** Write a wing list back onto a site. Pure. */
export function withWings(location: LocationRecord, wings: readonly RuinWing[]): LocationRecord {
    return {
        ...location,
        data: {
            ...location.data,
            wings: JSON.stringify(wings),
            depletion: overallDepletion(wings)
        }
    };
}

/**
 * The site's depletion, as one word, derived from its wings.
 */
export function overallDepletion(wings: readonly RuinWing[]): Depletion {
    if (wings.length === 0) return 'untouched';
    let best: Depletion = 'stripped';
    for (const w of wings) {
        if (DEPLETION_ORDER[w.state] < DEPLETION_ORDER[best]) best = w.state;
    }
    return best;
}

/**
 * Somebody worked a wing.
 */
export function workWing(
    location: LocationRecord,
    input: { wingId: string; onDay: number; byName?: string | null; unsealed?: boolean }
): ChangeResult | null {
    const wings = wingsOf(location);
    const at = wings.findIndex(w => w.id === input.wingId);
    if (at < 0) return null;
    const wing = wings[at];
    // The site's own seal first: you cannot work a hall in a place you have not
    // got into. Then the wing's, which is a separate door.
    if (location.sealed && !input.unsealed) return null;
    if (wing.sealed && !input.unsealed) return null;

    const next: RuinWing = {
        ...wing,
        sealed: input.unsealed ? false : wing.sealed,
        state: DEPLETIONS[Math.min(DEPLETIONS.length - 1, DEPLETION_ORDER[wing.state] + 1)],
        workings: wing.workings + 1,
        lastWorkedOnDay: input.onDay
    };
    const updated = wings.slice();
    updated[at] = next;

    const who = input.byName ? `${input.byName} ` : '';
    return applyLocationChange(withWings(location, updated), {
        onDay: input.onDay,
        kind: input.unsealed ? 'unsealed' : 'depleted',
        summary: `${who}worked ${wing.name} of ${location.name}. It is ${next.state.replace('_', ' ')} now.`,
        causeKnown: input.byName != null,
        witnessed: input.byName != null,
        fidelity: input.byName ? 'full' : 'partial',
        patch: {
            data: { wings: JSON.stringify(updated), depletion: overallDepletion(updated) }
        }
    });
}

/**
 * What a site is worth to somebody arriving now, on the depletion axis alone.
 */
export interface SiteStanding {
    depletion: Depletion;
    /** Share of the original stock a newcomer could still reach, 0..1. */
    remainingShare: number;
    wings: RuinWing[];
    /** Wings nobody has opened. The reason to come at all. */
    unopened: RuinWing[];
    /** Wings still shut. A subset of unopened, and the hard ones. */
    stillSealed: RuinWing[];
    /** How many separate parties have been through, across every wing. */
    totalWorkings: number;
}

export function siteStanding(location: LocationRecord): SiteStanding {
    const wings = wingsOf(location);
    const depletion = overallDepletion(wings);
    return {
        depletion,
        remainingShare: Number(
            (wings.reduce((s, w) => s + REMAINING_SHARE[w.state], 0) / Math.max(1, wings.length))
                .toFixed(3)
        ),
        wings,
        unopened: wings.filter(w => w.state === 'untouched'),
        stillSealed: wings.filter(w => w.sealed),
        totalWorkings: wings.reduce((s, w) => s + w.workings, 0)
    };
}

// AXIS THREE: HOW LONG AGO IT STOPPED BEING LIVED IN

export type RuinAge = 'new' | 'old' | 'ancient';

/** Within living memory of somebody at an ordinary rung. */
export const NEW_RUIN_YEARS = 200;
/** Within the reach of archives, if not of anybody alive. */
export const OLD_RUIN_YEARS = 2_000;

/**
 * How long ago this stopped being lived in.
 */
export function ageOf(location: LocationRecord, onDay: number): RuinAge {
    const fell = fellOnDay(location);
    if (fell === null) return 'ancient';
    const years = (onDay - fell) / 365;
    if (years <= NEW_RUIN_YEARS) return 'new';
    if (years <= OLD_RUIN_YEARS) return 'old';
    return 'ancient';
}

/** The day it stopped being somebody's, from its own change history. */
export function fellOnDay(location: LocationRecord): number | null {
    for (let i = location.changes.length - 1; i >= 0; i--) {
        const c = location.changes[i];
        if (c.kind === 'destroyed' || c.kind === 'abandoned' || c.kind === 'sealed') {
            return c.onDay;
        }
    }
    const stored = Number(location.data.sealedYear);
    return Number.isFinite(stored) ? stored * 365 : null;
}

/**
 * What a wing holds, in kind rather than in amount.
 */
export function wingHolds(
    wing: RuinWing,
    wings: readonly RuinWing[],
    age: RuinAge
): { kinds: string[]; note: string } {
    const deep = wings.length > 1
        ? wing.depthDays / Math.max(1, wings[wings.length - 1].depthDays)
        : 1;

    if (deep < 0.5) {
        return {
            kinds: age === 'new'
                ? ['stores', 'stones', 'ordinary manuals']
                : ['fittings', 'stones', 'tools'],
            note: 'What a house keeps where it can be got at. Portable, obvious, and '
                + 'the first thing anybody takes.'
        };
    }
    if (age === 'new') {
        return {
            kinds: ['treasury', 'the library as it stood', 'refining stock'],
            note: 'What they had not finished moving. Of this age, all of it - these '
                + 'people had nothing older than anybody else does.'
        };
    }
    return {
        kinds: age === 'ancient'
            ? ['sealed material', 'arts nobody transmits', 'what the formations were built around']
            : ['what was locked rather than packed', 'the inner library'],
        note: 'What somebody sealed rather than carried. Still here because taking it '
            + 'was never the fast part.'
    };
}

// THE GRADIENT IS A RECORD OF WHO CAME, NOT A DIFFICULTY CURVE

export type ChamberSign = 'been_worked' | 'nobody_came_back' | 'never_found' | 'no_pattern';

export interface FirstChamberReading {
    sign: ChamberSign;
    /** What is observably true, with no inference attached. */
    observed: string;
    /**
     * What it implies. Deliberately NOT a resolved answer where the world does
     * not have one: "nobody came, or nobody came back" is two readings and the
     * engine declines to pick.
     */
    implies: string;
    /** Competing readings, when the sign genuinely has more than one. */
    readings: string[];
}

/**
 * What walking into the first room tells anybody, whatever they know.
 */
export function firstChamberTells(location: LocationRecord): FirstChamberReading {
    const wings = wingsOf(location);
    const deepest = wings.length > 0 ? wings[wings.length - 1].depthDays : 1;
    const shallow = wings.filter(w => w.depthDays / Math.max(1, deepest) < 0.5);
    const workedShallow = shallow.some(w => w.state !== 'untouched');
    const anyWorked = wings.some(w => w.state !== 'untouched');

    if (workedShallow) {
        return {
            sign: 'been_worked',
            observed: 'The outer hall has been gone through. Nothing loose, and the dust '
                + 'is disturbed in lines rather than evenly.',
            implies: 'People have been here, more than once, and they did not have time '
                + 'to go far.',
            readings: []
        };
    }
    if (!anyWorked && location.discovered) {
        return {
            sign: 'nobody_came_back',
            observed: 'Everything by the door is where it was left, and this place is on '
                + 'maps.',
            implies: 'Everybody could have come and nobody has - or nobody has come back '
                + 'out to say they did.',
            readings: [
                'nobody has bothered, because it is known to be poor',
                'nobody who went in has returned',
                'somebody is keeping people away from it'
            ]
        };
    }
    if (!anyWorked) {
        return {
            sign: 'never_found',
            observed: 'There is a set of racks inside the entrance and they are full.',
            implies: 'Nobody has ever been in here. What the builders left is where they '
                + 'left it, including at the door.',
            readings: []
        };
    }
    return {
        sign: 'no_pattern',
        observed: 'Worked at the back and not at the front, which is the wrong way round.',
        implies: 'Whoever came in was not in a hurry, or did not come in through this '
            + 'door.',
        readings: []
    };
}

// KNOWLEDGE FOLLOWS ENGAGEMENT, NOT ALTITUDE

export interface SiteKnowledge {
    knowerId: string;
    /** Times this knower is recorded as having worked the site. */
    engagements: number;
    /** They can place the builder because somebody of theirs established it. */
    knowsProvenance: boolean;
    /** They know where the value actually sits, because they have been. */
    knowsGradient: boolean;
    /** They know when it is next reachable. */
    knowsSchedule: boolean;
    /**
     * One visit's worth of picture, held confidently.
     */
    confidentlyPartial: boolean;
    /** What they would tell somebody, and whether it is true. */
    wouldSay: string;
}

/** Visits before a house's picture of a site stops being a guess. */
export const ENGAGEMENTS_FOR_A_PICTURE = 3;

/**
 * What one knower knows about one site.
 */
export function knownAxes(
    location: LocationRecord,
    knower: { id: string; name: string }
): SiteKnowledge {
    let engagements = 0;
    for (const change of location.changes) {
        if (change.summary.includes(knower.name)) engagements++;
    }
    const enough = engagements >= ENGAGEMENTS_FOR_A_PICTURE;
    const some = engagements > 0;

    return {
        knowerId: knower.id,
        engagements,
        // Establishing whose a site was takes going in and reading it, which is
        // what an engagement is. One trip is enough to bring back an
        // inscription; it is not enough to know the shape of the place.
        knowsProvenance: some && readProvenance(location).standing !== 'anonymous',
        knowsGradient: enough,
        knowsSchedule: enough && location.cycle !== null,
        confidentlyPartial: some && !enough,
        wouldSay: engagements === 0
            ? 'Nothing. They have never had anybody in it.'
            : enough
                ? 'Where the value actually is, what is already gone, and when it is next open.'
                : 'What the first chamber looked like, stated as though it were the place.'
    };
}

// AXIS FOUR: WHO CONTROLS THE DOOR NOW

export type SiteControl =
    /** Nobody's, because nobody knows. */
    | 'unclaimed'
    /** Claimed, and the claim is a piece of paper. */
    | 'held_on_paper'
    /** Claimed, and somebody is standing at the entrance. */
    | 'held_on_the_ground';

export type EntryPrice = 'open' | 'disciples_only' | 'fee' | 'task';

export interface AccessTerms {
    control: SiteControl;
    holderId: string | null;
    price: EntryPrice;
    /** Stones asked, when the price is a fee. Zero otherwise. */
    feeStones: number;
    /**
     * Whether the holder could actually stop somebody who ignored the terms.
     * False on a paper claim, which is the case worth playing.
     */
    enforceable: boolean;
    /** What refusing the terms and going in anyway makes true. */
    ifIgnored: string;
}

/** A day's earnings at the bottom, near enough, and the unit a toll is set in. */
export const RUIN_TOLL_PER_DANGER_ORDINAL = 40;

/**
 * Who holds this door and what they want for it.
 */
export function accessTermsFor(
    location: LocationRecord,
    holder: {
        id: string;
        recruits: boolean;
        /** Members it can actually put at the door. */
        reach: number;
    } | null
): AccessTerms {
    if (!location.discovered || !holder || location.controllingFactionId !== holder.id) {
        return {
            control: 'unclaimed',
            holderId: null,
            price: 'open',
            feeStones: 0,
            enforceable: false,
            ifIgnored: 'Nobody is charging, nobody is watching, and the reason for that '
                + 'is worth knowing before you go in.'
        };
    }

    const onTheGround = holder.reach >= 3;
    const fee = Math.max(
        RUIN_TOLL_PER_DANGER_ORDINAL,
        location.thresholds.mastery * RUIN_TOLL_PER_DANGER_ORDINAL
    );

    // A house with people to spare reserves it; one with people but not many
    // sells; one that cannot man the entrance asks for the errand instead.
    const price: EntryPrice = !onTheGround
        ? 'task'
        : holder.recruits ? 'fee' : 'disciples_only';

    return {
        control: onTheGround ? 'held_on_the_ground' : 'held_on_paper',
        holderId: holder.id,
        price,
        feeStones: price === 'fee' ? fee : 0,
        enforceable: onTheGround,
        ifIgnored: onTheGround
            ? 'Somebody is at the entrance and will be there when you come out.'
            : 'The claim is a piece of paper. They will bill you and they cannot '
                + 'stop you, and both of those facts have consequences later.'
    };
}

// A STRIPPED RUIN IS EMPTY OF THINGS AND FULL OF UNDERSTANDING

/**
 * What this site puts within reach of understanding.
 */
export function comprehensionTagsFor(location: LocationRecord, onDay: number): string[] {
    const tags = new Set<string>();
    const wings = wingsOf(location);
    const age = ageOf(location, onDay);

    // What the house was doing, from the halls it had.
    if (wings.some(w => w.name.includes('refining'))) tags.add('alchemy_hall');
    if (wings.some(w => w.name.includes('archive'))) tags.add('sealed_tomb');

    // How it ended, from its own change history.
    for (const change of location.changes) {
        if (change.kind === 'destroyed') tags.add('ancient_battlefield');
        if (change.kind === 'forbidden') tags.add('tribulation_scar');
    }
    if (location.tags.includes('scar')) tags.add('tribulation_scar');
    if (location.hazards.includes('formation')) tags.add('ancient_battlefield');

    // And the plain fact of depth and age. A site old enough that nobody put
    // the bodies anywhere is a tomb whatever else it was.
    if (age === 'ancient' && wings.length > 2) tags.add('sealed_tomb');

    return [...tags];
}

/** What a site is worth to somebody arriving, split by what can leave with them. */
export interface StandingOffer {
    /** Things. Runs out, and on a worked site is usually already gone. */
    carryable: { wingId: string; kinds: string[]; note: string }[];
    /** Understanding. Does not run out, whoever has been through. */
    comprehensible: string[];
    /**
     * What the world says about the danger.
     */
    deemedSafe: boolean;
    /** What the record actually says, which nobody standing outside can read. */
    thresholds: LocationRecord['thresholds'];
}

/**
 * Everything on offer, with the two kinds kept apart.
 */
export function standingOffer(location: LocationRecord, onDay: number): StandingOffer {
    const wings = wingsOf(location);
    const age = ageOf(location, onDay);
    const totalWorkings = wings.reduce((s, w) => s + w.workings, 0);

    return {
        carryable: wings
            .filter(w => w.state !== 'stripped')
            .map(w => ({ wingId: w.id, ...wingHolds(w, wings, age) })),
        comprehensible: comprehensionTagsFor(location, onDay),
        // Many parties in and out with nothing to report is what a reputation
        // for safety is made of. The number is deliberately low: it does not
        // take many uneventful returns for a place to stop frightening people.
        deemedSafe: totalWorkings >= 3 && wings.every(w => !w.sealed),
        thresholds: location.thresholds
    };
}

// ─────────────────────────────────────────────────────────────────────────
// A NEW RUIN, MADE BY SOMETHING THE WORLD DID
// ─────────────────────────────────────────────────────────────────────────

/**
 * A house's seat, after the house.
 */
export function ruinFromFallenSeat(
    location: LocationRecord,
    input: {
        onDay: number;
        houseName: string;
        houseId: string;
        causeFactId?: string | null;
        /** False when the house left rather than was ended. */
        destroyed?: boolean;
    }
): ChangeResult {
    const wings = deriveWings(location).map(w => ({
        ...w,
        // Nothing about a house that fell this year is sealed against anybody.
        // Whatever was locked is locked with an ordinary lock.
        sealed: false,
        state: 'untouched' as Depletion
    }));

    const withMeta = withWings(withProvenance(location, {
        standing: 'documented',
        builderId: input.houseId,
        builderName: input.houseName,
        builtInYear: location.origin.fromDay === null
            ? null : Math.floor(location.origin.fromDay / 365),
        key: null,
        readOrdinal: PROVENANCE_READ_ORDINAL.documented
    }), wings);

    return applyLocationChange(withMeta, {
        onDay: input.onDay,
        kind: input.destroyed === false ? 'abandoned' : 'destroyed',
        summary: `${location.name} is what is left of the ${input.houseName}.`,
        causeFactId: input.causeFactId ?? null,
        causeKnown: true,
        witnessed: true,
        fidelity: 'full',
        patch: {
            kind: 'ruin',
            controllingFactionId: null,
            // No cycle. This is a place you can walk to, and that is the point.
            cycle: null,
            sealed: false,
            discovered: true,
            addTags: ['ruin', 'recent'],
            addHazards: ['formation'],
            environment: {
                politicalControl: 'nobody, since it fell',
                historicalScars: [`the ${input.houseName} ended here`]
            }
        }
    });
}
