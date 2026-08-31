/**
 * Pressure: the world changing on its own.
 *
 * This is the driver the world layer was missing. Seeding produces a populated
 * world; `advanceTime` moves the clock and fires what was already on the books;
 * neither of them makes anything NEW happen. Without this module a player sits
 * in seclusion for forty years, comes out, and finds that the only thing that
 * occurred is that some old people died of old age.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE LINE THIS MODULE HOLDS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * It schedules THAT SOMETHING HAPPENED. It does not decide WHY anyone did it.
 *
 *   in scope      a sect loses a vein; an elder dies; a ruin is opened by
 *                 somebody else; a border moves; a deference zone is tested; a
 *                 faction folds; a war opens and, years later, settles
 *   out of scope  what the elder was thinking; whether the rival was right to
 *                 move; what anybody says about it afterwards
 *
 * The first list is weighted tables, seeded rolls and state updates, which is
 * code's job. The second is the LLM's, and it reads the resulting facts and
 * reasons from them. There is deliberately no personality model, no incentive
 * scoring and no decision tree here - that engine was written once, deleted on
 * purpose, and is not coming back.
 *
 * ── Binding to real things ───────────────────────────────────────────────
 *
 * Every template BINDS before it applies. `vein_lost` does not invent a vein:
 * it looks for a faction that actually holds one and a rival that actually
 * wants it, and if the world does not currently offer that pair, the template
 * declines and another is drawn. So the events that happen are the ones the
 * world's own state makes available, and a province with one faction left stops
 * producing sect wars because there is nobody to fight.
 *
 * ── Every event writes real state ────────────────────────────────────────
 *
 * A vein changing hands moves `controllingFactionId`, appends a
 * `LocationChange`, moves both treasuries, and deepens the standing between the
 * two factions - and only then writes the chronicle fact. Narration describes a
 * state change that actually happened, or there was no event.
 *
 * ── Determinism ──────────────────────────────────────────────────────────
 *
 * Keyed per YEAR, from `forStream(seed, 'pressure', year)`. The events of year
 * 1,412 are the same whether the simulation reached it in one advance or forty,
 * which is what keeps the split-advance property true once the driver is in the
 * loop.
 */

import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import { rankName } from '../cultivation/realms.js';
import {
    appendFact,
    fillConsequences,
    makeFact,
    yearOfDay,
    type EventConsequences,
    type HistoricalFact
} from './history.js';
import { applyLocationChange, forbidZone, type LocationRecord } from './locations.js';
import { claimOpportunity, nextWindow, years } from './opportunities.js';
import {
    addGoal,
    createNpc,
    markDead,
    markMissing,
    setRealm,
    upsertRelationship,
    type NpcRecord
} from './npc-state.js';
import { addLineageEdge, createLineageRecord } from './lineage.js';
import { deriveOrdinal } from './seeding.js';
import { settleNpcDeath, type DeathHandoff } from './time.js';
import {
    makeFaction,
    type FactionRecord,
    type ScheduledEffect,
    type WorldState
} from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// SHAPE
// ─────────────────────────────────────────────────────────────────────────

export type PressureKind =
    | 'vein_lost'
    | 'elder_died'
    | 'ruin_opened'
    | 'opportunity_taken'
    | 'border_moved'
    | 'deference_tested'
    | 'faction_fell'
    | 'faction_founded'
    | 'technique_lost'
    | 'market_shifted'
    | 'war_opened'
    | 'war_settled'
    | 'zone_forbidden'
    | 'migration'
    | 'disappearance';

export interface PressureEvent {
    kind: PressureKind;
    onDay: number;
    fact: HistoricalFact;
    /** Ids of anything whose state this actually moved. */
    touched: { factions: string[]; locations: string[]; npcs: string[] };
    deaths: DeathHandoff[];
}

export interface PressureResult {
    events: PressureEvent[];
    /** Years actually stepped. Zero when the span held no whole year. */
    yearsStepped: number;
    /** People born into the world across the span. */
    born: number;
}

/**
 * Events per year for a world of this size.
 *
 * Scaled off live factions rather than fixed, so a world that has lost most of
 * its institutions goes quiet - which is the correct behaviour and is also what
 * a late age is supposed to feel like.
 */
export const EVENTS_PER_FACTION_YEAR = 0.055;
/** Floor, so even a nearly dead world is not silent. */
export const MIN_EVENTS_PER_YEAR = 0.15;
/** Ceiling, so a large world does not become a newsfeed. */
export const MAX_EVENTS_PER_YEAR = 3;

export interface PressureOptions {
    /** Multiplier on the event rate. For tests and for tuning. */
    intensity?: number;
    /** Cap on events applied in one call, whatever the span. */
    maxEvents?: number;
}

// ─────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Advance the world's own affairs across a span.
 *
 * Mutates `state` in place. It is called from the driver after the clock has
 * moved, over exactly the span that was actually advanced, so an interrupted
 * seclusion does not get a decade of consequences it never lived through.
 */
export function applyPressure(
    state: WorldState,
    fromDay: number,
    toDay: number,
    opts: PressureOptions = {}
): PressureResult {
    const events: PressureEvent[] = [];
    const intensity = opts.intensity ?? 1;
    const maxEvents = opts.maxEvents ?? 4000;

    const firstYear = yearOfDay(fromDay) + 1;
    const lastYear = yearOfDay(toDay);
    let yearsStepped = 0;
    let born = 0;

    for (let year = firstYear; year <= lastYear && events.length < maxEvents; year++) {
        yearsStepped++;
        const rng = forStream(state.seed, 'pressure', year);
        const live = state.factions.filter(f => f.dissolvedOnDay === null).length;
        const rate = clamp(
            live * EVENTS_PER_FACTION_YEAR * intensity,
            MIN_EVENTS_PER_YEAR * intensity,
            MAX_EVENTS_PER_YEAR * intensity
        );

        // Whole events plus a fractional chance at one more. Cheap, stable, and
        // it lets a rate below one still produce something occasionally.
        let count = Math.floor(rate);
        if (rng.chance(rate - count)) count++;

        for (let i = 0; i < count && events.length < maxEvents; i++) {
            // The draw is unconditional so the stream does not depend on where
            // the span happens to end; the DATE is clamped, because a fact
            // dated after the world's own clock is incoherent and the soak
            // rightly refuses it.
            const day = withinSpan(year * 365 + rng.int(0, 364), fromDay, toDay);
            const event = fireOne(state, day, forStream(state.seed, 'pressure-event', year, i));
            if (event) events.push(event);
        }

        // Then the parts of a year that are arithmetic rather than incident:
        // people advance, institutions pay their bills, and children are born.
        // Births last, so a year's dead are counted before its replacements.
        applyAdvancement(state, year, withinSpan(year * 365 + 120, fromDay, toDay));
        applyFactionEconomy(state);
        born += applyDemography(state, year, withinSpan(year * 365 + 180, fromDay, toDay), rng).length;
    }

    return { events, yearsStepped, born };
}

