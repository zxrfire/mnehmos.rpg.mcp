/**
 * The two questions a narrator has to be able to ask before it writes a line.
 *
 *   assess         "what happens if they try this"
 *   understanding  "what has this cultivator actually comprehended, and what
 *                   does it make them"
 *
 * Both were built and neither was reachable. `assessCapability` had no consumer
 * outside the world layer's own tests, and `daoOf` was consulted once, deep
 * inside the technique gate, where nobody could see it.
 *
 * ── WHY `assess` MATTERS MORE THAN IT LOOKS ───────────────────────────────
 *
 * The engine must never answer an intent with "your realm is too low, this
 * action is unavailable". It answers what happens WHEN YOU TRY, which is five
 * separate questions that come apart:
 *
 *   attempt      is it physically initiable at all
 *   survive      will the attempt kill you
 *   succeed      can it actually work
 *   understand   will you comprehend what you found
 *   force        can you impose it over resistance
 *
 * `attempt` fails only for PHYSICAL reasons - a sealed door and no key, a shut
 * window, not being there. It is never failed because the action is unwise or
 * the odds are bad. Those are answers to the other four, and every one of them
 * comes back with the arithmetic itemised and a stated reason, so a model
 * cannot quietly decide something is possible because the story would be
 * better that way.
 *
 * ── WHAT THIS FILE WILL NOT RETURN ────────────────────────────────────────
 *
 * Latent affinity, in any form, under any name. `affinityFor` is derived rather
 * than stored precisely so that no serialiser can leak it and no UI can render
 * it - the world genuinely does not know either. And there is no advisory
 * anywhere about whether a road suits the person walking it: a cultivator can
 * spend two centuries on a Dao their root never suited and the realisation has
 * to be arrived at by living it. A helpful flag would convert a tragedy into a
 * tooltip. See the warning at the top of `engine/cultivation/dao.ts`.
 */

import { z } from 'zod';
import {
    DAO_DEGREE,
    LEANING_DEGREE,
    daoGate,
    daoOf,
    narrowingWeight
} from '../../engine/cultivation/dao.js';
import {
    MAX_DEGREE,
    bottleneckSubstitution,
    discoverableInsights,
    insightName,
    understandingEffects
} from '../../engine/cultivation/understanding.js';
import { getSpiritRoot, rankName } from '../../engine/cultivation/index.js';
import {
    assessCapability,
    makeSubject,
    realmClassForOrdinal,
    requirementsFromInscription,
    subjectFromLocation,
    subjectFromOpposition,
    type CapabilityActor,
    type CapabilityAssessment,
    type CapabilitySubject,
    type PredicateVerdict
} from '../../engine/world/index.js';
import {
    ApproachSchema,
    stagnationYearsForOrdinal,
    type Cultivator,
    type TechniqueGrade
} from '../../schema/cultivation.js';
import { getMembersOf } from '../../data/cultivation/members.js';
import { regardFor, type RegardAsker } from '../../engine/cultivation/regard.js';
import { worldForRun } from '../state/cultivation-world.js';
import { KnowledgeGate, placeKey } from '../../web/knowledge.js';
import {
    discoveryContextFor,
    ensureCultivationDb,
    guidingError,
    isGuidingErrorBody,
    resolveActiveRun,
    round2,
    round4,
    summariseInsight,
    type CultivationRepos
} from './cultivation-support.js';

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const AssessSchema = z.object({
    action: z.literal('assess'),
    cultivatorId: z.string().optional(),
    against: z.enum(['place', 'opponent', 'inscription', 'student']).default('place')
        .describe('What is being attempted: going somewhere, acting against somebody, reading something, or a master reading a student'),
    place: z.string().optional()
        .describe('Place to assess. Defaults to where the cultivator is standing.'),
    opponentId: z.string().optional().describe('A cultivator in this campaign'),
    studentId: z.string().optional()
        .describe('The student being read. Defaults to the asking cultivator, which is the ordinary case: what does somebody qualified to judge me see.'),
    siteId: z.string().optional().describe('A discovered site whose inscription is being read'),
    alertness: z.number().min(0).max(1).optional()
        .describe('How much attention the other party is paying. Circumstance, not outcome.'),
    preparation: z.number().int().min(0).max(8).optional()
        .describe('Ordinals of advantage arranged in advance. The engine prices it; it does not grant it.'),
    approach: ApproachSchema.optional()
        .describe('The half of the situation no stored row contains: what is being attempted, in what tone, with what leverage, in front of whom, and what rung the asker is letting the room believe. Optional, and omitting it is exactly the old behaviour. The engine reduces it to an apparent rung and a pressure of at most two rungs; it never reads an outcome out of it.')
});

