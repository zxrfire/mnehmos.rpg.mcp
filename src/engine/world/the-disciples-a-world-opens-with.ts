/**
 * The disciples a world opens with: which of a house's people already have a
 * personal master on the day the world begins.
 *
 * The design owner: catalog elders and seated masters open the world with
 * disciples, drawn from their own house's people; *"we already have people in
 * sects"*, and a person may be added only where a master has nobody suitable,
 * which no house measured has needed, so nobody is; *"some have no master"*; and
 * *"most outer and inner disciples don't"*, the share rising toward core
 * disciples and those in line for senior places. Before this every
 * master-disciple bond in the world was made by the yearly teaching pass, so a world opened with none, every elder with
 * no disciple, and no jade for the opening to give.
 *
 * ── WHO TAKES ONE ────────────────────────────────────────────────────────
 *
 *   a master     somebody on their house's elder rung or above
 *                (`elderRungOf`), or a catalog member the catalog calls a
 *                master, who is past Foundation (a hand that can carry anybody),
 *                and whose catalog row does not say they take no disciples. A few
 *                each, never many: {@link A_MASTER_TAKES_AT_MOST}
 *   a disciple   a junior of the same house, on a disciple rung below the elder
 *                rung and below their master's realm, with no master already -
 *                except a heavenly seedling, whom several may take
 *                ({@link A_SEEDLING_ANSWERS_TO_AT_MOST}).
 *                Drawn in at {@link theShareTakenAt} of their rung, weighted by
 *                how promising they are (their root's own speed) and matched to a
 *                master who shares an element of their root or an art they hold
 *
 * No catalog row names a disciple or a student of anybody: the member rows and
 * the Hollow Court roster speak of disciples as a rung and never by name, so
 * there is nothing to honour here beyond the rule. Nor does the catalog say which
 * of its masters take disciples, except the one who wants *"to take no disciples
 * this decade either"*, who takes none.
 *
 * ── AND A MASTER CAN BE LOOKING ──────────────────────────────────────────
 *
 * *"A master can also be looking for a disciple"*, *"very normal"* and *"not too
 * common"*. Some of the masters who open the world short of the disciples they
 * would take are looking ({@link MASTERS_SHORT_OF_A_DISCIPLE_WHO_ARE_LOOKING}): a goal on their own row ({@link A_MASTER_LOOKING}), saying
 * what they look for off their root and their arts, which the ordinary reads of
 * what somebody wants carry to anybody who asks. The world acts on it once a year
 * ({@link searchingMastersTakeADisciple}), and *"a master doesn't necessarily
 * take the best one they found within a year"*: they take somebody who fits what
 * they want, when that person crosses their path and impresses them, which for a
 * picky master ({@link howReadilyTheyTake}) can be decades away. Measured on
 * `absence-audit` over 120 years: the 24 searches a world opens with closed after
 * a median of 5.5 years, a mean of 8.2, and one that took 30.
 *
 * ── UNLESS YOU ARE A HEAVENLY SEEDLING ───────────────────────────────────
 *
 * *"Unless you are a heavenly seedling."* Most juniors never draw a master's eye;
 * an exceptional talent does, often several masters at once and masters who were
 * not looking. The talent reads that exist decide it
 * ({@link isAHeavenlySeedling}): a mutated root, a physique, or somebody their
 * house has already marked `chosen`. A seedling on a disciple rung is taken
 * whenever a master of their house can carry them, at the world's opening and in
 * any year after, and the masters who did not get them open the world wanting
 * them ({@link A_MASTER_WANTS_A_SEEDLING}).
 *
 * ── WHAT IS WRITTEN ──────────────────────────────────────────────────────
 *
 * The bond both ways off `whatABondOpens`, at the standings it opens at
 * (`DISCIPLE_STANDING`, `MASTER_STANDING`), dated the day the world opens, with
 * attention dated that day too, so the tie starts warm and the warmth the
 * standing carries (`theStandingOfALongSilence`) has somewhere to start from.
 * And the life event, as the yearly pass writes it (`recordMasterTaken`). The
 * oath rows the bond also opens have no day they come due: *"a master-disciple
 * bond is for life"*, and it ends when somebody ends it.
 *
 * What a bond IS - no term, several of them at once, either end able to end it,
 * and the warmth counted whether or not anybody is teaching - is written once in
 * `what-stands-between-a-master-and-a-disciple.md`.
 */