/**
 * People keep being born.
 *
 * Not a weighted event - a steady demographic floor, run every year, closing
 * the gap between the living population and what the world can carry. Without
 * it five centuries produce an empty province and a set of factions that folded
 * for want of members, which is a modelling artefact rather than history.
 *
 * Newcomers are generated exactly the way everybody else is: root and
 * attributes rolled from the world seed, realm DERIVED from those inputs over
 * the years they have lived, capped by the province they were born in. Where a
 * living parent is available they are attached to that lineage, which is what
 * makes a descendant three centuries later something the world can point at.
 */
function applyDemography(
    state: WorldState,
    year: number,
    day: number,
    rng: CultivationRNG
): NpcRecord[] {
    const target = state.populationTarget;
    if (target <= 0) return [];

    let living = 0;
    for (const npc of state.npcs) if (npc.status === 'alive') living++;
    const deficit = target - living;
    if (deficit <= 0) return [];

    // A fraction of the gap each year, so a plague is felt for a generation
    // rather than papered over the following spring.
    const count = Math.min(24, Math.max(1, Math.round(deficit * 0.08)));
    const regions = state.locations.filter(l => l.kind === 'region');
    if (regions.length === 0) return [];

    const born: NpcRecord[] = [];
    for (let i = 0; i < count; i++) {
        const id = `npc-${state.nextNpcSeq++}`;
        const own = forStream(state.seed, 'birth', id);
        const region = regions[own.int(0, regions.length - 1)];
        const ceiling = Number(region.data.localCeilingOrdinal ?? 20);
        const rateMultiplier = Number(region.data.ambientRateMultiplier ?? 1);
        const age = own.int(16, 22);

        let npc = createNpc(state.seed, {
            id,
            bornOnDay: day - years(age),
            onDay: day,
            locationId: region.id,
            occupation: 'unknown',
            tags: [`region:${String(region.data.catalogRegionId ?? region.id)}`]
        });
        const ordinal = deriveOrdinal(
            npc.cultivation.spiritRoot,
            npc.cultivation.attributes,
            age,
            rateMultiplier,
            ceiling,
            own
        );
        npc = setRealm(npc, ordinal, day);
        npc = addGoal(npc, {
            kind: 'cultivation',
            text: 'Get somewhere. Anywhere.',
            priority: 0.5,
            obstacles: ['Born here.']
        }, day);

        // A parent, where the world has one to offer: same region, old enough,
        // and alive. Lineage is what long time-skips land on.
        const candidates = state.npcs.filter(
            n => n.status === 'alive' &&
                n.locationId === region.id &&
                day - n.identity.bornOnDay >= years(age + 18)
        );
        if (candidates.length > 0) {
            const parent = candidates[own.int(0, candidates.length - 1)];
            const surname = parent.name.split(' ')[0];
            npc = { ...npc, name: `${surname} ${npc.name.split(' ').slice(1).join(' ')}`.trim() };
            const lineageId = `lin-${surname.toLowerCase()}`;
            let lineage = state.lineages.find(l => l.id === lineageId);
            if (!lineage) {
                lineage = createLineageRecord({
                    id: lineageId,
                    surname,
                    founderId: parent.id,
                    foundedOnDay: parent.identity.bornOnDay
                });
                state.lineages.push(lineage);
            }
            const next = addLineageEdge(lineage, {
                parentId: parent.id,
                childId: npc.id,
                relation: 'descendant',
                onDay: npc.identity.bornOnDay
            });
            const at = state.lineages.findIndex(l => l.id === lineageId);
            if (at >= 0) state.lineages[at] = next;
        }

        // A faction that takes applicants takes applicants. Without this the
        // rolls only ever shrink: every founding member dies inside two
        // centuries and nobody replaces them, and the institutions fold for a
        // reason that is arithmetic rather than history.
        const admitting = state.factions.filter(
            f => f.dissolvedOnDay === null &&
                f.tags.includes('recruits') &&
                f.seatLocationId === region.id &&
                ordinal >= Number(f.resources.admission_ordinal ?? 0)
        );
        if (admitting.length > 0 && own.chance(0.45)) {
            const joined = admitting[own.int(0, admitting.length - 1)];
            npc = { ...npc, factionId: joined.id, factionRankIndex: 0 };
        }

        state.npcs.push(npc);
        born.push(npc);
    }
    void rng;
    void year;
    return born;
}

/**
 * People keep cultivating.
 *
 * Not a behaviour model - the same closed-form derivation seeding uses, run
 * again against the age they have now. Without it the population's realms are
 * frozen at the moment of seeding: elders never emerge, the factions' power
 * never moves, and after five centuries every cultivator in the world is
 * exactly as strong as the day they were born.
 *
 * A sample per year rather than the whole roster, keyed per NPC and year, so
 * the cost is a constant and the outcome is decomposable. A realm only ever
 * goes up here; losing one is the cultivation engine's business, not this
 * module's.
 */
function applyAdvancement(state: WorldState, year: number, day: number): NpcRecord[] {
    const living: number[] = [];
    for (let i = 0; i < state.npcs.length; i++) {
        if (state.npcs[i].status === 'alive') living.push(i);
    }
    if (living.length === 0) return [];

    const sample = Math.max(1, Math.round(living.length / 40));
    const advanced: NpcRecord[] = [];
    const rng = forStream(state.seed, 'advancement', year);

    for (let s = 0; s < sample; s++) {
        const at = living[rng.int(0, living.length - 1)];
        const npc = state.npcs[at];
        if (npc.status !== 'alive') continue;

        const regionTag = npc.tags.find(t => t.startsWith('region:'))?.slice(7);
        const region = state.locations.find(
            l => l.kind === 'region' && String(l.data.catalogRegionId ?? '') === regionTag
        ) ?? state.locations.find(l => l.id === npc.locationId);
        const ceiling = Number(region?.data.localCeilingOrdinal ?? 20);
        const rateMultiplier = Number(region?.data.ambientRateMultiplier ?? 1);
        const age = Math.floor((day - npc.identity.bornOnDay) / 365);

        const derived = deriveOrdinal(
            npc.cultivation.spiritRoot,
            npc.cultivation.attributes,
            age,
            rateMultiplier,
            ceiling,
            forStream(state.seed, 'advance-npc', npc.id)
        );
        if (derived <= npc.cultivation.realmOrdinal) continue;

        state.npcs[at] = setRealm(npc, derived, day);
        advanced.push(state.npcs[at]);
    }
    return advanced;
}