/**
 * The strongest person on the student's own roster who is genuinely above them.
 *
 * The same rule the cultivation rate's `guideOrdinal` reads, deliberately: what
 * a master can tell a student and what a master is worth to a student's
 * progress must be the same person, or the send-off and the rate would
 * disagree about who is teaching.
 */
function assessorFor(
    repos: CultivationRepos,
    student: Cultivator
): { id: string; name: string; realmOrdinal: number } | null {
    const held = repos.sects.getMembership(student.id);
    if (!held) return null;
    let best: { id: string; name: string; realmOrdinal: number } | null = null;
    for (const member of getMembersOf(held.sectId)) {
        if (member.id === student.id) continue;
        if (member.realmOrdinal <= student.realmOrdinal) continue;
        if (!best || member.realmOrdinal > best.realmOrdinal) {
            best = { id: member.id, name: member.name, realmOrdinal: member.realmOrdinal };
        }
    }
    return best;
}

export const UnderstandingSchema = z.object({
    action: z.literal('understanding'),
    cultivatorId: z.string().optional(),
    /** Only what an art being practised makes relevant, when one is named. */
    techniqueId: z.string().optional()
});

// ═══════════════════════════════════════════════════════════════════════════
// THE ACTOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A cultivator as the capability layer sees them.
 *
 * `heldGrants` is deliberately empty. A realm is a capability class and a class
 * is POTENTIAL: reaching Void Refinement makes `no_ambient_needed` possible and
 * does not hand it over. Nothing in this engine stores an acquired grant yet, so
 * claiming one here would be the tool inventing capability - which is precisely
 * what the five predicates exist to prevent.
 *
 * `knowledgeIds` is the honest counterpart: comprehension the cultivator
 * genuinely holds, keyed the way an inscription's `comprehensionKey` is, so a
 * scholar with the right notes reads what a cultivator four realms above them
 * cannot.
 */