import { MEMBERS } from '../../data/cultivation/members.js';
import { FOUNDATION_ORDINAL, lifespanForOrdinal } from '../cultivation/realms.js';
import { elderRungOf } from '../cultivation/leadership.js';
import { forStream } from '../cultivation/rng.js';
import { getSpiritRoot } from '../cultivation/spirit-roots.js';
import { cultivationSpeedOf, physiqueOrNull } from '../cultivation/physiques.js';
import { DISCIPLE_STANDING } from './the-ties-an-ordinary-life-produces.js';
import { mastersGiveJadeToDisciplesTheyValue } from './a-pair-of-communication-jade.js';
import { isElderRank } from '../cultivation/leadership.js';
import { whatABondOpens, whatEndingABondLeaves } from '../social-leverage/taking-somebody-as-your-own.js';
import { catalogPersonBehind } from './a-catalog-person-and-their-world-row.js';
import { addGoal, closeGoal, theTieBecomes, upsertRelationship, type NpcRecord } from './npc-state.js';
import { recordABondEnded, recordMasterTaken } from './recording-where-somebody-stands-in-a-house.js';
import type { WorldState } from './world-state.js';

/** The note on the goal of a master looking for a disciple, which is what finds it again. */
export const A_MASTER_LOOKING = 'looking-for-a-disciple';

/**
 * The share of masters short of the disciples they would take who open the world
 * looking. The design owner: *"very normal"*, and then *"not too common"*: a
 * regular, noticeable minority of the masters and elders a world opens with, and
 * not most of them.
 */
export const MASTERS_SHORT_OF_A_DISCIPLE_WHO_ARE_LOOKING = 0.3;

/** The goal of a master looking for a disciple, or null. */
export function theirSearchForADisciple(npc: Pick<NpcRecord, 'goals'>): NpcRecord['goals'][number] | null {
    return npc.goals.find(g => g.note === A_MASTER_LOOKING && g.status === 'active') ?? null;
}

/** What a master looks for in a disciple, in words, off their own root and arts. */
export function whatTheyLookFor(master: NpcRecord): string {
    const root = getSpiritRoot(master.cultivation.spiritRoot);
    const arts = master.cultivation.techniqueIds.length;
    return `Looking for a disciple: somebody promising, with a root that takes ${root.elements.join(' or ')}`
        + (arts > 0 ? `, or who already holds one of the ${arts} art${arts === 1 ? '' : 's'} they carry.` : '.');
}

/** The most disciples one master opens the world with. A few, not many. */
export const A_MASTER_TAKES_AT_MOST = 3;

/**
 * The share of a disciple rung taken as somebody's personal disciple, before how
 * promising they are weighs in.
 *
 * Small at the bottom and rising: the first disciple rung is {@link LOWEST_SHARE},
 * the rung just under the elders is {@link HIGHEST_SHARE}, and the rungs between
 * climb on a square, so the middle of a house stays mostly without a master.
 */
export const LOWEST_SHARE = 0.04;
export const HIGHEST_SHARE = 0.4;

/** The first rung that is a disciple rather than a servant. */
const THE_FIRST_DISCIPLE_RUNG = 1;

export function theShareTakenAt(rankIndex: number, rankCount: number): number {
    const elder = elderRungOf(rankCount);
    if (rankIndex < THE_FIRST_DISCIPLE_RUNG || rankIndex >= elder) return 0;
    const top = elder - 1;
    const along = top <= THE_FIRST_DISCIPLE_RUNG ? 1 : (rankIndex - THE_FIRST_DISCIPLE_RUNG) / (top - THE_FIRST_DISCIPLE_RUNG);
    return LOWEST_SHARE + (HIGHEST_SHARE - LOWEST_SHARE) * along * along;
}

/**
 * How promising somebody reads, off the talent reads that exist: their root's
 * speed and their physique's. 1 is ordinary.
 */