/**
 * Factions pay for themselves, or they do not.
 *
 * A vein is income; members and tribute are cost. That is the whole model, and
 * it is enough: a sect holding a vein it can work stays solvent, one that has
 * lost its vein starts dying immediately, and one that pays a large tribute
 * upward lives closer to the line than one that answers to nobody. The
 * `faction_fell` template then binds to whoever the arithmetic has already
 * ruined, rather than picking a victim.
 */
function applyFactionEconomy(state: WorldState): void {
    for (const faction of state.factions) {
        if (faction.dissolvedOnDay !== null) continue;
        let members = 0;
        for (const npc of state.npcs) {
            if (npc.status === 'alive' && npc.factionId === faction.id) members++;
        }
        const veins = faction.resources.veins ?? 0;
        const production = Number(faction.resources.production ?? 0.5);
        const income = veins * 5_000 * (0.5 + production) + members * 30;
        const upkeep = members * 45 + (faction.resources.tribute_owed_per_year ?? 0) * 0.1;
        faction.resources.spirit_stones = Math.max(
            0,
            Math.round((faction.resources.spirit_stones ?? 0) + income - upkeep)
        );
        faction.resources.members = members;
    }
}

/**
 * Draw a template, bind it, apply it.
 *
 * Templates that cannot bind are skipped and the draw is retried a bounded
 * number of times. Returning null is a legitimate outcome: a year in which the
 * world offered nothing worth recording is a year in which nothing happened,
 * and long mundane stretches are correct.
 */
function fireOne(state: WorldState, day: number, rng: CultivationRNG): PressureEvent | null {
    const table = TEMPLATES;
    const total = table.reduce((sum, t) => sum + t.weight, 0);

    for (let attempt = 0; attempt < 6; attempt++) {
        let cursor = rng.next() * total;
        let chosen = table[table.length - 1];
        for (const t of table) {
            cursor -= t.weight;
            if (cursor < 0) {
                chosen = t;
                break;
            }
        }
        const event = chosen.apply(state, day, rng);
        if (event) return event;
    }
    return null;
}

interface Template {
    kind: PressureKind;
    weight: number;
    /** Returns null when the world offers nothing for this template to act on. */
    apply(state: WorldState, day: number, rng: CultivationRNG): PressureEvent | null;
}

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

function liveFactions(state: WorldState): FactionRecord[] {
    return state.factions.filter(f => f.dissolvedOnDay === null);
}

function pick<T>(rng: CultivationRNG, items: readonly T[]): T | null {
    return items.length === 0 ? null : items[rng.int(0, items.length - 1)];
}

function membersOf(state: WorldState, factionId: string): NpcRecord[] {
    return state.npcs.filter(n => n.factionId === factionId && n.status === 'alive');
}

function veinsOf(state: WorldState, factionId: string): LocationRecord[] {
    return state.locations.filter(l => l.kind === 'vein' && l.controllingFactionId === factionId);
}

function replaceLocation(state: WorldState, next: LocationRecord): void {
    const at = state.locations.findIndex(l => l.id === next.id);
    if (at >= 0) state.locations[at] = next;
}

function replaceNpc(state: WorldState, next: NpcRecord): void {
    const at = state.npcs.findIndex(n => n.id === next.id);
    if (at >= 0) state.npcs[at] = next;
}

/**
 * Somebody takes it personally.
 *
 * Institutions hold positions; people hold accounts, and only the personal row
 * is inheritable - a faction's hostility dies with the faction, whereas a
 * grudge outlives its owner and lands on an heir. So whenever one faction takes
 * something from another, one named member of each side ends up in a row
 * together. Which two is a draw; that it happens at all is not.
 *
 * This is a state update, not a decision model: nobody here reasons about
 * whether to be aggrieved.
 */
function openPersonalAccount(
    state: WorldState,
    loserId: string,
    winnerId: string,
    day: number,
    note: string,
    rng: CultivationRNG
): string[] {
    const aggrieved = pick(rng, membersOf(state, loserId));
    const taker = pick(rng, membersOf(state, winnerId));
    if (!aggrieved || !taker) return [];
    const at = state.npcs.findIndex(n => n.id === aggrieved.id);
    if (at < 0) return [];
    state.npcs[at] = upsertRelationship(state.npcs[at], {
        targetId: taker.id,
        targetName: taker.name,
        kind: 'enemy',
        standing: -0.75,
        note
    }, day);
    return [aggrieved.id, taker.id];
}

function adjustStandingBetween(a: FactionRecord, b: FactionRecord, delta: number): void {
    a.standing[b.id] = clamp((a.standing[b.id] ?? 0) + delta, -1, 1);
    b.standing[a.id] = clamp((b.standing[a.id] ?? 0) + delta, -1, 1);
}

/** Factions that have a reason to move against this one. */
function rivalsOf(state: WorldState, faction: FactionRecord): FactionRecord[] {
    return liveFactions(state).filter(
        f => f.id !== faction.id && (f.standing[faction.id] ?? 0) <= -0.3
    );
}

function emit(
    state: WorldState,
    kind: PressureKind,
    day: number,
    fact: Omit<Parameters<typeof makeFact>[0], 'consequences'> & {
        consequences?: Partial<EventConsequences>;
        /**
         * What a player who cannot name any of the actors would notice instead.
         * Stored on the fact so the digest can render an unattributed
         * consequence without inventing one.
         */
        unattributed: string;
    },
    touched: Partial<PressureEvent['touched']> = {},
    deaths: DeathHandoff[] = []
): PressureEvent {
    const { consequences, unattributed, ...rest } = fact;
    const stored = appendFact(state.history, makeFact({
        ...rest,
        consequences: consequences ? fillConsequences(consequences) : null,
        data: { ...(rest.data ?? {}), unattributed, pressure: kind }
    }));
    return {
        kind,
        onDay: day,
        fact: stored,
        touched: {
            factions: touched.factions ?? [],
            locations: touched.locations ?? [],
            npcs: touched.npcs ?? []
        },
        deaths
    };
}