export function capabilityActorFor(cultivator: Cultivator): CapabilityActor {
    const root = getSpiritRoot(cultivator.spiritRoot);
    const knowledgeIds = new Set<string>();
    const specialties = new Set<string>(root.elements);

    for (const insight of cultivator.insights) {
        knowledgeIds.add(`${insight.domain}:${insight.subject}`);
        knowledgeIds.add(insight.subject);
        specialties.add(insight.subject);
        specialties.add(insight.domain);
    }

    return {
        id: cultivator.id,
        realmOrdinal: cultivator.realmOrdinal,
        attributes: cultivator.attributes,
        knowledgeIds: [...knowledgeIds],
        profile: { specialties: [...specialties] },
        heldGrants: [],
        present: true,
        alive: cultivator.alive
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// ASSESS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleAssess(args: z.infer<typeof AssessSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const against = args.against ?? 'place';
    const onDay = Math.floor(run.elapsedDays);

    let subject: CapabilitySubject;
    let context: Record<string, unknown>;
    // The rung the thing being assessed is pitched at. Null when the subject
    // does not have one, which is a legitimate answer and comes back `matched`.
    let gate: number | null = null;

    if (against === 'opponent') {
        if (!args.opponentId) {
            return guidingError('no_opponent', 'assess against an opponent needs opponentId.', {
                hint: 'cultivation_manage({ action: "list" }) shows who exists.'
            });
        }
        const opponent = repos.cultivators.getById(args.opponentId);
        if (!opponent) {
            return guidingError('unknown_cultivator', `No cultivator with id ${args.opponentId}.`);
        }
        // `attempt` against a person is ALWAYS zero. A weak cultivator may try
        // to rob a Core Formation elder; the engine's job is to say what that
        // costs, never to forbid it.
        subject = subjectFromOpposition({
            id: opponent.id,
            name: opponent.name,
            realmOrdinal: opponent.realmOrdinal,
            alertness: args.alertness,
            preparation: args.preparation
        });
        gate = opponent.realmOrdinal;
        context = {
            opponent: {
                id: opponent.id,
                name: opponent.name,
                rank: rankName(opponent.realmOrdinal)
            },
            alertness: args.alertness ?? 1,
            preparation: args.preparation ?? 0
        };
    } else if (against === 'student') {
        // ── A MASTER READING A STUDENT ───────────────────────────────────
        //
        // The gap this fills, found by a sweep of the schema rather than of the
        // play: `against` had three values and none of them was a PERSON BEING
        // TAUGHT. A master looking at a disciple and saying "you have taken
        // what there is here; go" is the send-off the whole guidance term
        // exists for, and it could not be asked for.
        //
        // Nothing here is authored. The assessor is a real person on the
        // student's own roster who is genuinely standing above them, and the
        // stall is `yearsAtCurrentRealm` against the ladder's own
        // `stagnationYearsForOrdinal`. A house with nobody above the student
        // supplies no assessor, and THAT is the send-off - stated as an absence
        // rather than as advice.
        const studentId = args.studentId ?? cultivator.id;
        const student = studentId === cultivator.id
            ? cultivator
            : repos.cultivators.getById(studentId);
        if (!student) {
            return guidingError('unknown_cultivator', `No cultivator with id ${studentId}.`);
        }

        const assessor = assessorFor(repos, student);
        const stagnationYears = stagnationYearsForOrdinal(student.realmOrdinal);
        const stalled = student.yearsAtCurrentRealm >= stagnationYears;

        subject = subjectFromOpposition({
            id: student.id,
            name: student.name,
            realmOrdinal: student.realmOrdinal,
            // A student is not resisting. Reading somebody who is standing
            // still and letting you is the least alert thing in the game, and
            // pricing it as an ambush would make every teacher an assassin.
            alertness: 0,
            preparation: args.preparation
        });
        gate = student.realmOrdinal;
        context = {
            student: {
                id: student.id,
                name: student.name,
                rank: rankName(student.realmOrdinal),
                realmOrdinal: student.realmOrdinal
            },
            // Who is qualified to say anything about them, and from what rung.
            // Null is the loud answer: nobody in this house is above them.
            assessor: assessor
                ? {
                    id: assessor.id,
                    name: assessor.name,
                    realmOrdinal: assessor.realmOrdinal,
                    rank: rankName(assessor.realmOrdinal),
                    rungsAbove: assessor.realmOrdinal - student.realmOrdinal
                }
                : null,
            // What the ladder says about how long they have been standing here.
            stall: {
                yearsAtCurrentRealm: round2(student.yearsAtCurrentRealm),
                stagnationYears: round2(stagnationYears),
                stalled,
                yearsPast: stalled ? round2(student.yearsAtCurrentRealm - stagnationYears) : 0,
                yearsRemaining: stalled ? 0 : round2(stagnationYears - student.yearsAtCurrentRealm)
            },
            note: assessor === null
                ? 'Nobody standing over them is standing above them. Whatever comes next is not in this house.'
                : stalled
                    ? 'They have been at this rung past the point where the ladder stops crediting the time.'
                    : 'Still inside the span the ladder credits at this rung.'
        };
    } else if (against === 'inscription') {
        const site = args.siteId ? discoveredSite(repos, run.id, args.siteId) : null;
        if (!site) {
            return guidingError(
                'unknown_site',
                args.siteId
                    ? `No discovered site with id ${args.siteId} in this run.`
                    : 'assess against an inscription needs siteId.',
                { hint: 'A site nobody has found is not something you are standing in front of.' }
            );
        }
        // Staring at a door is free. Everything else about an inscription is
        // comprehension, so `understand` carries the whole weight.
        subject = makeSubject({
            kind: 'inscription',
            id: site.id,
            name: site.name,
            requirements: requirementsFromInscription(site.ordinal)
        });
        gate = site.ordinal;
        context = { site: { id: site.id, name: site.name, kind: site.kind } };
    } else {
        const world = await worldForRun(run);
        const wanted = args.place ?? cultivator.location ?? '';
        const location = findKnownLocation(world.locations, wanted, cultivator);
        if (!location) {
            return guidingError(
                'place_not_known',
                `${cultivator.name} has never heard of "${wanted}".`,
                {
                    hint:
                        'A place has to reach a cultivator before it can be walked into. ' +
                        'Standing somewhere, or being told about it, is what puts it on this list.'
                }
            );
        }
        subject = subjectFromLocation(location, onDay);
        context = {
            place: {
                id: location.id,
                name: location.name,
                ambient: location.ambient,
                // Hazards are what a body notices, not a category label.
                hazards: location.hazards,
                sealed: location.sealed
            }
        };
    }

    const assessment = assessCapability(capabilityActorFor(cultivator), subject, onDay);

    // A place has no rung column, so its gate is what surviving it requires -
    // which IS the rung it is pitched at, measured rather than authored.
    if (gate === null && typeof assessment.survive.baseRequirement === 'number') {
        gate = assessment.survive.baseRequirement;
    }

    const asker: RegardAsker = { ordinal: cultivator.realmOrdinal, approach: args.approach };
    const regard = regardFor(gate, asker);

    return {
        assessed: true,
        cultivator: {
            id: cultivator.id,
            name: cultivator.name,
            rank: rankName(cultivator.realmOrdinal),
            realmOrdinal: cultivator.realmOrdinal,
            // The class is what the rank makes POSSIBLE. It is not a list of
            // what this cultivator holds, and it is reported as such.
            realmClass: realmClassForOrdinal(cultivator.realmOrdinal)
        },
        against,
        ...context,
        verdicts: {
            attempt: describeVerdict(assessment.attempt),
            survive: describeVerdict(assessment.survive),
            succeed: describeVerdict(assessment.succeed),
            understand: describeVerdict(assessment.understand),
            force: describeVerdict(assessment.force)
        },
        environmentMultiplier: round4(assessment.environmentMultiplier),
        // The sixth answer, and the one that is about how the situation MEETS
        // them rather than about whether they can do it. Same table the ground
        // and the boards read.
        regard: {
            gate: regard.gate,
            gap: regard.gap,
            band: regard.band,
            physicalBand: regard.physicalBand,
            offered: regard.offered,
            refused: regard.refused,
            damageMultiplier: round4(regard.damageMultiplier),
            durationMultiplier: round4(regard.durationMultiplier),
            priceMultiplier: round4(regard.priceMultiplier),
            concealed: regard.concealed,
            apparentOrdinal: regard.apparentOrdinal,
            apparentRank: rankName(regard.apparentOrdinal),
            pressure: regard.pressure,
            reaction: regard.reaction,
            intent: regard.intent,
            note: regard.note
        },
        summary: assessment.summary,
        note:
            'Five separate answers, and they come apart. A cultivator who can attempt this may not ' +
            'survive it, and one who survives it may not understand what they found. Nothing here ' +
            'refuses an action for being unwise - only `attempt` refuses, and only for physical reasons. ' +
            '`regard` is the separate question of how far above or below this they are standing, and ' +
            'what follows from that: what it costs them, how long it takes, and whether it is put to ' +
            'them at all.'
    };
}

function describeVerdict(verdict: PredicateVerdict): Record<string, unknown> {
    return {
        holds: verdict.holds,
        likelihood: verdict.likelihood,
        reason: verdict.reason,
        requirement: verdict.requirement,
        baseRequirement: verdict.baseRequirement,
        standing: verdict.standing,
        margin: verdict.margin,
        unhandledHazards: verdict.unhandledHazards,
        neutralised: verdict.neutralised,
        blockers: verdict.blockers,
        modifiers: verdict.applied.map(m => ({
            label: m.label,
            offset: m.offset,
            via: m.via
        }))
    };
}

interface SiteRow {
    id: string;
    kind: string;
    name: string;
    ordinal: number;
}

function discoveredSite(
    repos: CultivationRepos,
    runId: string,
    siteId: string
): SiteRow | null {
    const row = repos.db
        .prepare(`
            SELECT id, kind, name, ordinal FROM cultivation_sites
            WHERE id = ? AND discovered = 1 AND (run_id IS NULL OR run_id = ?)
        `)
        .get(siteId, runId) as SiteRow | undefined;
    return row ?? null;
}

/**
 * A place this cultivator could actually name.
 *
 * The discovery gate applies to tool output exactly as it applies to narration:
 * a cultivator may assess where they are standing, and anywhere they hold a
 * knowledge record for. Everywhere else does not resolve - not because it is
 * secret, but because they have never heard of it.
 */
function findKnownLocation<T extends { id: string; name: string }>(
    locations: readonly T[],
    wanted: string,
    cultivator: Cultivator
): T | null {
    const needle = wanted.trim().toLowerCase();
    if (needle.length === 0) return null;

    const match = locations.find(
        l => l.id.toLowerCase() === needle || l.name.toLowerCase() === needle
    );
    if (!match) return null;

    if ((cultivator.location ?? '').trim().toLowerCase() === needle) return match;

    // `canPointAt`, not `isAwareOf`. The two opened at different rungs of the
    // discovery ladder the moment it existed: awareness starts at `whisper` and
    // licenses saying a name, and pointing starts at `placed` and licenses
    // acting on one. Assessing a place you have only overheard through a wall
    // is acting on it.
    const gate = new KnowledgeGate(getDbFor());
    if (gate.canPointAt(cultivator.id, 'place', match.name)) return match;
    if (gate.canPointAt(cultivator.id, 'place', placeKey(match.id))) return match;
    return null;
}

function getDbFor() {
    return ensureCultivationDb().db;
}

// ═══════════════════════════════════════════════════════════════════════════
// UNDERSTANDING
// ═══════════════════════════════════════════════════════════════════════════

/** Every grade a manual can carry, in ladder order. */
const GRADES: readonly TechniqueGrade[] = ['mortal', 'earth', 'heaven', 'immortal', 'chaos'];

export async function handleUnderstanding(
    args: z.infer<typeof UnderstandingSchema>
): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const insights = cultivator.insights;
    const root = getSpiritRoot(cultivator.spiritRoot);
    const dao = daoOf(insights);

    const discovery = discoveryContextFor(repos, cultivator, {
        runId: run.id,
        practisingTechniqueId: args.techniqueId ?? null
    });
    const reachable = discoverableInsights(cultivator, discovery.context);
    const held = new Set(insights.map(i => `${i.domain}:${i.subject}`));

    const effects = understandingEffects(insights, {
        rootElements: root.elements,
        techniqueElement: discovery.context.techniqueElement ?? null,
        techniqueSubject: null
    });
    const substitution = bottleneckSubstitution(cultivator, {
        techniqueElement: discovery.context.techniqueElement ?? null
    });

    return {
        cultivator: {
            id: cultivator.id,
            name: cultivator.name,
            rank: rankName(cultivator.realmOrdinal)
        },
        insights: insights.map(summariseInsight),
        achievements: cultivator.achievements.map(a => ({
            id: a.id,
            kind: a.kind,
            onDay: a.onDay,
            summary: a.summary
        })),
        // Derived, every time, from the insight set. There is no dao column and
        // no setter: a cultivator cannot hold a road without the comprehension
        // that made it one.
        dao: {
            standing: dao.standing,
            subject: dao.subject,
            domain: dao.domain,
            name: dao.name,
            depth: dao.depth,
            breadth: dao.breadth,
            intensity: round4(dao.intensity),
            thresholds: {
                leaningAtDegree: LEANING_DEGREE,
                daoAtDegree: DAO_DEGREE,
                maxDegree: MAX_DEGREE
            }
        },
        // What the road actually does, stated as consequence rather than as a
        // label. This is why top-grade manuals sit in ruins unread.
        consequences: {
            grades: GRADES.map(grade => {
                const gate = daoGate(dao, { grade, element: null, subject: dao.subject ?? null });
                return { grade, permitted: gate.permitted, detail: gate.detail };
            }),
            cultivationMultiplier: round4(effects.cultivationMultiplier),
            breakthroughModifier: round4(effects.breakthroughModifier),
            contributing: effects.contributing,
            bottleneck: {
                requirement: substitution.required,
                understandingStandsInFor: round2(substitution.substituted),
                fraction: round4(substitution.fraction),
                contributing: substitution.contributing,
                note:
                    'Understanding decides a marginal crossing. It never replaces the climb: a ' +
                    'fraction of the requirement is not the requirement.'
            }
        },
        // Everything within reach, and what put it there. An almost-empty list
        // is the ordinary case and the honest one - a hermit with no library,
        // no teacher and nothing remarkable underfoot can reach their own root
        // and nothing else, however long they sit.
        withinReach: reachable.map(candidate => ({
            domain: candidate.domain,
            subject: candidate.subject,
            alreadyHeld: held.has(`${candidate.domain}:${candidate.subject}`),
            access: candidate.access,
            opening: candidate.opening,
            // How readily this would come, given the road already walked. A
            // measure of what has become foreign, not of what suits them.
            readiness: round4(narrowingWeight(dao, candidate))
        })),
        note:
            'Comprehension needs something to comprehend from. Without access a road is not harder, ' +
            'it is absent - it never enters the list above, and effort does not widen it.'
    };
}

/** Names a narrator may use for a comprehension, without restating the degree. */
export function nameOf(insight: Parameters<typeof insightName>[0]): string {
    return insightName(insight);
}

export type { CapabilityAssessment };