export function howPromising(npc: Pick<NpcRecord, 'cultivation' | 'identity'>): number {
    return getSpiritRoot(npc.cultivation.spiritRoot).cultivationSpeed
        * cultivationSpeedOf(physiqueOrNull(npc.identity.physique));
}

/**
 * A heavenly seedling: a mutated root, a physique, or somebody their house has
 * marked `chosen`. The one kind of junior masters compete for.
 */
export function isAHeavenlySeedling(npc: Pick<NpcRecord, 'cultivation' | 'identity' | 'tags'>): boolean {
    return getSpiritRoot(npc.cultivation.spiritRoot).grade === 'mutated'
        || physiqueOrNull(npc.identity.physique) !== null
        || npc.tags.includes('chosen');
}

/**
 * How promising somebody has to read before a master takes them on with nothing
 * else in common: no element of their root, none of their arts. Above ordinary
 * ({@link howPromising} is 1 for ordinary), because talent is the one thing that
 * buys the years a master would rather spend on somebody who fits them.
 */
export const WORTH_THE_YEARS_WITHOUT_A_FIT = 1.2;

/**
 * How many masters one person may answer to.
 *
 * The design owner: *"you often have more than one master, and that's okay."*
 * Ordinary juniors get one at most because one is already more than most of them
 * ever get; a heavenly seedling is the case where several masters want the same
 * person and more than one of them gets a yes.
 */
export const A_SEEDLING_ANSWERS_TO_AT_MOST = 3;

/**
 * Ties that are a household and not a road. A bond is written with
 * `upsertRelationship`, which is keyed on the person and not on the kind, so a
 * bond written over a marriage REPLACES it: measured on `fam-d`, a catalog
 * marriage came back reading `master`, and the pass that takes a second parent
 * off a marriage then found parents who were not married to each other. Nobody
 * takes their own wife, parent or child as a disciple anyway.
 */
const A_HOUSEHOLD_TIE: ReadonlySet<string> = new Set(['spouse', 'kin', 'parent', 'child']);

/** Whether either of them already holds the other as household or blood. */
function alreadyOfOneHousehold(one: NpcRecord, other: NpcRecord): boolean {
    return one.relationships.some(r => r.targetId === other.id && A_HOUSEHOLD_TIE.has(r.kind))
        || other.relationships.some(r => r.targetId === one.id && A_HOUSEHOLD_TIE.has(r.kind));
}

/** Whether this master may take this junior on, given who already stands over them. */
function freeToBeTakenBy(junior: NpcRecord, master: NpcRecord): boolean {
    if (alreadyOfOneHousehold(junior, master)) return false;
    const theirs = junior.relationships.filter(r => r.kind === 'master');
    if (theirs.some(r => r.targetId === master.id)) return false;
    if (theirs.length === 0) return true;
    return isAHeavenlySeedling(junior) && theirs.length < A_SEEDLING_ANSWERS_TO_AT_MOST;
}

/** The note on the goal of a master who wants a particular seedling as their disciple. */
export const A_MASTER_WANTS_A_SEEDLING = 'wants-a-seedling';

/** The most other masters of a house who open the world wanting one seedling. */
export const MASTERS_WHO_WANT_A_SEEDLING_AT_MOST = 2;

/** The chance a junior is taken at the opening, off their rung and their talent. */
function theChanceTheyAreTaken(junior: NpcRecord, rankCount: number): number {
    if (isAHeavenlySeedling(junior)) return 1;
    return Math.min(1, theShareTakenAt(junior.factionRankIndex, rankCount) * howPromising(junior));
}

const CATALOG_ROLE = new Map(MEMBERS.map(m => [m.id, m] as const));

function takesDisciples(npc: NpcRecord, rankCount: number): boolean {
    if (npc.status !== 'alive' || npc.cultivation.realmOrdinal < FOUNDATION_ORDINAL) return false;
    const member = CATALOG_ROLE.get(catalogPersonBehind(npc.id) ?? '');
    if (member && /\btake no disciples\b/i.test(member.wants)) return false;
    return npc.factionRankIndex >= elderRungOf(rankCount) || member?.role === 'master';
}