/**
 * Keep a generated date inside the span that was actually advanced.
 *
 * A year is stepped as a whole even when the caller asked for part of one, so
 * an event drawn late in the year can fall past the clock. Clamping the date
 * rather than skipping the event keeps the year's content intact and the
 * ledger coherent - nothing is ever dated after the day the world has reached.
 */
function withinSpan(day: number, fromDay: number, toDay: number): number {
    return Math.max(fromDay, Math.min(toDay, day));
}

function clamp(n: number, lo: number, hi: number): number {
    if (!Number.isFinite(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
}

// ─────────────────────────────────────────────────────────────────────────
// THE TABLE
// Weights are relative. Ordinary institutional churn is common; a faction
// ending is rare; a region turning forbidden is rarer still.
// ─────────────────────────────────────────────────────────────────────────

const TEMPLATES: Template[] = [
    // ── A vein changes hands. The single most consequential thing that can
    //    happen to a sect, because the vein is its whole ability to produce
    //    cultivators. ────────────────────────────────────────────────────
    {
        kind: 'vein_lost',
        weight: 12,
        apply(state, day, rng) {
            const holders = liveFactions(state).filter(f => veinsOf(state, f.id).length > 0);
            const loser = pick(rng, holders);
            if (!loser) return null;
            const vein = pick(rng, veinsOf(state, loser.id));
            if (!vein) return null;

            const contenders = rivalsOf(state, loser);
            const federatedSeizure = loser.tags.includes('federated') && contenders.length === 0;
            const winner = pick(rng, contenders);
            if (!winner && !federatedSeizure) return null;

            const changed = applyLocationChange(vein, {
                onDay: day,
                kind: 'conquered',
                summary: winner
                    ? `${vein.name} passed to the ${winner.name}.`
                    : `${vein.name} was withdrawn from the ${loser.name}; the grant was not renewed.`,
                causeKnown: true,
                patch: {
                    controllingFactionId: winner ? winner.id : null,
                    addTags: ['changed_hands']
                }
            });
            replaceLocation(state, changed.location);

            loser.controlledLocationIds = loser.controlledLocationIds.filter(id => id !== vein.id);
            loser.resources.veins = Math.max(0, (loser.resources.veins ?? 0) - 1);
            loser.resources.spirit_stones = Math.round((loser.resources.spirit_stones ?? 0) * 0.6);
            loser.tags = Array.from(new Set(loser.tags.concat('lost_vein')));
            if (winner) {
                winner.controlledLocationIds.push(vein.id);
                winner.resources.veins = (winner.resources.veins ?? 0) + 1;
                adjustStandingBetween(loser, winner, -0.3);

                openPersonalAccount(state, loser.id, winner.id, day, `Took ${vein.name}.`, rng);
            }

            return emit(state, 'vein_lost', day, {
                day,
                kind: 'resource_contested',
                scale: 'regional',
                summary: changed.change.summary,
                locationId: vein.id,
                factionIds: winner ? [loser.id, winner.id] : [loser.id],
                locationChangeIds: [changed.change.id],
                visibility: 'public',
                magnitude: 0.75,
                unattributed:
                    'The road up the gorge is closed to anyone without a token, and the ' +
                    'people collecting the toll are not the ones who were there before.',
                consequences: {
                    immediate: changed.change.summary,
                    physical: `Control of ${vein.name} moved.`,
                    beneficiaries: winner ? [{ id: winner.id, name: winner.name, role: 'holder' }] : [],
                    losers: [{ id: loser.id, name: loser.name, role: 'dispossessed' }],
                    factionReactions: [{ factionId: loser.id, reaction: 'Recalled its outer disciples.' }],
                    relationshipChanges: winner
                        ? [{ aId: loser.id, bId: winner.id, change: 'open hostility' }] : [],
                    opportunitiesOpened: ['Work for anyone who can survey a vein.'],
                    opportunitiesClosed: [`Admission to the ${loser.name} on the old terms.`],
                    rumours: ['That the grant was sold rather than lost.'],
                    tenYearsLater:
                        `The ${loser.name} produces fewer cultivators every decade, and everyone local knows it.`
                }
            }, {
                factions: winner ? [loser.id, winner.id] : [loser.id],
                locations: [vein.id]
            });
        }
    },

    // ── Somebody who mattered locally is gone. ───────────────────────────
    {
        kind: 'elder_died',
        weight: 16,
        apply(state, day, rng) {
            const seniors = state.npcs.filter(
                n => n.status === 'alive' && n.factionId != null && n.factionRankIndex >= 3
            );
            const npc = pick(rng, seniors);
            if (!npc) return null;
            const faction = state.factions.find(f => f.id === npc.factionId) ?? null;

            const cause = rng.chance(0.25)
                ? 'a breakthrough that did not hold'
                : rng.chance(0.4) ? 'an old wound' : 'age';
            replaceNpc(state, markDead(npc, day, `Died of ${cause}.`));
            const handoff = settleNpcDeath(state, npc, day);

            return emit(state, 'elder_died', day, {
                day,
                kind: 'death',
                scale: 'local',
                summary:
                    `${npc.name}, ${rankName(npc.cultivation.realmOrdinal)}` +
                    (faction ? ` of the ${faction.name}` : '') + `, died of ${cause}.`,
                actors: [{ id: npc.id, name: npc.name, role: 'deceased' }],
                locationId: npc.locationId,
                factionIds: faction ? [faction.id] : [],
                visibility: 'faction',
                magnitude: 0.4 + Math.min(0.4, npc.cultivation.realmOrdinal * 0.02),
                unattributed:
                    'A compound on the ridge has been in white for a month, and nobody there ' +
                    'is taking visitors.',
                consequences: {
                    immediate: `The seat ${npc.name} held is empty.`,
                    physical: '',
                    losers: handoff.primaryHeirId
                        ? [{ id: handoff.primaryHeirId, name: handoff.primaryHeirId, role: 'heir' }] : [],
                    tenYearsLater: handoff.goalsInherited.length > 0
                        ? 'What they were owed, and what they were owed for, is somebody else\'s now.'
                        : 'The account closed with them.'
                }
            }, {
                factions: faction ? [faction.id] : [],
                npcs: [npc.id]
            }, [handoff]);
        }
    },

    // ── Someone else got there first. ────────────────────────────────────
    {
        kind: 'ruin_opened',
        weight: 8,
        apply(state, day, rng) {
            const sealed = state.locations.filter(l => l.kind === 'ruin' && l.sealed);
            const ruin = pick(rng, sealed);
            if (!ruin) return null;
            const opener = pick(rng, state.npcs.filter(
                n => n.status === 'alive' && n.cultivation.realmOrdinal >= Math.max(0, ruin.thresholds.survival - 2)
            ));

            const changed = applyLocationChange(ruin, {
                onDay: day,
                kind: 'unsealed',
                summary: opener
                    ? `${ruin.name} was opened by ${opener.name}.`
                    : `${ruin.name} was found open. Nobody admits to it.`,
                causeKnown: opener != null,
                witnessed: false,
                patch: {
                    sealed: false,
                    discovered: true,
                    addTags: ['emptied'],
                    environment: { spiritualDensity: Math.min(1, ruin.qiDensity) }
                }
            });
            replaceLocation(state, changed.location);

            if (opener) {
                replaceNpc(state, {
                    ...opener,
                    cultivation: {
                        ...opener.cultivation,
                        techniqueIds: opener.cultivation.techniqueIds.concat(`recovered-${ruin.id}`)
                    }
                });
            }

            return emit(state, 'ruin_opened', day, {
                day,
                kind: 'ruin_opened',
                scale: 'local',
                summary: changed.change.summary,
                actors: opener ? [{ id: opener.id, name: opener.name, role: 'opener' }] : [],
                locationId: ruin.id,
                locationChangeIds: [changed.change.id],
                causes: ruin.originFactId ? [ruin.originFactId] : [],
                visibility: 'regional',
                magnitude: 0.55,
                unattributed:
                    'There is a new track up to the old compound, and somebody has been selling ' +
                    'things in the market town that nobody local knows how to make.',
                consequences: {
                    immediate: 'The seal is off.',
                    physical: `${ruin.name} is open.`,
                    opportunitiesClosed: ['Whatever was in there, for whoever comes next.'],
                    rumours: ['That most of it was already gone before they got in.'],
                    tenYearsLater: 'The site is picked over and the track has grown back.'
                }
            }, { locations: [ruin.id], npcs: opener ? [opener.id] : [] });
        }
    },

    // ── A window closed with somebody else standing in it. ───────────────
    {
        kind: 'opportunity_taken',
        weight: 9,
        apply(state, day, rng) {
            const open = state.opportunities.filter(o => {
                if (o.claimed && o.recurrenceDays === null) return false;
                const w = nextWindow(o, day - 30);
                return w != null && w.opensOnDay <= day && w.closesOnDay > day;
            });
            const opp = pick(rng, open);
            if (!opp) return null;
            const taker = pick(rng, state.npcs.filter(n => n.status === 'alive'));
            if (!taker) return null;

            const claim = claimOpportunity(opp, taker.id, day);
            if (!claim.ok) return null;
            const at = state.opportunities.findIndex(o => o.id === opp.id);
            if (at >= 0) state.opportunities[at] = claim.opportunity;

            return emit(state, 'opportunity_taken', day, {
                day,
                kind: 'opportunity',
                scale: 'local',
                summary: `${taker.name} took ${opp.name}.`,
                actors: [{ id: taker.id, name: taker.name, role: 'claimant' }],
                locationId: opp.locationId,
                factionIds: opp.factionIds.slice(),
                visibility: 'regional',
                magnitude: 0.4,
                unattributed:
                    'The price of what that ground produces has gone up, and the people who ' +
                    'usually gather it came back with nothing.',
                consequences: {
                    immediate: `${opp.name} is taken.`,
                    opportunitiesClosed: [opp.name],
                    tenYearsLater: 'Whoever took it is a little harder to refuse now.'
                }
            }, { npcs: [taker.id] });
        }
    },

    // ── A border moves, which mostly means a market town changes who it
    //    pays. ─────────────────────────────────────────────────────────────
    {
        kind: 'border_moved',
        weight: 7,
        apply(state, day, rng) {
            const settlements = state.locations.filter(l => l.kind === 'settlement');
            const place = pick(rng, settlements);
            if (!place) return null;
            const claimant = pick(rng, liveFactions(state));
            if (!claimant || claimant.id === place.controllingFactionId) return null;
            const previousId = place.controllingFactionId;
            const previous = previousId
                ? state.factions.find(f => f.id === previousId) ?? null : null;

            const changed = applyLocationChange(place, {
                onDay: day,
                kind: 'conquered',
                summary: `${place.name} answers to the ${claimant.name} now.`,
                causeKnown: true,
                patch: {
                    controllingFactionId: claimant.id,
                    environment: { politicalControl: `the ${claimant.name}` }
                }
            });
            replaceLocation(state, changed.location);
            claimant.controlledLocationIds = Array.from(
                new Set(claimant.controlledLocationIds.concat(place.id))
            );
            if (previous) {
                previous.controlledLocationIds = previous.controlledLocationIds.filter(id => id !== place.id);
                adjustStandingBetween(previous, claimant, -0.2);
                openPersonalAccount(
                    state, previous.id, claimant.id, day,
                    `Was collecting at ${place.name} until they were not.`, rng
                );
            }

            return emit(state, 'border_moved', day, {
                day,
                kind: 'territory_changed',
                scale: 'local',
                summary: changed.change.summary,
                locationId: place.id,
                factionIds: previous ? [previous.id, claimant.id] : [claimant.id],
                locationChangeIds: [changed.change.id],
                visibility: 'regional',
                magnitude: 0.45,
                unattributed:
                    'The people collecting the market tax are wearing a different colour, and ' +
                    'the rate is not what it was.',
                consequences: {
                    immediate: changed.change.summary,
                    physical: 'The boundary marker was moved.',
                    beneficiaries: [{ id: claimant.id, name: claimant.name, role: 'holder' }],
                    losers: previous ? [{ id: previous.id, name: previous.name, role: 'dispossessed' }] : [],
                    tenYearsLater: 'The older people still give directions using the old boundary.'
                }
            }, {
                factions: previous ? [previous.id, claimant.id] : [claimant.id],
                locations: [place.id]
            });
        }
    },

    // ── Somebody found out how far the zone actually runs. ───────────────
    {
        kind: 'deference_tested',
        weight: 6,
        apply(state, day, rng) {
            const deference = liveFactions(state).filter(f => f.tags.includes('deference'));
            const held = pick(rng, deference);
            if (!held) return null;
            const tester = pick(rng, liveFactions(state).filter(f => f.id !== held.id));
            if (!tester) return null;

            // Deference is respect, and respect is only real while it is not
            // being tested. Whether it holds is the roll; why anyone tried is
            // not this module's business.
            const holds = rng.chance(clamp(0.35 + (held.resources.power_ordinal ?? 17) / 60, 0.2, 0.9));
            adjustStandingBetween(held, tester, holds ? -0.15 : -0.35);
            if (!holds) {
                held.tags = Array.from(new Set(held.tags.concat('zone_shrunk')));
                held.resources.spirit_stones = Math.round((held.resources.spirit_stones ?? 0) * 0.85);
                openPersonalAccount(
                    state, held.id, tester.id, day,
                    'Moved a marker in and was not made to move it back.', rng
                );
            }

            return emit(state, 'deference_tested', day, {
                day,
                kind: 'territory_changed',
                scale: 'local',
                summary: holds
                    ? `The ${tester.name} moved a lease inward on the ${held.name} and was made to move it back.`
                    : `The ${tester.name} moved a lease inward on the ${held.name} and nothing happened.`,
                factionIds: [held.id, tester.id],
                visibility: 'faction',
                magnitude: holds ? 0.35 : 0.55,
                unattributed: holds
                    ? 'A survey party came back down the valley in a hurry and would not say why.'
                    : 'There are new markers on the north side of the valley, further in than they were.',
                consequences: {
                    immediate: holds ? 'The zone held.' : 'The zone is smaller than it was.',
                    tenYearsLater: holds
                        ? 'Nobody tries that side again for a generation.'
                        : 'Two more leases move inward, and nobody is told.'
                }
            }, { factions: [held.id, tester.id] });
        }
    },

    // ── An institution stops existing. ───────────────────────────────────
    {
        kind: 'faction_fell',
        weight: 3,
        apply(state, day, rng) {
            // Bind to whoever the economy has already ruined. Nobody is
            // chosen: a faction is here because it cannot pay, or because it
            // lost the vein that was its whole ability to produce cultivators
            // and has nobody left.
            const failing = liveFactions(state).filter(f =>
                (f.resources.spirit_stones ?? 0) < 400 ||
                membersOf(state, f.id).length < 3 ||
                (f.tags.includes('lost_vein') && membersOf(state, f.id).length < 6)
            );
            const faction = pick(rng, failing);
            if (!faction) return null;

            faction.dissolvedOnDay = day;
            const orphans = membersOf(state, faction.id);
            for (const npc of orphans) {
                replaceNpc(state, { ...npc, factionId: null, factionRankIndex: -1, updatedOnDay: day });
            }

            const seat = faction.seatLocationId
                ? state.locations.find(l => l.id === faction.seatLocationId) ?? null : null;
            const changeIds: string[] = [];
            if (seat) {
                const changed = applyLocationChange(seat, {
                    onDay: day,
                    kind: 'abandoned',
                    summary: `The ${faction.name}'s compound at ${seat.name} was left standing and empty.`,
                    causeKnown: true,
                    patch: {
                        controllingFactionId: null,
                        addTags: ['ruined'],
                        addHazards: ['formation'],
                        environment: { politicalControl: 'nobody, now' }
                    }
                });
                replaceLocation(state, changed.location);
                changeIds.push(changed.change.id);
            }

            return emit(state, 'faction_fell', day, {
                day,
                kind: 'faction_fallen',
                scale: 'regional',
                summary:
                    `The ${faction.name} ended after ` +
                    `${Math.max(0, yearOfDay(day) - yearOfDay(faction.foundedOnDay ?? day))} years. ` +
                    `${orphans.length} people are suddenly nobody's disciples.`,
                locationId: seat?.id ?? null,
                factionIds: [faction.id],
                locationChangeIds: changeIds,
                visibility: 'public',
                magnitude: 0.85,
                unattributed:
                    'A compound up the valley has been empty for a season, and people have ' +
                    'started taking the roof tiles.',
                consequences: {
                    immediate: 'The rolls are dissolved.',
                    physical: 'The compound stands empty and the formations are unlit.',
                    losers: [{ id: faction.id, name: faction.name, role: 'dissolved' }],
                    opportunitiesOpened: ['An empty compound, and whatever is still in it.'],
                    opportunitiesClosed: ['Admission, stipends, and the library.'],
                    rumours: ['That the last elder walked out with the treasury.'],
                    tenYearsLater: 'Somebody else is living in it, and did not build it.'
                }
            }, {
                factions: [faction.id],
                locations: seat ? [seat.id] : [],
                npcs: orphans.map(n => n.id)
            });
        }
    },

    // ── A splinter. Institutions do not only die; they divide. ───────────
    {
        kind: 'faction_founded',
        weight: 3,
        apply(state, day, rng) {
            const large = liveFactions(state).filter(f => membersOf(state, f.id).length >= 12);
            const parent = pick(rng, large);
            if (!parent) return null;
            const members = membersOf(state, parent.id)
                .sort((a, b) => b.cultivation.realmOrdinal - a.cultivation.realmOrdinal || (a.id < b.id ? -1 : 1));
            // Not the leader: the one under them, which is where splits come from.
            const founder = members[1];
            if (!founder) return null;

            const leavers = members.filter((_, i) => i > 0 && i % 3 === 1).slice(0, 6);
            const id = `sect-splinter-${founder.id}`;
            if (state.factions.some(f => f.id === id)) return null;

            const splinter = makeFaction({
                id,
                name: `the ${founder.name.split(' ')[0]} Hall`,
                kind: 'sect',
                alignment: parent.alignment,
                seatLocationId: founder.locationId,
                ranks: parent.ranks.slice(),
                resources: {
                    spirit_stones: Math.round((parent.resources.spirit_stones ?? 0) * 0.2),
                    veins: 0,
                    power_ordinal: founder.cultivation.realmOrdinal
                },
                description: `Split from the ${parent.name}.`,
                foundedOnDay: day,
                tags: ['unbacked', 'recruits', 'splinter']
            });
            splinter.standing[parent.id] = -0.5;
            parent.standing[splinter.id] = -0.5;
            parent.resources.spirit_stones = Math.round((parent.resources.spirit_stones ?? 0) * 0.8);
            state.factions.push(splinter);

            for (const npc of [founder, ...leavers]) {
                replaceNpc(state, {
                    ...npc,
                    factionId: splinter.id,
                    factionRankIndex: npc.id === founder.id ? splinter.ranks.length - 1 : 1,
                    updatedOnDay: day
                });
            }

            return emit(state, 'faction_founded', day, {
                day,
                kind: 'faction_founded',
                scale: 'regional',
                summary:
                    `${founder.name} left the ${parent.name} with ${leavers.length} others and ` +
                    `set up on their own.`,
                actors: [{ id: founder.id, name: founder.name, role: 'founder' }],
                locationId: founder.locationId,
                factionIds: [parent.id, splinter.id],
                visibility: 'public',
                magnitude: 0.6,
                unattributed:
                    'There is a second compound going up on the far side of the ridge, and the ' +
                    'people building it will not say who for.',
                consequences: {
                    immediate: `The ${parent.name} is smaller and angrier.`,
                    physical: 'A new compound.',
                    beneficiaries: [{ id: founder.id, name: founder.name, role: 'founder' }],
                    losers: [{ id: parent.id, name: parent.name, role: 'diminished' }],
                    relationshipChanges: [{ aId: parent.id, bId: splinter.id, change: 'a standing feud' }],
                    opportunitiesOpened: ['A sect that will take almost anybody, for now.'],
                    tenYearsLater: 'One of the two is clearly winning, and everyone local has an opinion.'
                }
            }, {
                factions: [parent.id, splinter.id],
                npcs: [founder.id, ...leavers.map(n => n.id)]
            });
        }
    },

    // ── The last person who could do a thing is gone. ────────────────────
    {
        kind: 'technique_lost',
        weight: 5,
        apply(state, day, rng) {
            const holders = state.npcs.filter(
                n => n.status === 'alive' && n.cultivation.techniqueIds.length > 0
            );
            const npc = pick(rng, holders);
            if (!npc) return null;
            const techniqueId = pick(rng, npc.cultivation.techniqueIds);
            if (!techniqueId) return null;

            // Only lost if nobody else alive has it. That is the whole rule.
            const others = state.npcs.filter(
                n => n.id !== npc.id && n.status === 'alive' && n.cultivation.techniqueIds.includes(techniqueId)
            );
            if (others.length > 0) return null;

            replaceNpc(state, markMissing(npc, day, 'Went out and did not come back.'));

            return emit(state, 'technique_lost', day, {
                day,
                kind: 'technique_lost',
                scale: 'regional',
                summary:
                    `${npc.name} was the last person known to be able to work ${techniqueId}, ` +
                    `and is no longer anywhere.`,
                actors: [{ id: npc.id, name: npc.name, role: 'last_holder' }],
                locationId: npc.locationId,
                visibility: 'faction',
                fidelity: 'partial',
                causeKnown: false,
                magnitude: 0.5,
                unattributed:
                    'The formation on the east gate has stopped working and nobody has been ' +
                    'able to restart it.',
                data: { techniqueId },
                consequences: {
                    immediate: 'Nobody living has been taught it.',
                    opportunitiesClosed: ['Learning it from anyone.'],
                    rumours: ['That there is a copy in the archive, mislabelled.'],
                    tenYearsLater: 'It is spoken of as something the sect used to be able to do.'
                }
            }, { npcs: [npc.id] });
        }
    },

    // ── Prices move, which is how most people experience politics. ───────
    {
        kind: 'market_shifted',
        weight: 10,
        apply(state, day, rng) {
            const regions = state.locations.filter(l => l.kind === 'region');
            const region = pick(rng, regions);
            if (!region) return null;
            const up = rng.chance(0.5);
            const factor = up ? rng.float(1.15, 1.9) : rng.float(0.55, 0.88);

            const changed = applyLocationChange(region, {
                onDay: day,
                kind: 'other',
                summary: up
                    ? `What ${region.name} sells got dearer.`
                    : `What ${region.name} sells got cheaper, and nobody there is pleased about it.`,
                causeKnown: false,
                patch: {
                    data: { priceFactor: Number(factor.toFixed(3)) }
                }
            });
            replaceLocation(state, changed.location);

            return emit(state, 'market_shifted', day, {
                day,
                kind: 'opportunity',
                scale: 'local',
                summary: changed.change.summary,
                locationId: region.id,
                locationChangeIds: [changed.change.id],
                visibility: 'public',
                fidelity: 'partial',
                causeKnown: false,
                magnitude: 0.3,
                unattributed: up
                    ? 'Everything in the market costs more than it did and nobody can say why.'
                    : 'The market is full of things nobody is buying.',
                data: { priceFactor: Number(factor.toFixed(3)) },
                consequences: {
                    immediate: 'Prices moved.',
                    tenYearsLater: 'The old price is what people quote when they are complaining.'
                }
            }, { locations: [region.id] });
        }
    },

    // ── A war opens now and settles later. The world generating its own
    //    future, which is what a schedule is for. ────────────────────────
    {
        kind: 'war_opened',
        weight: 5,
        apply(state, day, rng) {
            const live = liveFactions(state);
            const a = pick(rng, live);
            if (!a) return null;
            const b = pick(rng, rivalsOf(state, a));
            if (!b || a.tags.includes('at_war') || b.tags.includes('at_war')) return null;

            a.tags = a.tags.concat('at_war');
            b.tags = b.tags.concat('at_war');
            adjustStandingBetween(a, b, -0.3);

            const resolvesIn = years(rng.int(2, 25));
            const effect: ScheduledEffect = {
                id: `e${state.nextEffectSeq++}`,
                kind: 'war_resolves',
                dueOnDay: day + resolvesIn,
                summary: `The war between the ${a.name} and the ${b.name} came to an end.`,
                actorIds: [],
                locationId: null,
                factionId: a.id,
                repeatDays: null,
                interrupts: false,
                chance: 1,
                fired: false,
                firedOnDay: null,
                data: { kind: 'war_resolution', sideA: a.id, sideB: b.id, magnitude: 0.7 }
            };
            state.schedule.push(effect);

            return emit(state, 'war_opened', day, {
                day,
                kind: 'war',
                scale: 'regional',
                summary: `The ${a.name} and the ${b.name} are openly fighting.`,
                factionIds: [a.id, b.id],
                visibility: 'public',
                magnitude: 0.7,
                unattributed:
                    'The road east is not safe, the caravans have stopped, and there are more ' +
                    'people sleeping outside the walls than there were.',
                consequences: {
                    immediate: 'Both sides have recalled everyone they can reach.',
                    physical: 'The trade road is unusable.',
                    opportunitiesClosed: ['Travel east; the harvest contract.'],
                    opportunitiesOpened: ['Work for anyone who can fight, and pay for anyone who can heal.'],
                    rumours: ['That it is really about a vein, and the insult was arranged.'],
                    tenYearsLater: 'Whichever side lost is still smaller.'
                }
            }, { factions: [a.id, b.id] });
        }
    },

    // ── Ground stops being usable. Rare, permanent, and it makes geography.
    {
        kind: 'zone_forbidden',
        weight: 2,
        apply(state, day, rng) {
            const candidates = state.locations.filter(
                l => (l.kind === 'wilds' || l.kind === 'vein') && !l.tags.includes('forbidden')
            );
            const place = pick(rng, candidates);
            if (!place) return null;

            const { location, change } = forbidZone(place, {
                onDay: day,
                summary: `Something happened at ${place.name} and the ground has not been right since.`,
                survivalOrdinal: Math.min(29, place.thresholds.mastery + 6),
                hazards: ['corrosive', 'thin_qi'],
                causeKnown: false,
                attributedCauses: [
                    'A cultivator died here badly',
                    'An old formation finally failed',
                    'Somebody buried something'
                ]
            });
            replaceLocation(state, location);
            const holder = place.controllingFactionId
                ? state.factions.find(f => f.id === place.controllingFactionId) ?? null : null;
            if (holder) {
                holder.controlledLocationIds = holder.controlledLocationIds.filter(id => id !== place.id);
                holder.resources.veins = Math.max(0, (holder.resources.veins ?? 0) - 1);
            }

            return emit(state, 'zone_forbidden', day, {
                day,
                kind: 'zone_forbidden',
                scale: 'regional',
                summary: change.summary,
                locationId: place.id,
                factionIds: holder ? [holder.id] : [],
                locationChangeIds: [change.id],
                visibility: 'public',
                fidelity: 'partial',
                causeKnown: false,
                magnitude: 0.8,
                unattributed:
                    'Two villages on that side have moved, the animals will not go in, and the ' +
                    'people who went to look have not come back.',
                consequences: {
                    immediate: 'Nobody goes in.',
                    physical: `${place.name} is lethal to anyone local.`,
                    losers: holder ? [{ id: holder.id, name: holder.name, role: 'dispossessed' }] : [],
                    opportunitiesOpened: ['Whatever is in there, for somebody far stronger.'],
                    opportunitiesClosed: ['Everything that used to be gathered there.'],
                    rumours: ['Three different explanations, none of them checkable.'],
                    tenYearsLater: 'It is on the maps as a blank, and children are told not to.'
                }
            }, { locations: [place.id], factions: holder ? [holder.id] : [] });
        }
    },

    // ── People leave. ───────────────────────────────────────────────────
    {
        kind: 'migration',
        weight: 8,
        apply(state, day, rng) {
            const regions = state.locations.filter(l => l.kind === 'region');
            if (regions.length < 2) return null;
            const from = pick(rng, regions);
            const to = pick(rng, regions.filter(r => r.id !== from?.id));
            if (!from || !to) return null;

            const movers = state.npcs.filter(
                n => n.status === 'alive' && n.locationId === from.id && n.factionId === null
            ).slice(0, rng.int(3, 12));
            if (movers.length === 0) return null;

            for (const npc of movers) {
                replaceNpc(state, { ...npc, locationId: to.id, updatedOnDay: day });
            }

            return emit(state, 'migration', day, {
                day,
                kind: 'migration',
                scale: 'local',
                summary: `${movers.length} people left ${from.name} for ${to.name}.`,
                locationId: from.id,
                visibility: 'public',
                magnitude: 0.25,
                unattributed:
                    'Two of the hamlets on the low road are empty, and the fields have not been ' +
                    'turned this year.',
                consequences: {
                    immediate: 'Fewer hands, and fewer people drawing on the same ground.',
                    tenYearsLater: 'The ones who stayed cultivate slightly faster, and nobody says so.'
                }
            }, { locations: [from.id, to.id], npcs: movers.map(n => n.id) });
        }
    },

    // ── Somebody is simply not there any more, and nothing is resolved.
    {
        kind: 'disappearance',
        weight: 6,
        apply(state, day, rng) {
            const candidates = state.npcs.filter(
                n => n.status === 'alive' && n.cultivation.realmOrdinal >= 13
            );
            const npc = pick(rng, candidates);
            if (!npc) return null;
            replaceNpc(state, markMissing(npc, day, 'Went into the hills and was not seen again.'));

            return emit(state, 'disappearance', day, {
                day,
                kind: 'death',
                scale: 'personal',
                summary: `${npc.name} has not been seen since.`,
                actors: [{ id: npc.id, name: npc.name, role: 'missing' }],
                locationId: npc.locationId,
                factionIds: npc.factionId ? [npc.factionId] : [],
                visibility: 'faction',
                // The engine does not know either, and says so.
                truth: 'unresolved',
                claimedOutcomes: [
                    'died in the hills',
                    'went into seclusion and did not tell anyone',
                    'was killed over an old account',
                    'left the province'
                ],
                causeKnown: false,
                fidelity: 'rumour',
                magnitude: 0.35,
                unattributed:
                    'Somebody who used to be a fixture at the market has stopped coming, and ' +
                    'the stall has been taken over.',
                consequences: {
                    immediate: 'Their affairs are unsettled and nobody can close them.',
                    tenYearsLater: 'Treated as dead by everyone except one person.'
                }
            }, { npcs: [npc.id] });
        }
    }
];

/** The table, for tests and for tuning. Read-only. */
export function pressureTemplates(): { kind: PressureKind; weight: number }[] {
    return TEMPLATES.map(t => ({ kind: t.kind, weight: t.weight }));
}
