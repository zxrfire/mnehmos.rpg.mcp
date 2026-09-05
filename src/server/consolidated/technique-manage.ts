/**
 * Consolidated Technique Tool - `technique_manage`
 */

import { z } from 'zod';
import type Database from 'better-sqlite3';
import type { SessionContext } from '../types.js';
import { createActionRouter, ActionDefinition, McpResponse } from '../../utils/action-router.js';
import { RichFormatter } from '../utils/formatter.js';
import { DiceEngine } from '../../math/dice.js';
import type { Technique } from '../../schema/cultivation.js';
import {
    DAYS_PER_YEAR,
    conflictsWithRoot,
    daoGate,
    daoOf,
    deriveSeed,
    deviationRisk,
    evaluateDeathConditions,
    forStream,
    getSpiritRoot,
    rankName,
    resolveDeviation,
    rollDeviation
} from '../../engine/cultivation/index.js';
import {
    TECHNIQUES,
    capOf,
    classOf,
    findTechniquesForOrdinal,
    getTechnique,
    gradeRank
} from '../../data/cultivation/techniques.js';
import {
    describeCultivator,
    ensureCultivationDb,
    guidingError,
    isGuidingErrorBody,
    readFlag,
    resolveActiveRun,
    round2,
    round4,
    summariseInjury,
    writeFlag,
    type CultivationRepos
} from './cultivation-support.js';
import { describeDeath } from '../../engine/cultivation/survival.js';
import { COMMON_MANUAL_CAP, isCommonlyHeld } from '../../engine/world/manuals.js';
import {
    isSoldAtAStall,
    manualsAStallCarries,
    stallPriceStones
} from '../../engine/world/what-a-copy-of-a-manual-costs-at-a-stall.js';
import { getSect, getSectsTeaching } from '../../data/cultivation/sects.js';
import { aGuestIsTaughtThis, whyAGuestIsNotShownThis } from './sect-guest.js';
import {
    UNPROVISIONED,
    isSupplyStalled,
    masteryCeilingFor,
    practiceCeilingFor,
    type Provisioning
} from '../../engine/cultivation/upkeep.js';

/**
 * Who is feeding this cultivator the material an ancient art consumes.
 */
function provisioningFor(_cultivatorId: string): Provisioning {
    return UNPROVISIONED;
}

const ACTIONS = ['list_available', 'learn', 'practise', 'use', 'forget'] as const;

/**
 * What an art is about, for the Dao gate. Content carries `subject` on some
 * arts and not others, so this stays defensive rather than assuming a column.
 */
function techniqueSubject(technique: object): string[] {
    const subjects = (technique as { subjects?: unknown }).subjects;
    return Array.isArray(subjects)
        ? subjects.filter((s): s is string => typeof s === 'string' && s.length > 0)
        : [];
}
type TechniqueAction = typeof ACTIONS[number];

// ═══════════════════════════════════════════════════════════════════════════
// TUNING
// Documented here because the engine module does not own technique mastery.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mastery gained per day of dedicated practice at neutral Insight on a
 * mortal-grade art. 0.004 puts full mastery of a mortal manual at roughly 250
 * days - long enough that mastery is a commitment, short enough that a first
 * art is masterable inside a Qi Condensation lifetime.
 */
export const MASTERY_BASE_PER_DAY = 0.004;

/** Insight 1..4 maps to 0.75x .. 1.5x. Comprehension is archaeology. */
function insightFactor(insight: number): number {
    return 0.5 + insight * 0.25;
}

/** Higher grades are slower to internalise: mortal 1x down to chaos 1/5x. */
function gradeFactor(grade: Technique['grade']): number {
    return 1 / (1 + gradeRank(grade));
}

/** Practising the wrong element is not merely dangerous, it is slow. */
const CONFLICT_MASTERY_FACTOR = 0.5;

// ═══════════════════════════════════════════════════════════════════════════
// THE COPIES SOMEBODY ACTUALLY HOLDS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Which manuals this cultivator owns a physical copy of.
 */
export const FLAG_MANUAL_COPIES_HELD = 'manual_copies_held';

export function copiesHeldBy(db: Database.Database, cultivatorId: string): string[] {
    const raw = readFlag(db, cultivatorId, FLAG_MANUAL_COPIES_HELD);
    if (!raw) return [];
    return raw.split(',').map(id => id.trim()).filter(id => id.length > 0);
}

export function holdsACopyOf(
    db: Database.Database,
    cultivatorId: string,
    techniqueId: string
): boolean {
    return copiesHeldBy(db, cultivatorId).includes(techniqueId);
}