function fits(master: NpcRecord, disciple: NpcRecord): number {
    const a = new Set(getSpiritRoot(master.cultivation.spiritRoot).elements);
    const sharesAnElement = getSpiritRoot(disciple.cultivation.spiritRoot).elements.some(e => a.has(e));
    const sharesAnArt = disciple.cultivation.techniqueIds.some(t => master.cultivation.techniqueIds.includes(t));
    return (sharesAnArt ? 2 : 0) + (sharesAnElement ? 1 : 0);
}

export interface TheDisciplesAWorldOpensWith {
    /** Bonds written, by house. */
    bondsByHouse: Map<string, number>;
    /** Masters who open the world looking for a disciple. */
    looking: number;
    /** Heavenly seedlings on disciple rungs, how many were taken, and how many masters want each one taken by somebody else. */
    seedlings: { of: number; taken: number; wantedBy: number };
    /** Pairs of jade given at the opening. */
    jade: number;
    /** Of the people on each disciple rung, how many have a master, by rank index across all houses. */
    takenByRank: Map<number, { taken: number; of: number }>;
}

/**
 * Write the master-disciple bonds a world opens with. Mutates `state.npcs` and
 * the ledger. Nobody is created.
 */
export function seedTheDisciplesAWorldOpensWith(state: WorldState): TheDisciplesAWorldOpensWith {
    const day = Math.floor(state.currentDay);
    const out: TheDisciplesAWorldOpensWith = {
        bondsByHouse: new Map(), looking: 0, seedlings: { of: 0, taken: 0, wantedBy: 0 }, jade: 0, takenByRank: new Map()
    };
    const at = new Map(state.npcs.map((n, i) => [n.id, i] as const));

    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null) continue;
        const rankCount = house.ranks.length;
        const roll = state.npcs.filter(n => n.status === 'alive' && n.factionId === house.id);
        const masters = roll.filter(n => takesDisciples(n, rankCount))
            .sort((a, b) => b.factionRankIndex - a.factionRankIndex || (a.id < b.id ? -1 : 1));
        const load = new Map<string, number>();
        const rng = forStream(state.seed, 'the-disciples-a-world-opens-with', house.id);
        // How many each takes, drawn once: some take none.
        for (const m of masters) load.set(m.id, A_MASTER_TAKES_AT_MOST - rng.int(0, A_MASTER_TAKES_AT_MOST));

        const juniors = roll
            .filter(n => theShareTakenAt(n.factionRankIndex, rankCount) > 0
                && !n.relationships.some(r => r.kind === 'master'))
            .sort((a, b) => Number(isAHeavenlySeedling(b)) - Number(isAHeavenlySeedling(a))
                || howPromising(b) - howPromising(a) || (a.id < b.id ? -1 : 1));

        let bonds = 0;
        for (const junior of juniors) {
            const row = out.takenByRank.get(junior.factionRankIndex) ?? { taken: 0, of: 0 };
            row.of++;
            out.takenByRank.set(junior.factionRankIndex, row);
            const seedling = isAHeavenlySeedling(junior);
            if (seedling) out.seedlings.of++;
            if (!rng.chance(theChanceTheyAreTaken(junior, rankCount))) continue;
            // A seedling draws masters who were not taking anybody.
            const able = masters
                .filter(m => m.id !== junior.id
                    && (seedling || (load.get(m.id) ?? 0) > 0)
                    && m.cultivation.realmOrdinal > junior.cultivation.realmOrdinal
                    && m.factionRankIndex > junior.factionRankIndex
                    // Never over a marriage or a blood tie: see `A_HOUSEHOLD_TIE`.
                    && !alreadyOfOneHousehold(state.npcs[at.get(junior.id)!]!, state.npcs[at.get(m.id)!]!))
                .sort((a, b) => fits(b, junior) - fits(a, junior)
                    || (load.get(b.id) ?? 0) - (load.get(a.id) ?? 0)
                    || (a.id < b.id ? -1 : 1));
            const master = able[0];
            if (!master) continue;
            load.set(master.id, (load.get(master.id) ?? 0) - 1);
            takesThemOn(state, at, master, junior, day);
            row.taken++;
            bonds++;
            if (seedling) {
                out.seedlings.taken++;
                // AND THE ONES WHO DID NOT GET THEM STILL WANT THEM.
                for (const rival of able.slice(1, 1 + MASTERS_WHO_WANT_A_SEEDLING_AT_MOST)) {
                    const i = at.get(rival.id)!;
                    state.npcs[i] = addGoal(state.npcs[i]!, {
                        kind: 'other',
                        text: `Wants ${junior.name} as a disciple, and ${master.name} took them first.`,
                        priority: 0.5,
                        targetId: junior.id,
                        note: A_MASTER_WANTS_A_SEEDLING
                    }, day);
                    out.seedlings.wantedBy++;
                }
            }
        }
        if (bonds > 0) out.bondsByHouse.set(house.id, bonds);

        // AND THE MASTERS STILL SHORT, MOSTLY LOOKING.
        for (const master of masters) {
            if ((load.get(master.id) ?? 0) <= 0) continue;
            if (!rng.chance(MASTERS_SHORT_OF_A_DISCIPLE_WHO_ARE_LOOKING)) continue;
            const i = at.get(master.id)!;
            if (theirSearchForADisciple(state.npcs[i]!)) continue;
            state.npcs[i] = addGoal(state.npcs[i]!, {
                kind: 'other',
                text: whatTheyLookFor(state.npcs[i]!),
                priority: 0.4,
                note: A_MASTER_LOOKING
            }, day);
            out.looking++;
        }
    }

    // AND THE JADE AN ELDER HAS GIVEN, now there are disciples to give it to.
    // Sparingly: one pair an elder at the seat, to the disciple they hold
    // highest, at the standing a bond opens at, which is the yearly grant's rule
    // with the bond as warm as it is today. See `mastersGiveJadeToDisciplesTheyValue`.
    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null || house.seatLocationId === null) continue;
        out.jade += mastersGiveJadeToDisciplesTheyValue(state, {
            day,
            valuedAt: DISCIPLE_STANDING,
            onlyElders: npc => npc.factionId === house.id && npc.status === 'alive'
                && npc.locationId === house.seatLocationId && isElderRank(npc.factionRankIndex, house.ranks.length)
        });
    }
    return out;
}

/**
 * Write one master-disciple bond: both ties off `whatABondOpens`, attention dated
 * the day it opens, and the life event. Mutates `state`.
 */
function takesThemOn(state: WorldState, at: Map<string, number>, master: NpcRecord, junior: NpcRecord, day: number): void {
    const opened = whatABondOpens({
        master: { id: master.id, name: master.name, ordinal: master.cultivation.realmOrdinal },
        student: { id: junior.id, name: junior.name, ordinal: junior.cultivation.realmOrdinal },
        onDay: day
    });
    for (const tie of opened.ties) {
        const i = at.get(tie.holderId);
        if (i === undefined) continue;
        const written = upsertRelationship(state.npcs[i]!, {
            targetId: tie.targetId, targetName: tie.targetName, kind: tie.kind,
            standing: tie.standing, note: tie.note
        }, day);
        // Attention dated the day the bond opens, on the bond's own row and not
        // on whatever else stands between the two.
        state.npcs[i] = {
            ...written,
            relationships: written.relationships.map(r =>
                r.targetId === tie.targetId && r.kind === tie.kind
                    ? { ...r, lastAttentionOnDay: day }
                    : r)
        };
    }
    recordMasterTaken(state, state.npcs[at.get(junior.id)!]!, state.npcs[at.get(master.id)!]!, null, day);
}

/**
 * The chance in one year that a master short of the disciples they would take,
 * and not looking, decides they want one.
 *
 * Looking used to be a state only the world's opening could put anybody in, so
 * everybody who reached an elder rung in play went their whole life never
 * wanting a disciple, and a world at 120 years had nobody looking at all. Set so
 * the standing share stays near what the world opens with (about a fifth to a
 * quarter of the masters): searches now run years or decades, so the rate that
 * balances them is small.
 */