/** Idempotent: buying a second copy of a book you already own is not an event. */
export function recordACopyHeld(
    db: Database.Database,
    cultivatorId: string,
    techniqueId: string
): void {
    const held = copiesHeldBy(db, cultivatorId);
    if (held.includes(techniqueId)) return;
    writeFlag(db, cultivatorId, FLAG_MANUAL_COPIES_HELD, [...held, techniqueId].join(','));
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

const ListAvailableSchema = z.object({
    action: z.literal('list_available'),
    cultivatorId: z.string().optional(),
    category: z.enum(['attack', 'defense', 'movement', 'support', 'cultivation', 'forbidden']).optional(),
    includeConflicting: z.boolean().optional().default(true)
        .describe('Show arts whose element fights this root, with the deviation risk stated'),
    includeForbidden: z.boolean().optional().default(false)
});

// Exported so a test can assert what the gate will accept without standing up
// a whole run. The other consolidated handlers export their schemas already.
export const LearnSchema = z.object({
    action: z.literal('learn'),
    techniqueId: z.string().describe('Catalog id of the art'),
    cultivatorId: z.string().optional(),
    /**
     * WHERE THE BOOK CAME FROM, when it did not come from a stall.
     */
    provenance: z
        /**
         * `taken` is the fifth, and it is not a synonym for `found_in_place`.
         */
        .enum(['found_in_place', 'taught_by_a_person', 'bought', 'inherited', 'taken'])
        .optional()
        .describe('How the cultivator came by the manual, for arts above the common shelf')
});

const PractiseSchema = z.object({
    action: z.literal('practise'),
    techniqueId: z.string(),
    cultivatorId: z.string().optional(),
    days: z.number().min(1).max(3_650_000).optional().default(30),
    months: z.number().min(0).max(120_000).optional(),
    years: z.number().min(0).max(10_000).optional()
});

const UseSchema = z.object({
    action: z.literal('use'),
    techniqueId: z.string(),
    cultivatorId: z.string().optional(),
    targetId: z.string().optional().describe('Narrative target label; the engine records it, it does not resolve combat here')
});

const ForgetSchema = z.object({
    action: z.literal('forget'),
    techniqueId: z.string(),
    cultivatorId: z.string().optional()
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Whether the world of THIS run contains a copy of this art the cultivator could
 * plausibly get hold of.
 */
function isAvailableInRun(seed: string, spiritRootKey: string, technique: Technique): boolean {
    const root = getSpiritRoot(spiritRootKey as Parameters<typeof getSpiritRoot>[0]);
    if (root.techniqueAvailability >= 1) return true;
    // Scarcity only bites on arts of the root's own element; everything else is
    // as common as it ever was (and as useless to this root as it ever was).
    if (technique.element === null || !root.elements.includes(technique.element)) return true;
    return forStream(seed, 'technique_availability', technique.id).next() < root.techniqueAvailability;
}

/** The catalog row must exist before the join table can reference it. */
function ensureCatalogRow(repos: CultivationRepos, technique: Technique): void {
    if (!repos.techniques.getById(technique.id)) repos.techniques.upsert(technique);
}

function projectTechnique(
    technique: Technique,
    spiritRootKey: string,
    extra: Record<string, unknown> = {}
): Record<string, unknown> {
    const root = getSpiritRoot(spiritRootKey as Parameters<typeof getSpiritRoot>[0]);
    const matched = technique.element !== null && root.elements.includes(technique.element);
    const conflicts = technique.element !== null && conflictsWithRoot(root, technique.element);
    return {
        id: technique.id,
        name: technique.name,
        category: technique.category,
        grade: technique.grade,
        element: technique.element,
        requiredOrdinal: technique.requiredOrdinal,
        requiredRank: rankName(technique.requiredOrdinal),
        qiCost: technique.qiCost,
        damage: technique.damage,
        cooldown: technique.cooldown,
        description: technique.description,
        rootMatch: matched ? 'matched' : conflicts ? 'conflicting' : 'neutral',
        matchedBonus: matched ? root.matchedTechniqueBonus : 1,
        // WHERE THE MANUAL STOPS
        class: classOf(technique),
        carriesToOrdinal: capFor(technique),
        carriesToRank: capFor(technique) === null
            ? null
            : rankName(capFor(technique) as number),
        ...extra
    };
}

/** The rung this art carries a cultivator to, or null when it carries nobody. */
function capFor(technique: Technique): number | null {
    if (classOf(technique) !== 'cultivation') return null;
    return technique.cap !== undefined ? technique.cap : capOf(technique);
}

function totalPractiseDays(args: { days?: number; months?: number; years?: number }): number {
    const days = args.days ?? 0;
    const months = args.months ?? 0;
    const years = args.years ?? 0;
    return Math.floor(days + months * 30 + years * DAYS_PER_YEAR);
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleListAvailable(
    args: z.infer<typeof ListAvailableSchema>
): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const root = getSpiritRoot(cultivator.spiritRoot);
    const known = new Set(repos.techniques.listKnown(cultivator.id).map(t => t.id));

    const eligible = findTechniquesForOrdinal(cultivator.realmOrdinal, {
        category: args.category,
        excludeForbidden: !(args.includeForbidden ?? false)
    });

    const compatible: Record<string, unknown>[] = [];
    const conflicting: Record<string, unknown>[] = [];
    let scarcityFiltered = 0;

    for (const technique of eligible) {
        if (!isAvailableInRun(run.seed, cultivator.spiritRoot, technique)) {
            scarcityFiltered++;
            continue;
        }
        const conflicts =
            technique.element !== null && conflictsWithRoot(root, technique.element);
        const wrongElement =
            technique.element !== null && !root.elements.includes(technique.element) && !conflicts;

        // An art of an element the root cannot channel at all is not learnable;
        // an art that FIGHTS the root is learnable and dangerous, which is the
        // trade the genre is actually about.
        if (wrongElement) continue;

        const projected = projectTechnique(technique, cultivator.spiritRoot, {
            known: known.has(technique.id)
        });

        if (conflicts) {
            const risk = deviationRisk(cultivator, { techniqueElement: technique.element });
            conflicting.push({
                ...projected,
                deviationRiskPerCheck: round4(risk.risk),
                deviationSources: risk.sources.map(s => ({ source: s.source, delta: round4(s.delta) })),
                warning:
                    'Learning this routes through the engine\'s qi-deviation logic. It may tear meridians on the spot.'
            });
        } else {
            compatible.push(projected);
        }
    }

    return {
        cultivator: { id: cultivator.id, name: cultivator.name, rank: rankName(cultivator.realmOrdinal) },
        spiritRoot: {
            key: root.key,
            name: root.name,
            elements: root.elements,
            techniqueAvailability: root.techniqueAvailability
        },
        realmOrdinal: cultivator.realmOrdinal,
        compatible,
        conflicting: (args.includeConflicting ?? true) ? conflicting : [],
        counts: {
            compatible: compatible.length,
            conflicting: conflicting.length,
            gatedByRealm: TECHNIQUES.filter(t => t.requiredOrdinal > cultivator.realmOrdinal).length,
            unavailableInThisRun: scarcityFiltered
        },
        note:
            scarcityFiltered > 0
                ? `${scarcityFiltered} arts for this root exist but no copy has surfaced in this run. That is decided by the run seed, not by asking again.`
                : undefined
    };
}

export async function handleLearn(args: z.infer<typeof LearnSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const technique = getTechnique(args.techniqueId);
    if (!technique) {
        return guidingError('unknown_technique', `No art with id ${args.techniqueId} exists.`, {
            hint: 'technique_manage({ action: "list_available" }) lists what this cultivator can reach.'
        });
    }

    if (repos.techniques.knows(cultivator.id, technique.id)) {
        return guidingError('already_known', `${cultivator.name} already knows ${technique.name}.`, {
            hint: 'Use practise to raise mastery.'
        });
    }

    if (technique.requiredOrdinal > cultivator.realmOrdinal) {
        return guidingError(
            'realm_too_low',
            `${technique.name} requires ${rankName(technique.requiredOrdinal)}; ${cultivator.name} stands at ${rankName(cultivator.realmOrdinal)}.`,
            {
                requiredOrdinal: technique.requiredOrdinal,
                currentOrdinal: cultivator.realmOrdinal
            }
        );
    }

    // The top grades are not gated by power. They are written for someone who
    // has walked a road, which is why such manuals sit in ruins unread: the
    // ordinal is met, the qi is there, and the meaning does not arrive.
    const dao = daoOf(cultivator.insights ?? []);
    const gate = daoGate(dao, {
        grade: technique.grade,
        element: technique.element,
        subjects: techniqueSubject(technique),
        category: technique.category
    });
    if (!gate.permitted) {
        return guidingError('dao_required', `${technique.name}: ${gate.detail}`, {
            requiredStanding: gate.requiredStanding,
            heldStanding: gate.heldStanding,
            grade: technique.grade,
            // What they hold, not what they lack. There is no advisory here
            // about which road WOULD open it - that is theirs to find out.
            dao: dao.name
        });
    }

    const root = getSpiritRoot(cultivator.spiritRoot);
    if (
        technique.element !== null &&
        !root.elements.includes(technique.element) &&
        !conflictsWithRoot(root, technique.element)
    ) {
        return guidingError(
            'incompatible_element',
            `A ${root.name} cannot channel ${technique.element} at all. The aperture is the wrong shape.`,
            { rootElements: root.elements, techniqueElement: technique.element }
        );
    }

    // ABOVE THE COMMON SHELF, A ROAD IS SOMEBODY'S PROPERTY
    const asAGuest = aGuestIsTaughtThis(
        repos.db, cultivator.id, cultivator.realmOrdinal, technique.id
    );
    if (!isCommonlyHeld(technique.id) && args.provenance === undefined && !asAGuest) {
        const house = cultivator.sectId ? getSect(cultivator.sectId) : undefined;
        if (!house?.teaches.includes(technique.id)) {
            // A refusal names what would work, and where the player is already
            // sitting in at the house that holds this, the answer is not "find
            // a house" - it is that this is the half they are not shown.
            const withheld = whyAGuestIsNotShownThis(repos.db, cultivator.id, technique.id);
            if (withheld) {
                return guidingError(
                    'a_guest_is_not_shown_this',
                    `${technique.name} is ${withheld.hostName}'s and they are not showing it to `
                    + `${cultivator.name}. ${withheld.why}`,
                    {
                        techniqueId: technique.id,
                        hostName: withheld.hostName,
                        hint: 'A guest place is access to the shallow end. What membership would '
                            + 'change is not the shelf - it is who is allowed to be walked up it.'
                    }
                );
            }
            const taughtBy = getSectsTeaching(technique.id);
            return guidingError(
                'no_road_to_this_book',
                `${technique.name} is not a thing anybody hands out. `
                + (house
                    ? `${house.name} does not teach it.`
                    : 'This cultivator serves no house, and nobody teaches it to a stranger.'),
                {
                    // How many hold it, never which. Who teaches what is
                    // something you find out by asking people, and an engine
                    // that volunteers the list has answered a question nobody
                    // put to it.
                    housesTeachingIt: taughtBy.length,
                    commonlyHeld: false,
                    hint: 'Join a house that teaches it, be taught it by somebody who knows it, '
                        + 'or find a copy. `provenance` records which of those it was.'
                }
            );
        }
    }

    // AND BELOW IT, A BOOK IS STILL AN OBJECT SOMEBODY SOLD YOU
    const writtenTo = technique.cap ?? capOf(technique);
    const belowTheStallLine =
        classOf(technique) === 'cultivation'
        && writtenTo !== null
        && writtenTo <= COMMON_MANUAL_CAP;
    if (belowTheStallLine
        && args.provenance === undefined
        && !asAGuest
        && !holdsACopyOf(repos.db, cultivator.id, technique.id)) {
        const house = cultivator.sectId ? getSect(cultivator.sectId) : undefined;
        if (!house?.teaches.includes(technique.id)) {
            const asking = stallPriceStones(technique.id);
            const carried = manualsAStallCarries()
                .filter(m => m.requiredOrdinal <= cultivator.realmOrdinal);
            return guidingError(
                'no_copy_of_this_book',
                asking !== null
                    ? `${technique.name} is sold rather than given. A stall asks about `
                      + `${asking} spirit stone${asking === 1 ? '' : 's'} for a copy, and `
                      + `${cultivator.name} is carrying ${cultivator.spiritStones}.`
                    : `${technique.name} is not on any stall. It is `
                      + (house
                          ? `not what ${house.name} teaches, `
                          : 'somebody\'s house book, ')
                      + 'and the people who have it hand it to their own.',
                {
                    techniqueId: technique.id,
                    soldAtAStall: isSoldAtAStall(technique.id),
                    ...(asking !== null ? { stallPriceStones: asking } : {}),
                    spiritStones: cultivator.spiritStones,
                    // What WOULD work, always, and never a bare no. The stall's
                    // stock is named because the board prints it and any name
                    // the game prints is a name the game must accept.
                    ...(carried.length > 0
                        ? {
                            onTheStall: carried.map(m =>
                                `${m.name}, ${stallPriceStones(m.id)} stones, carries to `
                                + `${rankName(m.cap)}`)
                        }
                        : {}),
                    housesTeachingIt: getSectsTeaching(technique.id).length,
                    hint: asking !== null
                        ? 'Buy the copy and then read it. Serving a house that teaches it does '
                          + 'the same thing without the stones.'
                        : 'Serve a house that teaches it, be taught it by somebody who knows it, '
                          + 'or find a copy. `provenance` records which of those it was.'
                }
            );
        }
    }

    if (!isAvailableInRun(run.seed, cultivator.spiritRoot, technique)) {
        return guidingError(
            'no_copy_in_this_run',
            `${technique.name} exists, but no copy has surfaced in this run. Manuals for a ${root.name} are scarce.`,
            {
                techniqueAvailability: root.techniqueAvailability,
                hint: 'This is fixed by the run seed. Asking again returns the same answer.'
            }
        );
    }

    const conflicts =
        technique.element !== null && conflictsWithRoot(root, technique.element);

    const day = Math.floor(run.elapsedDays);
    const nextTurn = run.turn + 1;

    // ── Conflicting arts route through the deviation engine. ──
    let deviation: {
        deviated: boolean;
        risk: number;
        roll: number;
        resolution: ReturnType<typeof resolveDeviation> | null;
    } | null = null;

    if (conflicts) {
        const check = rollDeviation(
            cultivator,
            forStream(run.seed, 'technique_learn', day, technique.id),
            { techniqueElement: technique.element }
        );
        deviation = {
            deviated: check.deviated,
            risk: round4(check.risk),
            roll: round4(check.roll),
            resolution: check.deviated
                ? resolveDeviation(
                    cultivator,
                    forStream(run.seed, 'technique_learn_resolve', day, technique.id),
                    { turn: nextTurn, escalate: true }
                )
                : null
        };
    }

    let death: { cause: string; description: string } | null = null;

    const persist = repos.db.transaction(() => {
        ensureCatalogRow(repos, technique);
        repos.techniques.learn(cultivator.id, technique.id, 0);

        if (deviation?.resolution) {
            const res = deviation.resolution;
            for (const injury of res.injuries) {
                repos.cultivators.addInjury(cultivator.id, {
                    id: injury.id,
                    severity: injury.severity,
                    source: injury.source,
                    description: injury.description,
                    sustainedOnTurn: injury.sustainedOnTurn,
                    woundType: injury.woundType,
                    cultivationPenalty: injury.cultivationPenalty,
                    breakthroughPenalty: injury.breakthroughPenalty
                });
            }
            repos.cultivators.applyDeltas(cultivator.id, {
                cultivationProgress: -res.progressLost,
                hp: -res.hpLost
            });
        }

        repos.runs.incrementTurn(run.id, 1);

        const after = repos.cultivators.getById(cultivator.id)!;
        const cause = evaluateDeathConditions(after);
        if (cause) {
            death = { cause, description: describeDeath(cause, after) };
            repos.cultivators.markDead(cultivator.id, cause, nextTurn, death.description);
        }
    });
    persist();

    const after = repos.cultivators.getById(cultivator.id)!;
    const runAfter = repos.runs.getById(run.id)!;
    const known = repos.techniques.getKnown(cultivator.id, technique.id);

    return {
        learned: true,
        technique: projectTechnique(technique, cultivator.spiritRoot, {
            mastery: known?.mastery ?? 0
        }),
        elementConflict: conflicts,
        deviation: deviation
            ? {
                risk: deviation.risk,
                roll: deviation.roll,
                deviated: deviation.deviated,
                severity: deviation.resolution?.severity ?? null,
                progressLost: deviation.resolution ? round2(deviation.resolution.progressLost) : 0,
                hpLost: deviation.resolution?.hpLost ?? 0,
                injuries: (deviation.resolution?.injuries ?? []).map(summariseInjury),
                summary: deviation.resolution?.summary ?? 'The conflicting qi settled without tearing anything. This time.'
            }
            : null,
        died: death !== null,
        death,
        cultivator: describeCultivator(repos, after, runAfter)
    };
}

export async function handlePractise(args: z.infer<typeof PractiseSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const known = repos.techniques.getKnown(cultivator.id, args.techniqueId);
    const technique = getTechnique(args.techniqueId);
    if (!known || !technique) {
        return guidingError(
            'technique_not_known',
            `${cultivator.name} does not know ${args.techniqueId}.`,
            { hint: 'technique_manage({ action: "learn", techniqueId }) first.' }
        );
    }
    if (known.mastery >= 1) {
        return guidingError(
            'already_mastered',
            `${technique.name} is already at full mastery. There is nothing further to understand.`,
            { mastery: known.mastery }
        );
    }

    // ── WHAT THERE IS LEFT TO FEED IT WITH ───────────────────────────────
    // The upkeep, and it is a different refusal from the one above. "There is
    // nothing further to understand" is the art ending. This is the material
    // ending, with the art perfectly intact and the practitioner perfectly
    // capable, and the two must not sound alike - one of them is a problem
    // somebody can do something about.
    const provisioning = provisioningFor(cultivator.id);
    const supply = masteryCeilingFor(technique.id, provisioning);
    const ceiling = practiceCeilingFor(technique.id, provisioning);
    if (isSupplyStalled(technique.id, known.mastery, provisioning)) {
        return guidingError(
            'upkeep_exhausted',
            `${technique.name} does not stop here because ${cultivator.name} has understood all of it. ` +
            `It stops here because the practice consumes something there is no more of. ${supply.note}`,
            {
                mastery: round4(known.mastery),
                ceiling: supply.ceiling,
                upkeepHerbId: supply.upkeepHerbId,
                supply: supply.source,
                hint: 'Somebody would have to be spending on you. Find a stock, or find whoever still has one.'
            }
        );
    }

    const days = totalPractiseDays(args);
    if (days <= 0) {
        return guidingError('no_duration', 'Practising for no time at all does nothing.');
    }

    const root = getSpiritRoot(cultivator.spiritRoot);
    const matched = technique.element !== null && root.elements.includes(technique.element);
    const conflicts = technique.element !== null && conflictsWithRoot(root, technique.element);

    const perDay =
        MASTERY_BASE_PER_DAY *
        insightFactor(cultivator.attributes.insight) *
        gradeFactor(technique.grade) *
        (matched ? root.matchedTechniqueBonus / 2 : 1) *
        (conflicts ? CONFLICT_MASTERY_FACTOR : 1);

    // Saturates at the supply rather than at full mastery. The days are still
    // spent, the deviation is still rolled and the years still pass - running
    // out of the material is not a way of getting the time back.
    const gain = Math.min(ceiling - known.mastery, perDay * days);

    const day = Math.floor(run.elapsedDays);
    const nextTurn = run.turn + 1;

    // One deviation check per practice session, on the same terms the time-skip
    // uses. Practising a conflicting art is not free just because it is short.
    const check = rollDeviation(
        cultivator,
        forStream(run.seed, 'technique_practise', day, technique.id),
        { techniqueElement: technique.element }
    );
    const resolution = check.deviated
        ? resolveDeviation(
            cultivator,
            forStream(run.seed, 'technique_practise_resolve', day, technique.id),
            { turn: nextTurn }
        )
        : null;

    let death: { cause: string; description: string } | null = null;

    const persist = repos.db.transaction(() => {
        repos.techniques.addMastery(cultivator.id, technique.id, gain);

        if (resolution) {
            for (const injury of resolution.injuries) {
                repos.cultivators.addInjury(cultivator.id, {
                    id: injury.id,
                    severity: injury.severity,
                    source: injury.source,
                    description: injury.description,
                    sustainedOnTurn: injury.sustainedOnTurn,
                    woundType: injury.woundType,
                    cultivationPenalty: injury.cultivationPenalty,
                    breakthroughPenalty: injury.breakthroughPenalty
                });
            }
        }

        repos.cultivators.applyDeltas(cultivator.id, {
            age: days / DAYS_PER_YEAR,
            yearsAtCurrentRealm: days / DAYS_PER_YEAR,
            cultivationProgress: resolution ? -resolution.progressLost : 0,
            hp: resolution ? -resolution.hpLost : 0
        });

        repos.techniques.tickCooldowns(cultivator.id, days);
        repos.runs.advanceDays(run.id, days);
        repos.runs.incrementTurn(run.id, 1);

        const after = repos.cultivators.getById(cultivator.id)!;
        const cause = evaluateDeathConditions(after);
        if (cause) {
            death = { cause, description: describeDeath(cause, after) };
            repos.cultivators.markDead(cultivator.id, cause, nextTurn, death.description);
        }
    });
    persist();

    const after = repos.cultivators.getById(cultivator.id)!;
    const runAfter = repos.runs.getById(run.id)!;
    const nowKnown = repos.techniques.getKnown(cultivator.id, technique.id);

    return {
        practised: true,
        technique: technique.name,
        techniqueId: technique.id,
        days,
        masteryBefore: round4(known.mastery),
        masteryAfter: round4(nowKnown?.mastery ?? known.mastery),
        masteryGained: round4(gain),
        masteryPerDay: round4(perDay),
        // Present on every art so the narrator never has to infer it, and null
        // on the overwhelming majority, which consume nothing.
        upkeep: supply.ceiling === null
            ? null
            : {
                ceiling: supply.ceiling,
                herbId: supply.upkeepHerbId,
                supply: supply.source,
                reached: round4(nowKnown?.mastery ?? known.mastery) >= supply.ceiling,
                note: supply.note
            },
        factors: {
            insight: round2(insightFactor(cultivator.attributes.insight)),
            grade: round2(gradeFactor(technique.grade)),
            rootMatch: matched ? 'matched' : conflicts ? 'conflicting' : 'neutral'
        },
        deviation: {
            risk: round4(check.risk),
            roll: round4(check.roll),
            deviated: check.deviated,
            summary: resolution?.summary ?? null,
            injuries: (resolution?.injuries ?? []).map(summariseInjury)
        },
        died: death !== null,
        death,
        cultivator: describeCultivator(repos, after, runAfter)
    };
}

export async function handleUse(args: z.infer<typeof UseSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const known = repos.techniques.getKnown(cultivator.id, args.techniqueId);
    const technique = getTechnique(args.techniqueId);
    if (!known || !technique) {
        return guidingError(
            'technique_not_known',
            `${cultivator.name} does not know ${args.techniqueId}.`
        );
    }
    if (known.cooldownRemaining > 0) {
        return guidingError(
            'on_cooldown',
            `${technique.name} is not ready: ${known.cooldownRemaining} turns remain.`,
            { cooldownRemaining: known.cooldownRemaining }
        );
    }
    if (cultivator.qi < technique.qiCost) {
        return guidingError(
            'insufficient_qi',
            `${technique.name} costs ${technique.qiCost} qi; ${cultivator.name} holds ${cultivator.qi}.`,
            { required: technique.qiCost, held: cultivator.qi }
        );
    }

    const root = getSpiritRoot(cultivator.spiritRoot);
    const matched = technique.element !== null && root.elements.includes(technique.element);
    const conflicts = technique.element !== null && conflictsWithRoot(root, technique.element);

    // Mastery gates the effect. A quarter-learned art half-works, and the
    // engine says by how much rather than leaving it to prose.
    const effectMultiplier = round4(
        (0.25 + 0.75 * known.mastery) * (matched ? root.matchedTechniqueBonus : 1)
    );

    let roll: { expression: string; total: number; steps: string[]; scaled: number } | null = null;
    if (technique.damage) {
        const dice = new DiceEngine(
            deriveSeed(run.seed, 'technique_use', run.turn, technique.id)
        );
        const outcome = dice.roll(technique.damage);
        // `CalculationResult.result` is number | string because the same shape
        // carries algebraic answers; a dice expression always yields a number.
        const total = typeof outcome.result === 'number' ? outcome.result : Number(outcome.result);
        roll = {
            expression: technique.damage,
            total,
            steps: outcome.steps,
            scaled: Math.round(total * effectMultiplier)
        };
    }

    const nextTurn = run.turn + 1;
    const persist = repos.db.transaction(() => {
        repos.cultivators.applyDeltas(cultivator.id, { qi: -technique.qiCost });
        repos.techniques.markUsed(cultivator.id, technique.id, nextTurn);
        repos.runs.incrementTurn(run.id, 1);
    });
    persist();

    const after = repos.cultivators.getById(cultivator.id)!;

    return {
        used: true,
        technique: technique.name,
        techniqueId: technique.id,
        category: technique.category,
        target: args.targetId ?? null,
        qiSpent: technique.qiCost,
        qiRemaining: after.qi,
        mastery: round4(known.mastery),
        effectMultiplier,
        rootMatch: matched ? 'matched' : conflicts ? 'conflicting' : 'neutral',
        roll,
        cooldown: technique.cooldown,
        note:
            'The engine rolled this from the run seed. Narrate the number it returned; do not invent a different one. ' +
            'Combat resolution against a specific opponent belongs to combat_manage.'
    };
}

export async function handleForget(args: z.infer<typeof ForgetSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { cultivator } = resolved;
    const known = repos.techniques.getKnown(cultivator.id, args.techniqueId);
    if (!known) {
        return guidingError(
            'technique_not_known',
            `${cultivator.name} does not know ${args.techniqueId}.`
        );
    }

    const forgotten = repos.techniques.forget(cultivator.id, args.techniqueId);
    const after = repos.cultivators.getById(cultivator.id)!;

    return {
        forgotten,
        techniqueId: args.techniqueId,
        techniqueName: known.name,
        masteryLost: round4(known.mastery),
        knownTechniques: after.knownTechniques,
        note: 'What is put down is put down. Re-learning starts the mastery clock again from zero.'
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════

const definitions: Record<TechniqueAction, ActionDefinition> = {
    list_available: {
        schema: ListAvailableSchema,
        handler: handleListAvailable,
        aliases: ['list', 'available', 'catalog'],
        description: 'Arts this cultivator could learn, gated by realm ordinal and spirit root'
    },
    learn: {
        schema: LearnSchema,
        handler: handleLearn,
        aliases: ['study', 'acquire'],
        description: 'Learn an art; conflicting elements route through the deviation engine'
    },
    practise: {
        schema: PractiseSchema,
        handler: handlePractise,
        aliases: ['practice', 'train', 'drill'],
        description: 'Spend time raising mastery'
    },
    use: {
        schema: UseSchema,
        handler: handleUse,
        aliases: ['cast', 'invoke', 'perform'],
        description: 'Use an art; spends qi, starts its cooldown, rolls its effect'
    },
    forget: {
        schema: ForgetSchema,
        handler: handleForget,
        aliases: ['unlearn', 'drop'],
        description: 'Put an art down'
    }
};

const router = createActionRouter({ actions: ACTIONS, definitions, threshold: 0.6 });

export const TechniqueManageTool = {
    name: 'technique_manage',
    description: `Cultivation arts: what can be learned, how well it is held, and what it costs.

- list_available  arts gated by realm ordinal AND spirit-root compatibility. Conflicting arts are
                  listed separately with their deviation risk, because taking one is a real trade.
- learn           an art whose element fights the root routes through the engine's qi-deviation
                  logic. It can tear meridians on the spot, and it can kill.
- practise        spend days/months/years raising mastery. Time passes; deviation is checked.
- use             spends qi, starts the cooldown, rolls the effect from the run seed.
- forget          put an art down; mastery is lost.

Mutated roots (lightning, ice) will find most of their own manuals simply absent from a run. That
is decided by the run seed. Asking again returns the same answer.

Actions: ${ACTIONS.join(', ')}
Aliases: list/available->list_available, practice/train->practise, cast/invoke->use`,
    actionSchemas: router.actionSchemas,
    inputSchema: z.object({
        action: z.string().describe(`Action: ${ACTIONS.join(', ')}`),
        cultivatorId: z.string().optional(),
        techniqueId: z.string().optional(),
        targetId: z.string().optional(),
        category: z.enum(['attack', 'defense', 'movement', 'support', 'cultivation', 'forbidden']).optional(),
        includeConflicting: z.boolean().optional(),
        includeForbidden: z.boolean().optional(),
        days: z.number().optional(),
        months: z.number().optional(),
        years: z.number().optional()
    })
};

export async function handleTechniqueManage(
    args: unknown,
    _ctx?: SessionContext
): Promise<McpResponse> {
    const response = await router(args as Record<string, unknown>);
    try {
        const jsonText = response.content[0]?.text;
        if (!jsonText) return response;
        const data = JSON.parse(jsonText);

        let output = '';
        if (data.error === true || typeof data.error === 'string') {
            output = RichFormatter.header('Technique Error', '❌');
            output += RichFormatter.alert(data.message || 'Unknown error', 'error');
            if (data.hint) output += `\n*${data.hint}*\n`;
        } else if (data.compatible) {
            output = RichFormatter.header('Available Arts', '📜');
            output += RichFormatter.keyValue({
                'Spirit Root': data.spiritRoot?.name,
                'Rank': data.cultivator?.rank,
                'Compatible': data.counts?.compatible,
                'Conflicting': data.counts?.conflicting,
                'Gated by realm': data.counts?.gatedByRealm,
                'Absent from this run': data.counts?.unavailableInThisRun
            });
            if (data.compatible.length) {
                output += RichFormatter.section('Compatible');
                output += RichFormatter.table(
                    ['Name', 'Grade', 'Element', 'Req.', 'Qi', 'Known'],
                    data.compatible.map((t: Record<string, unknown>) => [
                        String(t.name), String(t.grade), String(t.element ?? '-'),
                        String(t.requiredOrdinal), String(t.qiCost), t.known ? 'yes' : ''
                    ])
                );
            }
            if (data.conflicting?.length) {
                output += RichFormatter.section('Conflicting (qi deviation risk)');
                output += RichFormatter.table(
                    ['Name', 'Element', 'Risk/check'],
                    data.conflicting.map((t: Record<string, unknown>) => [
                        String(t.name), String(t.element), String(t.deviationRiskPerCheck)
                    ])
                );
            }
        } else if (data.learned) {
            output = RichFormatter.header(`Learned: ${data.technique?.name}`, '📖');
            if (data.deviation?.deviated) {
                output += RichFormatter.alert(data.deviation.summary, 'warning');
            }
            if (data.died) output += RichFormatter.alert(data.death?.description ?? 'Dead.', 'error');
        } else if (data.practised) {
            output = RichFormatter.header(`Practised: ${data.technique}`, '🥋');
            output += RichFormatter.keyValue({
                'Days': data.days,
                'Mastery': `${data.masteryBefore} -> ${data.masteryAfter}`,
                'Deviated': data.deviation?.deviated ? 'yes' : 'no'
            });
        } else if (data.used) {
            output = RichFormatter.header(`Used: ${data.technique}`, '⚔️');
            output += RichFormatter.keyValue({
                'Qi spent': data.qiSpent,
                'Mastery': data.mastery,
                'Effect x': data.effectMultiplier,
                'Roll': data.roll ? `${data.roll.expression} = ${data.roll.total} (scaled ${data.roll.scaled})` : '-'
            });
        } else {
            output = RichFormatter.header('Techniques', '📜');
            output += JSON.stringify(data, null, 2) + '\n';
        }

        output += RichFormatter.embedJson(data, 'TECHNIQUE_MANAGE');
        return { content: [{ type: 'text', text: output }] };
    } catch {
        return response;
    }
}