export const A_MASTER_SHORT_OF_A_DISCIPLE_STARTS_LOOKING_IN_A_YEAR = 0.015;

/**
 * Masters who decide this year that they want a disciple. Mutates `state`.
 * Returns how many started looking.
 *
 * Somebody who takes disciples ({@link takesDisciples}), is short of the few they
 * would take ({@link A_MASTER_TAKES_AT_MOST}) and is not already looking. Their
 * goal says what they look for, exactly as the opening's does, so everything
 * that reads a search reads these the same.
 */
export function mastersShortOfADiscipleStartLooking(state: WorldState, day: number): number {
    const houses = new Map(state.factions.map(f => [f.id, f] as const));
    let started = 0;
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i]!;
        if (npc.status !== 'alive' || npc.factionId === null) continue;
        const house = houses.get(npc.factionId);
        if (!house || house.dissolvedOnDay !== null) continue;
        if (!takesDisciples(npc, house.ranks.length)) continue;
        if (theirSearchForADisciple(npc)) continue;
        // Disciples, counted as people.
        const theirs = new Set(npc.relationships.filter(r => r.kind === 'disciple').map(r => r.targetId));
        if (theirs.size >= A_MASTER_TAKES_AT_MOST) continue;
        if (!forStream(state.seed, 'a-master-decides-they-want-a-disciple', npc.id, String(day))
            .chance(A_MASTER_SHORT_OF_A_DISCIPLE_STARTS_LOOKING_IN_A_YEAR)) continue;
        state.npcs[i] = addGoal(npc, { kind: 'other', text: whatTheyLookFor(npc), note: A_MASTER_LOOKING }, day);
        started++;
    }
    return started;
}

/**
 * How cold a bond has to have gone before either end thinks about ending it, and
 * the chance in a year that one of them does.
 *
 * The design owner, taking the neglect penalty out: *"either they terminate the
 * relationship or they don't"*, and *"how they feel about you is still counted"*.
 * So this is the only thing that ends a living bond, and it reads the standing
 * the ordinary warmth rules move (`theStandingOfALongSilence`): a bond nobody has
 * tended for decades goes cold, and a cold bond is one somebody eventually puts
 * down. Not immediately, and not always - people carry dead bonds for centuries.
 *
 * MEASURED, AND THE SHAPE THAT SENT IT BACK. Three worlds, fifteen centuries:
 * 628, 466 and 527 bonds ended - 31 to 42 a century, flat from the second
 * century to the fifteenth - while the standing master ties rose to a peak
 * around year 1300 (273, 242, 258) and then HALVED by 2500 (112, 156, 130),
 * with masters looking for one climbing from 22 to 98 over the same stretch.
 * The world was consuming bonds faster than it made them, against a ruling that
 * a bond is for LIFE.
 *
 * So the ending is stated in a mortal life and thinned by the span of whoever
 * does it ({@link THE_LIFE_AN_ENDING_IS_STATED_IN}), the same correction
 * `why-somebody-walks-out-of-a-compound.ts` makes: a cold bond is put down
 * about as often over a life however long that life is, rather than at the same
 * rate every year of a life that runs to millennia.
 */
export const A_BOND_IS_COLD_AT = 0.05;
export const A_COLD_BOND_ENDS_IN_A_YEAR = 0.05;

/** The life the rate above is stated in: a mortal's, `lifespanForOrdinal(0)`. */
export const THE_LIFE_AN_ENDING_IS_STATED_IN = lifespanForOrdinal(0);

/**
 * The bonds somebody ended this year. Mutates `state`. Returns how many ended.
 *
 * Both directions, because both exist: a master casts a disciple out, a disciple
 * walks out on a master. What is left is what `whatEndingABondLeaves` says is
 * left - a `former_` tie at each end, harder on the end that was walked out on -
 * and the day it happened, on both their lives (`recordABondEnded`).
 */
export function aBondSomebodyEnds(state: WorldState, day: number): number {
    const at = new Map(state.npcs.map((n, i) => [n.id, i] as const));
    let ended = 0;
    for (const person of [...state.npcs]) {
        if (person.status !== 'alive') continue;
        for (const tie of person.relationships) {
            if (tie.kind !== 'disciple' && tie.kind !== 'master') continue;
            if (tie.standing > A_BOND_IS_COLD_AT) continue;
            const j = at.get(tie.targetId);
            if (j === undefined) continue;
            const other = state.npcs[j]!;
            if (other.status !== 'alive') continue;
            // A YEAR IS A SHARE OF A LIFE, and the life is the one of the person
            // doing the ending. Ending a bond is an act somebody performs, so it
            // is theirs to be slow about: somebody who will live two thousand
            // years is not twenty times likelier to put a disciple down this
            // year than a mortal is, they are as likely to do it ONCE over the
            // life they have.
            const ofALife = THE_LIFE_AN_ENDING_IS_STATED_IN
                / Math.max(THE_LIFE_AN_ENDING_IS_STATED_IN,
                    lifespanForOrdinal(person.cultivation.realmOrdinal));
            if (!forStream(state.seed, 'a-bond-somebody-ends', person.id, tie.targetId, String(day))
                .chance(A_COLD_BOND_ENDS_IN_A_YEAR * ofALife)) continue;

            const endedBy: 'master' | 'disciple' = tie.kind === 'disciple' ? 'master' : 'disciple';
            const master = tie.kind === 'disciple' ? person : other;
            const disciple = tie.kind === 'disciple' ? other : person;
            const left = whatEndingABondLeaves({
                master: { id: master.id, name: master.name, ordinal: master.cultivation.realmOrdinal },
                student: { id: disciple.id, name: disciple.name, ordinal: disciple.cultivation.realmOrdinal },
                onDay: day,
                walkedAway: endedBy,
                stoodForDays: Math.max(0, day - tie.sinceDay)
            });
            for (const row of left.ties) {
                const k = at.get(row.holderId);
                if (k === undefined) continue;
                // The live kind BECOMES the former one. Rows are keyed by the
                // pair and the kind, so writing `former_disciple` beside a
                // standing `disciple` row would end nothing.
                const was = row.kind === 'former_disciple' ? 'disciple' : 'master';
                state.npcs[k] = theTieBecomes(state.npcs[k]!, row.targetId, was, row.kind, day, {
                    standing: row.standing, note: row.note
                });
            }
            recordABondEnded(state, state.npcs[at.get(disciple.id)!]!, state.npcs[at.get(master.id)!]!, endedBy, day);
            ended++;
            break;
        }
    }
    return ended;
}

/**
 * How readily one master takes somebody on, as a multiplier on the chance a
 * junior who fits is taken in a year. Their own disposition, and nothing about
 * the junior: {@link A_PICKY_MASTER} takes almost nobody and can spend a
 * century looking, {@link A_READY_MASTER} takes the first person who fits.
 */
export const A_PICKY_MASTER = 0.05;
export const A_READY_MASTER = 1;

/**
 * How readily this master takes somebody on. Drawn once off their id, so it is
 * the same disposition every year of their life.
 */
export function howReadilyTheyTake(seed: string, masterId: string): number {
    const roll = forStream(seed, 'how-readily-a-master-takes-a-disciple', masterId).next();
    // Weighted toward the picky end: most masters who are looking are looking
    // for somebody in particular, which is why they are still looking.
    return A_PICKY_MASTER + (A_READY_MASTER - A_PICKY_MASTER) * roll * roll;
}

/**
 * A master looking for a disciple takes one, when somebody who fits what they
 * want crosses their path. Mutates `state`. Returns the bonds made.
 *
 * NOT AN ANNUAL PICK OF THE BEST ONE FOUND. The design owner: *"a master doesn't
 * necessarily take the best one they found within a year."* Taking a disciple is
 * a decision, not an optimisation, and a master with three centuries left has no
 * reason to settle. So the pass walks the juniors of their own house standing
 * where they are, in no order of merit, and asks of each the two questions a
 * master actually asks: does this one fit what I want (an element of my root, an
 * art I carry, or talent enough to be worth the years), and did they impress me
 * enough this year. The second is {@link howReadilyTheyTake} against the share
 * their rung is taken at ({@link theShareTakenAt}), so a picky master can pass
 * over everybody for decades and the bottom of a house stays mostly without a
 * master however long its elders spend looking.
 *
 * A heavenly seedling is the exception that moves even a picky master, and is
 * taken when one appears.
 */
export function searchingMastersTakeADisciple(state: WorldState, day: number): number {
    const at = new Map(state.npcs.map((n, i) => [n.id, i] as const));
    const houses = new Map(state.factions.map(f => [f.id, f] as const));
    const takenThisYear = new Set<string>();
    let made = 0;
    // First, the masters who decided this year that they want one. See
    // `mastersShortOfADiscipleStartLooking`: without it, looking was a state
    // only the world's opening could put anybody in, and everybody promoted to
    // an elder rung afterwards went their whole life never wanting a disciple.
    mastersShortOfADiscipleStartLooking(state, day);
    // And the bonds one of the two put down this year.
    aBondSomebodyEnds(state, day);
    for (const looking of [...state.npcs]) {
        if (looking.status !== 'alive' || looking.factionId === null) continue;
        const search = theirSearchForADisciple(looking);
        const house = houses.get(looking.factionId);
        // A master who is not looking still notices a seedling in front of them.
        if (!search) {
            if (house && house.dissolvedOnDay === null && takesDisciples(looking, house.ranks.length)) {
                const seedling = state.npcs.find(n => n.status === 'alive' && n.factionId === house.id
                    && !takenThisYear.has(n.id) && n.locationId === looking.locationId && isAHeavenlySeedling(n)
                    && theShareTakenAt(n.factionRankIndex, house.ranks.length) > 0
                    && n.factionRankIndex < looking.factionRankIndex
                    && n.cultivation.realmOrdinal < looking.cultivation.realmOrdinal
                    && freeToBeTakenBy(n, looking));
                if (seedling) {
                    takesThemOn(state, at, state.npcs[at.get(looking.id)!]!, seedling, day);
                    takenThisYear.add(seedling.id);
                    made++;
                }
            }
            continue;
        }
        if (!house || house.dissolvedOnDay !== null) continue;
        const rankCount = house.ranks.length;
        const master = state.npcs[at.get(looking.id)!]!;
        const readily = howReadilyTheyTake(state.seed, master.id);
        const crossedTheirPath = state.npcs
            .filter(n => n.status === 'alive' && n.factionId === house.id && n.id !== master.id
                && !takenThisYear.has(n.id)
                && n.locationId === master.locationId
                && theShareTakenAt(n.factionRankIndex, rankCount) > 0
                && n.factionRankIndex < master.factionRankIndex
                && n.cultivation.realmOrdinal < master.cultivation.realmOrdinal
                && freeToBeTakenBy(n, master))
            // In no order of merit: whoever they happened to be standing near.
            .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

        let took: NpcRecord | null = null;
        for (const junior of crossedTheirPath) {
            const seedling = isAHeavenlySeedling(junior);
            // DOES THIS ONE FIT WHAT I WANT. An element of the master's root, an
            // art they carry, or talent enough that the years would not be
            // wasted. Somebody who fits none of it is not a disciple they are
            // short of; it is somebody they will nod to for another decade.
            if (!seedling && fits(master, junior) === 0 && howPromising(junior) < WORTH_THE_YEARS_WITHOUT_A_FIT) continue;
            // AND DID THEY IMPRESS ME THIS YEAR. Against the master's own
            // disposition, so a picky one passes over people who fit for
            // decades. A seedling moves even them.
            const chance = seedling ? 1 : readily * theChanceTheyAreTaken(junior, rankCount);
            if (!forStream(state.seed, 'a-master-looking-finds-one', master.id, junior.id, String(day)).chance(chance)) continue;
            took = junior;
            break;
        }
        if (!took) continue;
        takesThemOn(state, at, master, took, day);
        const i = at.get(master.id)!;
        // The goal's note is what finds it, so it keeps it.
        state.npcs[i] = closeGoal(state.npcs[i]!, search.id, 'achieved', day);
        takenThisYear.add(took.id);
        made++;
    }
    return made;
}
