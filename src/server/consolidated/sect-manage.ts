/**
 * Consolidated Sect Tool - `sect_manage`
 *
 * Sects are the difference between cultivating alone on a cold mountain and
 * cultivating with a spirit-gathering array, an elder who answers questions,
 * and a stipend that means you are not foraging.
 *
 * AUTHORITY BOUNDARY
 * ------------------
 * - `join` enforces the sect's own `admissionOrdinal` and the catalog's
 *   engine-checkable attribute minimums. A caller cannot talk their way past a
 *   realm gate by asserting that the elders were impressed. Two of the region's
 *   standing powers take no applicants at all (`recruits: false`); for those,
 *   `join` refuses outright rather than negotiating.
 *
 * The `sects` table is seeded from `src/data/cultivation/sects.ts` on first
 * touch. Membership, rank and contribution are STATE and live in the database;
 * territory, what a sect teaches, who it feuds with and the condition of its
 * inherited compound are WORLD and stay in the catalog. Both are read here and
 * handed to the narrator together; neither is copied into the other.
 * - `promote` computes the requirement for the next rank from the sect's ladder
 *   and the cultivator's realm and contribution, and refuses when it is unmet.
 *   The rank index the caller wants is not an input.
 * - `stipend` pays what has ACCRUED since the last payment, computed from the
 *   run's in-world clock. Calling it twice in a row pays nothing the second
 *   time, because no time has passed.
 */

import { z } from 'zod';
import type { SessionContext } from '../types.js';
import { createActionRouter, ActionDefinition, McpResponse } from '../../utils/action-router.js';
import { RichFormatter } from '../utils/formatter.js';
import { rankName } from '../../engine/cultivation/index.js';
import {
    intakeRouteOf,
    getDaoHouse, getSect, getSectAdmission } from '../../data/cultivation/sects.js';
import {
    SIPHON_PACES,
    SIPHON_PERIOD_DAYS,
    baseReservesFor,
    canReachReserves,
    discoveryChance,
    noticeFromShortfall,
    resolveDiscovery,
    siphonPeriod
} from '../../engine/cultivation/embezzlement.js';
import { CultivationRNG, forStream } from '../../engine/cultivation/rng.js';
import {
    FLAG_STIPEND_PAID_DAY,
    describeCultivator,
    ensureCultivationDb,
    guidingError,
    isGuidingErrorBody,
    readNumberFlag,
    resolveActiveRun,
    round2,
    sectCatalogFacts,
    writeFlag
} from './cultivation-support.js';
import {
    AboveSchema,
    DenounceSchema,
    PatronageSchema,
    PetitionSchema,
    ProspectSchema,
    VerifyClaimSchema,
    WakeSchema,
    handleAbove,
    handleDenounce,
    handlePatronage,
    handlePetition,
    handleProspect,
    handleVerifyClaim,
    handleWake
} from './sect-politics.js';
import { GuestSchema, handleGuest } from './sect-guest.js';
import {
    AdmissionSchema,
    AuthoritySchema,
    CurriculumSchema,
    ExpelSchema,
    GrowSchema,
    OrderSchema,
    RecruitSchema,
    handleAdmission,
    handleAuthority,
    handleCurriculum,
    handleExpel,
    handleGrow,
    handleOrder,
    handleRecruit
} from './sect-leadership.js';

const ACTIONS = [
    'list', 'join', 'leave', 'promote', 'stipend', 'standing', 'siphon',
    // The half of a sect that is not a stipend. Every one of these reads
    // catalog data that has had no verb attached to it until now.
    'prospect', 'patronage', 'verify_claim', 'denounce', 'petition', 'wake', 'above',
    // Authority. `order` opens at rung one and is the first thing membership
    // actually buys; the rest is what the elder rungs and the seat can do.
    'authority', 'order', 'recruit', 'admission', 'curriculum', 'expel', 'grow',
    // The roll that is not the house roll. A house takes guest students because
    // it holds its best back, so showing an outsider the shallow end costs it
    // nothing - and because watching somebody for a year tells it what a bar
    // never could. See `sect-guest.ts`.
    'guest'
] as const;
type SectAction = typeof ACTIONS[number];

// ═══════════════════════════════════════════════════════════════════════════
// PROMOTION RULES
// The engine's, not the caller's. Stated here because sects are content and
// the promotion curve is mechanics.
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// WHAT A HOUSE MAKES OF SOMEBODY WHO WALKED UP
// See the block in `handleJoin`. Named rather than inlined so that anybody
// re-tuning them can see all four at once and see which is a judgement.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Chosen, not measured. The one number here without a catalog behind it.
 *
 * High rather than even, and the reasoning is the reason it is not lower: a
 * house that publishes an `admissionOrdinal` and takes applicants is
 * ADVERTISING, and the bar is the filter. Somebody who clears a published bar
 * and walks up is usually taken - what the walk-up costs them is the bottom
 * seat and the absence of anybody vouching, both of which the engine already
 * charges elsewhere. The minority of refusals here are the ordinary ones: the
 * intake is closed this season, the elder who does it is away, they did not
 * take to you.
 *
 * A flat coin flip was tried first at 0.6 and is wrong for a different reason
 * than being harsh: it makes admission a thing that happens TO a player rather
 * than something they did, which is the same softening from the other side.
 */
const WALKING_UP_UNANNOUNCED = 0.8;

/** The margin above the bar, which is the only thing a house can see. */
const PER_RUNG_PAST_THE_BAR = 0.06;

/** Past this a house pitched low stops being any more impressed. */
const RUNGS_A_HOUSE_STILL_NOTICES = 4;

/** `charm` is "social first impression" in the schema. This is the moment. */
const PER_POINT_OF_CHARM = 0.08;

/** A house that watched somebody leave remembers which door they used. */
const WATCHED_YOU_WALK_OUT = -0.3;

/** Realm ordinals a disciple must gain per rank step above admission. */
export const ORDINALS_PER_SECT_RANK = 4;
/** Contribution required for the first promotion; triples each step after. */
export const BASE_PROMOTION_CONTRIBUTION = 100;

export function requiredOrdinalForRank(admissionOrdinal: number, rankIndex: number): number {
    return admissionOrdinal + rankIndex * ORDINALS_PER_SECT_RANK;
}

export function requiredContributionForRank(rankIndex: number): number {
    return Math.round(BASE_PROMOTION_CONTRIBUTION * Math.pow(3, Math.max(0, rankIndex - 1)));
}

/** In-world days per stipend payment. Sects pay monthly, like everyone else. */
export const STIPEND_PERIOD_DAYS = 30;

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

const ListSchema = z.object({
    action: z.literal('list'),
    cultivatorId: z.string().optional(),
    alignment: z.enum(['righteous', 'neutral', 'demonic']).optional(),
    admissibleOnly: z.boolean().optional().default(false)
        .describe('Only sects whose admission ordinal this cultivator already meets')
});

const JoinSchema = z.object({
    action: z.literal('join'),
    sectId: z.string(),
    cultivatorId: z.string().optional()
});

const LeaveSchema = z.object({
    action: z.literal('leave'),
    cultivatorId: z.string().optional()
});

const PromoteSchema = z.object({
    action: z.literal('promote'),
    cultivatorId: z.string().optional()
});

const StipendSchema = z.object({
    action: z.literal('stipend'),
    cultivatorId: z.string().optional()
});

const StandingSchema = z.object({
    action: z.literal('standing'),
    cultivatorId: z.string().optional()
});

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleList(args: z.infer<typeof ListSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    const ordinal = isGuidingErrorBody(resolved) ? null : resolved.cultivator.realmOrdinal;

    let sects = repos.sects.list();
    if (args.alignment) sects = sects.filter(s => s.alignment === args.alignment);
    if ((args.admissibleOnly ?? false) && ordinal !== null) {
        sects = sects.filter(s => {
            const facts = getSect(s.id);
            return s.admissionOrdinal <= ordinal && (facts?.recruits ?? true);
        });
    }

    return {
        count: sects.length,
        cultivatorOrdinal: ordinal,
        sects: sects.map(sect => {
            const facts = sectCatalogFacts(sect.id);
            const recruits = (facts?.recruits as boolean | undefined) ?? true;
            return {
                id: sect.id,
                name: sect.name,
                alignment: sect.alignment,
                powerOrdinal: sect.powerOrdinal,
                powerRank: rankName(sect.powerOrdinal),
                admissionOrdinal: sect.admissionOrdinal,
                admissionRank: rankName(sect.admissionOrdinal),
                admissible:
                    ordinal === null ? null : recruits && ordinal >= sect.admissionOrdinal,
                ranks: sect.ranks,
                stipend: sect.stipend,
                memberCount: repos.sects.listMembers(sect.id).length,
                description: sect.description,
                ...(facts ?? {})
            };
        }),
        note:
            sects.length === 0
                ? 'No sects in this campaign. The catalog seeds on first touch; an empty list means the sects table was cleared.'
                : undefined
    };
}

export async function handleJoin(args: z.infer<typeof JoinSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const sect = repos.sects.getById(args.sectId);
    if (!sect) {
        return guidingError('unknown_sect', `No sect with id ${args.sectId}.`, {
            hint: 'sect_manage({ action: "list" }) shows the sects that exist.'
        });
    }

    const existing = repos.sects.getMembership(cultivator.id);
    if (existing && existing.sectId === sect.id) {
        return guidingError(
            'already_a_member',
            `${cultivator.name} already serves ${sect.name} as ${existing.rankTitle}.`,
            { rankIndex: existing.rankIndex, rankTitle: existing.rankTitle }
        );
    }

    const facts = getSect(sect.id);

    // Two of the region's standing powers take no applicants: the Hollow Court,
    // which has nothing left to want, and the Kiln Wardens, who do not explain
    // themselves and do not recruit. This is not a threshold to be met, so
    // there is no shortfall to report and nothing for the narrator to work on.
    if (facts && !facts.recruits) {
        return guidingError(
            'sect_does_not_recruit',
            `${sect.name} takes no applicants. There is no entrance requirement because there is no entrance.`,
            {
                sectId: sect.id,
                territory: facts.territory,
                hint: 'Not a gate that can be met. sect_manage({ action: "list", admissibleOnly: true }) shows the doors that open.'
            }
        );
    }

    // And the houses that have a way in which is not a door.
    //
    // Found by the exhaustive sweep rather than by reading: a dao house is a
    // FAMILY, and the stated way in is adoption - you are taken in as a prodigy
    // in their dao and very often married to one of theirs. Nothing was
    // checking that. Two of the seven admitted a stranger who walked up and
    // asked, and the other five refused only because their admission ordinal
    // happened to be above the applicant, which is a different rule producing
    // the right answer by accident.
    //
    // `recruits` above cannot express this: it is a boolean, and a house is
    // neither open nor closed. `intakeRouteOf` is the field that can.
    if (facts && intakeRouteOf(sect.id) === 'adoption') {
        const house = getDaoHouse(sect.id);
        return guidingError(
            'house_takes_by_adoption',
            `${sect.name} is a house rather than a sect. There is no application: the way in is ` +
            `adoption, offered to somebody who is already a prodigy in the dao the house holds, and ` +
            `it is the house that decides to offer it.`,
            {
                sectId: sect.id,
                route: 'adoption',
                prodigyIn: house?.admission?.prodigyIn ?? null,
                houseSurname: house?.houseSurname ?? null,
                naming: house?.admission?.naming ?? null,
                hint: 'Not a gate that can be met by standing. Being worth adopting is the whole of it.'
            }
        );
    }

    // The admission gate is the sect's, and it is not negotiable through this
    // tool. A Qi Condensation cultivator does not get into a Core Formation
    // sect by being narrated impressively.
    if (cultivator.realmOrdinal < sect.admissionOrdinal) {
        return guidingError(
            'below_admission_ordinal',
            `${sect.name} admits from ${rankName(sect.admissionOrdinal)}. ${cultivator.name} stands at ${rankName(cultivator.realmOrdinal)}.`,
            {
                admissionOrdinal: sect.admissionOrdinal,
                currentOrdinal: cultivator.realmOrdinal,
                shortBy: sect.admissionOrdinal - cultivator.realmOrdinal
            }
        );
    }

    // The catalog's entrance examination, where it has one. Only the
    // engine-checkable half is enforced here - a minimum in an innate attribute
    // is a number the engine already owns. `preferredRoots` is deliberately NOT
    // a gate: the catalog says the sect actively recruits those roots, not that
    // it turns the others away, and reading it as a refusal would invent a
    // policy the content does not state.
    const admission = getSectAdmission(sect.id);
    if (admission) {
        const unmet: Array<{ attribute: string; required: number; actual: number }> = [];
        const checks: Array<[string, number | undefined, number]> = [
            ['might', admission.minMight, cultivator.attributes.might],
            ['insight', admission.minInsight, cultivator.attributes.insight],
            ['charm', admission.minCharm, cultivator.attributes.charm]
        ];
        for (const [attribute, required, actual] of checks) {
            if (required !== undefined && actual < required) {
                unmet.push({ attribute, required, actual });
            }
        }
        if (unmet.length > 0) {
            return guidingError(
                'admission_requirements_unmet',
                `${sect.name} turned ${cultivator.name} away: ${admission.requirement}`,
                {
                    sectId: sect.id,
                    requirement: admission.requirement,
                    unmet,
                    hint: 'Innate attributes are rolled once and never rise. This door does not open later.'
                }
            );
        }
    }

    // ── AND THEN SOMEBODY HAS TO SAY YES ─────────────────────────────────
    //
    // Every gate above is a threshold, and clearing all of them used to mean
    // being admitted, on the spot, with no journey and nobody's opinion in it.
    // Played, that read exactly as badly as it sounds: "which sects would
    // accept me" answered, correctly, "knowing a name is not an introduction -
    // somebody would have to put you in front of them, or you would have to
    // walk up on your own", and the very next input joined a house.
    //
    // Walking up on your own is not removed, and must not be: `AGENTS.md` is
    // explicit that anybody may attempt anything and that the engine's job is
    // to price the attempt rather than forbid it. What is added is that it is
    // an ATTEMPT. A house looking at a stranger with nobody speaking for them
    // is making a judgement, and judgements go both ways.
    //
    // Three things move it and all three are already on the row:
    //
    //   HOW FAR PAST THE BAR   The margin above `admissionOrdinal`, which is
    //                          the only thing about a stranger a house can
    //                          actually see. Capped, because a house pitched at
    //                          Qi Condensation is not more impressed by the
    //                          twentieth rung than by the fifth.
    //   HOW THEY COME ACROSS   `charm` is described in the schema as social
    //                          first impression and is locked at creation. This
    //                          is the moment it is for, and it had no consumer.
    //   WHETHER THEY WALKED    A house that watched somebody leave remembers.
    //   OUT OF HERE BEFORE     The seat cap below already says a returning
    //                          member is not a stranger; this says the same
    //                          thing about the door itself.
    //
    // THE BASE FIGURE IS THE ONE JUDGEMENT IN HERE and it is worth saying so
    // rather than dressing it up. Nothing in the catalogs says how often an
    // ordinary house takes a stranger who clears its bar, so 0.6 is chosen and
    // not measured. What would replace it is a count off the world: the share
    // of a house's roster that arrived unaffiliated rather than being placed.
    // Until somebody measures that, this is an honest guess with its own
    // provenance attached.
    //
    // Keyed on the DAY, which is the anti-retry and the whole reason this is
    // not a slot machine. A refusal passes no time, so asking the same house
    // again on the same day returns the same answer, word for word; going away
    // and doing something - a season of work, a stretch of cultivation, a rung
    // - is what buys another look. The player is never blocked and never
    // rerolls for free.
    const beforeHere = repos.sects.formerMembership(sect.id, cultivator.id);
    const chance = Math.min(0.92, Math.max(0.15,
        WALKING_UP_UNANNOUNCED
        + PER_RUNG_PAST_THE_BAR * Math.min(
            RUNGS_A_HOUSE_STILL_NOTICES,
            cultivator.realmOrdinal - sect.admissionOrdinal
        )
        + PER_POINT_OF_CHARM * (cultivator.attributes.charm - 1)
        + (beforeHere !== null ? WATCHED_YOU_WALK_OUT : 0)
    ));
    // THE CULTIVATOR'S ID IS DELIBERATELY NOT A STREAM PART.
    //
    // It is a `randomUUID`, so keying on it makes the roll irreproducible from
    // the run seed - which `AGENTS.md` forbids outright, and which showed up
    // immediately: the same seed accepted an applicant one run and refused
    // them the next. The run seed, the day and the house are the whole of what
    // decides it, and a run has one player.
    const look = forStream(
        run.seed, 'sect_admission', Math.floor(run.elapsedDays), sect.id
    ).next();
    if (look >= chance) {
        // The whole of what a player is told goes in `message`. `hint` is the
        // developer channel - `fromToolResult` routes it to `structure` and
        // never to prose - so a refusal whose reason lives only in the hint
        // reaches the player as a bare no, which is the one thing `AGENTS.md`
        // says a refusal may never be.
        return guidingError(
            'not_taken_on',
            `${sect.name} looked at ${cultivator.name} and did not take them. `
            + (beforeHere !== null
                ? 'They have watched this one leave once already, and a house remembers which '
                  + 'door somebody used. '
                : 'Nobody said why, which is how it usually goes when nobody is speaking for you. ')
            + 'Standing higher when you come back moves it, and somebody putting you in front of '
            + 'them moves it more. Asking again the same afternoon gets the same answer word for '
            + 'word; it is time that buys another look.',
            {
                sectId: sect.id,
                chance: round2(chance),
                roll: round2(look),
                walkedUpUnannounced: true,
                returningAfterLeaving: beforeHere !== null,
                rungsPastTheBar: cultivator.realmOrdinal - sect.admissionOrdinal,
                charm: cultivator.attributes.charm,
                // What would work, always, and never a bare no. All three are
                // things the applicant can actually go and do.
                hint: 'Nothing about the refusal is permanent. Standing higher when you come '
                    + 'back moves it, somebody putting you in front of them moves it more, and '
                    + 'the same day gets the same answer - so it is time that buys another look, '
                    + 'not asking twice.'
            }
        );
    }

    // ── The rung they come in at ─────────────────────────────────────────
    //
    // This had a floor and no ceiling. `below_admission_ordinal` correctly
    // refuses somebody standing under the gate, and then EVERYBODY who cleared
    // it was seated at index 0 - so a False Immortal who walked up to a
    // Foundation-tier sect enrolled as an Outer Disciple, on the sweeping
    // roster, drawing the bottom stipend. Nothing was wrong at the bottom;
    // the whole defect was at the top.
    //
    // The fix is the promotion ladder read backwards. `requiredOrdinalForRank`
    // already states what realm each rung is pitched at, and it is the same
    // function `handlePromote` gates on, so the seat somebody is given on
    // arrival and the seat they could be raised to afterwards can never
    // disagree. Contribution is deliberately NOT read here: it is service
    // rendered to THIS house and a newcomer has none, which is exactly why
    // this is entry and not promotion - what a stranger is seated by is what
    // they visibly are.
    //
    // AND THE HEADSHIP IS NOT AN ENTRY RANK.
    //
    // This loop started at the last index, so a strong enough stranger was
    // seated at the TOP of the ladder on the day they walked up - at the Azure
    // Dew Sect, whose ladder is pitched from ordinal 0, that is anybody at
    // ordinal 16 becoming Sect Warden over a living head. The world already
    // refuses this to its own people and says why: `seatsAtRank` returns 0 for
    // the top rank because "the top seat is not a promotion, it is a
    // succession, it happens when the person in it dies or leaves", and filling
    // it by the ordinary route "would quietly install a weaker head over a
    // living master, which is not a thing a house does".
    //
    // A rule the world enforces on everybody else and not on the player is the
    // oldest defect in this codebase. Entry stops one below the top; the
    // headship changes hands by succession or not at all.
    let entryIndex = 0;
    for (let index = sect.ranks.length - 2; index > 0; index--) {
        if (cultivator.realmOrdinal >= requiredOrdinalForRank(sect.admissionOrdinal, index)) {
            entryIndex = index;
            break;
        }
    }

    // ── AND A RETURNING MEMBER IS NOT A STRANGER ─────────────────────────
    //
    // Entry rank is computed from ordinal alone, deliberately, for the reason
    // stated above: what a stranger is seated by is what they visibly are.
    // Promotion additionally requires contribution, and SPENDS it. Put those
    // together with a `removeMember` that deleted the row outright and leaving
    // was a free promotion - measured in play, Dew Servant out and Dew Elder
    // back in on the same turn, three ranks for nothing, bypassing the entire
    // contribution economy that missions exist to feed. Worse in a world where
    // 244 NPCs sit qualified-and-blocked behind seats while the player ranks up
    // by using the door twice.
    //
    // The entry rule is right and is untouched. What was wrong is that somebody
    // who walked out last week read as a stranger to the house they walked out
    // of, and the house knows exactly what they were. So: a returning member
    // cannot re-enter above the seat they left. Their contribution was
    // forfeited on the way out - the game says so - and it has to be re-earned.
    //
    // This caps and never raises: somebody who left as a servant and has since
    // climbed several rungs still enters at servant, and somebody who left a
    // house they had never risen in is unaffected.
    const before = repos.sects.formerMembership(sect.id, cultivator.id);
    const cappedByReturn = before !== null && entryIndex > before.rankIndex;
    if (cappedByReturn) entryIndex = before!.rankIndex;

    const membership = repos.db.transaction(() => {
        const result = repos.sects.addMember(sect.id, cultivator.id, entryIndex);
        // Joining resets the stipend clock: a new disciple is not owed
        // backdated wages for the years they spent elsewhere.
        writeFlag(repos.db, cultivator.id, FLAG_STIPEND_PAID_DAY, String(run.elapsedDays));
        repos.runs.incrementTurn(run.id, 1);
        return result;
    })();

    const after = repos.cultivators.getById(cultivator.id)!;
    const runAfter = repos.runs.getById(run.id)!;

    return {
        joined: true,
        defectedFrom: existing ? existing.sectId : null,
        sect: {
            id: sect.id,
            name: sect.name,
            alignment: sect.alignment,
            ...(sectCatalogFacts(sect.id) ?? {})
        },
        membership,
        // What the seat was decided by, so a player can check it and a test can
        // assert it without re-deriving the ladder.
        entryRankIndex: entryIndex,
        entryRankTitle: sect.ranks[entryIndex] ?? null,
        entryRequiredOrdinal: requiredOrdinalForRank(sect.admissionOrdinal, entryIndex),
        seatedAboveTheDoor: entryIndex > 0,
        // SAID, not merely applied. A returning member seated below what their
        // rung would otherwise buy has to be told why, or the house looks as
        // though it has simply misjudged them.
        returning: before === null ? null : {
            leftAsRankTitle: before.rankTitle,
            leftAsRankIndex: before.rankIndex,
            contributionForfeited: before.contribution,
            cappedByReturn,
            note: cappedByReturn
                ? `${sect.name} has had ${cultivator.name} before, and takes them back at the seat `
                  + `they left: ${before.rankTitle}. What a stranger is seated by is what they `
                  + 'visibly are; somebody who walked out last week is not a stranger. The '
                  + `${before.contribution} contribution they gave up on the way out is gone, and `
                  + 'the way back up is the way everybody else goes.'
                : `${sect.name} has had ${cultivator.name} before, at ${before.rankTitle}, and `
                  + 'this is not above it.'
        },
        cultivator: describeCultivator(repos, after, runAfter)
    };
}

export async function handleLeave(args: z.infer<typeof LeaveSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const membership = repos.sects.getMembership(cultivator.id);
    if (!membership) {
        return guidingError('not_a_member', `${cultivator.name} serves no sect.`);
    }

    const sect = repos.sects.getById(membership.sectId);
    const removed = repos.db.transaction(() => {
        const ok = repos.sects.removeMember(membership.sectId, cultivator.id);
        repos.runs.incrementTurn(run.id, 1);
        return ok;
    })();

    const after = repos.cultivators.getById(cultivator.id)!;
    const runAfter = repos.runs.getById(run.id)!;

    return {
        left: removed,
        sect: sect ? { id: sect.id, name: sect.name } : { id: membership.sectId },
        formerRank: membership.rankTitle,
        contributionForfeited: membership.contribution,
        cultivator: describeCultivator(repos, after, runAfter),
        note: 'Contribution does not travel. Whatever was earned here stays here.'
    };
}

export async function handlePromote(args: z.infer<typeof PromoteSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const membership = repos.sects.getMembership(cultivator.id);
    if (!membership) {
        return guidingError('not_a_member', `${cultivator.name} serves no sect.`);
    }
    const sect = repos.sects.getById(membership.sectId);
    if (!sect) {
        return guidingError('unknown_sect', `Sect ${membership.sectId} no longer exists.`);
    }

    const nextIndex = membership.rankIndex + 1;
    if (nextIndex >= sect.ranks.length) {
        return guidingError(
            'at_highest_rank',
            `${membership.rankTitle} is the top of ${sect.name}. There is nowhere further inside these walls.`,
            { rankIndex: membership.rankIndex, rankTitle: membership.rankTitle }
        );
    }

    const needOrdinal = requiredOrdinalForRank(sect.admissionOrdinal, nextIndex);
    const needContribution = requiredContributionForRank(nextIndex);
    const unmet: string[] = [];
    if (cultivator.realmOrdinal < needOrdinal) {
        unmet.push(`realm ${rankName(needOrdinal)} (currently ${rankName(cultivator.realmOrdinal)})`);
    }
    if (membership.contribution < needContribution) {
        unmet.push(`${needContribution} contribution (currently ${membership.contribution})`);
    }

    if (unmet.length > 0) {
        return guidingError(
            'promotion_requirements_unmet',
            `${sect.name} will not raise ${cultivator.name} to ${sect.ranks[nextIndex]} yet: needs ${unmet.join(' and ')}.`,
            {
                targetRankIndex: nextIndex,
                targetRankTitle: sect.ranks[nextIndex],
                requiredOrdinal: needOrdinal,
                requiredContribution: needContribution,
                currentOrdinal: cultivator.realmOrdinal,
                currentContribution: membership.contribution,
                hint: 'Contribution is earned through sect work and donations, not asserted.'
            }
        );
    }

    const promoted = repos.db.transaction(() => {
        // The promotion is bought: the contribution is spent, not merely met.
        const withoutSpend = repos.sects.addContribution(
            membership.sectId, cultivator.id, -needContribution
        );
        const result = repos.sects.setRank(membership.sectId, cultivator.id, nextIndex);
        repos.runs.incrementTurn(run.id, 1);
        return result ?? withoutSpend;
    })();

    const after = repos.cultivators.getById(cultivator.id)!;
    const runAfter = repos.runs.getById(run.id)!;

    return {
        promoted: true,
        sect: { id: sect.id, name: sect.name },
        fromRank: membership.rankTitle,
        toRank: sect.ranks[nextIndex],
        rankIndex: nextIndex,
        contributionSpent: needContribution,
        newStipendPerMonth: sect.stipend[nextIndex] ?? 0,
        membership: promoted,
        cultivator: describeCultivator(repos, after, runAfter)
    };
}

export async function handleStipend(args: z.infer<typeof StipendSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const membership = repos.sects.getMembership(cultivator.id);
    if (!membership) {
        return guidingError('not_a_member', `${cultivator.name} serves no sect and draws no stipend.`);
    }
    const sect = repos.sects.getById(membership.sectId);
    if (!sect) {
        return guidingError('unknown_sect', `Sect ${membership.sectId} no longer exists.`);
    }

    const perMonth = repos.sects.stipendForRank(sect.id, membership.rankIndex);
    const lastPaidDay = readNumberFlag(repos.db, cultivator.id, FLAG_STIPEND_PAID_DAY, 0);
    const elapsed = Math.max(0, run.elapsedDays - lastPaidDay);
    const periods = Math.floor(elapsed / STIPEND_PERIOD_DAYS);
    const owed = periods * perMonth;

    if (periods === 0) {
        return guidingError(
            'nothing_accrued',
            `No stipend has accrued. ${round2(elapsed)} of ${STIPEND_PERIOD_DAYS} days have passed since the last payment.`,
            {
                perMonth,
                daysSinceLastPayment: round2(elapsed),
                daysUntilNext: round2(STIPEND_PERIOD_DAYS - elapsed),
                hint: 'Time is advanced by cultivation_manage.cultivate. Calling stipend twice does not pay twice.'
            }
        );
    }

    repos.db.transaction(() => {
        repos.cultivators.applyDeltas(cultivator.id, { spiritStones: owed });
        writeFlag(
            repos.db,
            cultivator.id,
            FLAG_STIPEND_PAID_DAY,
            String(lastPaidDay + periods * STIPEND_PERIOD_DAYS)
        );
        // Drawing a stipend is service rendered; the sect notices.
        repos.sects.addContribution(sect.id, cultivator.id, periods);
    })();

    const after = repos.cultivators.getById(cultivator.id)!;
    const runAfter = repos.runs.getById(run.id)!;

    return {
        paid: true,
        sect: { id: sect.id, name: sect.name },
        rank: membership.rankTitle,
        perMonth,
        monthsPaid: periods,
        spiritStonesPaid: owed,
        spiritStonesNow: after.spiritStones,
        daysCarriedForward: round2(elapsed - periods * STIPEND_PERIOD_DAYS),
        cultivator: describeCultivator(repos, after, runAfter)
    };
}

export const SiphonSchema = z.object({
    action: z.literal('siphon'),
    cultivatorId: z.string().optional(),
    /**
     * How greedily. Omitted means report the position without taking anything -
     * a player is entitled to know what the reserves hold and what the house has
     * already half-noticed before deciding.
     */
    pace: z.enum(['careful', 'steady', 'greedy']).optional(),
    /** Months to run at that pace. One period is 30 days. */
    months: z.number().int().min(1).max(240).optional().default(1)
});

/** Flags: what has been taken from a given house, and what it has noticed. */
const flagTaken = (sectId: string): string => `siphon_taken:${sectId}`;
const flagNotice = (sectId: string): string => `siphon_notice:${sectId}`;
/** Permanent, and the only mark any other house will ever hold against them. */
export const FLAG_MARKED_THIEF = 'marked_as_thief';

/**
 * Take from the house, quietly, over time.
 *
 * The whole of the betrayal the setting supports. There is no smash-and-grab -
 * see the header of `embezzlement.ts` for why - so this is a rate, a clock and
 * a risk, and the interesting decision is when to stop rather than whether to
 * start.
 */
export async function handleSiphon(args: z.infer<typeof SiphonSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const membership = repos.sects.getMembership(cultivator.id);
    if (!membership) {
        return guidingError('not_a_member', `${cultivator.name} serves no sect, and has nothing to steal from.`);
    }
    const sect = repos.sects.getById(membership.sectId);
    if (!sect) {
        return guidingError('unknown_sect', `Sect ${membership.sectId} no longer exists.`);
    }

    const rankCount = sect.ranks.length;
    if (!canReachReserves(membership.rankIndex, rankCount)) {
        const opensAt = sect.ranks.findIndex((_, i) => canReachReserves(i, rankCount));
        return guidingError(
            'no_access_to_reserves',
            `${membership.rankTitle} does not go near the reserves. ${sect.name} opens them at ` +
            `${sect.ranks[opensAt] ?? 'a rank this house does not have'}, and not before.`,
            {
                rankIndex: membership.rankIndex,
                rankTitle: membership.rankTitle,
                opensAtRankIndex: opensAt,
                opensAtRankTitle: sect.ranks[opensAt] ?? null,
                hint: 'Access is the rank. This is a crime a house has to promote somebody into.'
            }
        );
    }

    const base = baseReservesFor(sect.stipend);
    const state = {
        takenTotal: readNumberFlag(repos.db, cultivator.id, flagTaken(sect.id), 0),
        drawNotice: readNumberFlag(repos.db, cultivator.id, flagNotice(sect.id), 0)
    };

    // No pace named: report the position and take nothing.
    if (!args.pace) {
        const standing = siphonPeriod(state, base, 'careful', membership.rankIndex, rankCount);
        return {
            sect: { id: sect.id, name: sect.name },
            rank: { index: membership.rankIndex, title: membership.rankTitle },
            reserves: { held: Math.max(0, base - state.takenTotal), originally: base },
            alreadyTaken: state.takenTotal,
            suspicion: round2(state.drawNotice + noticeFromShortfall(state.takenTotal, base)),
            discoveryChanceIfCaughtNow: round2(discoveryChance(state.drawNotice + noticeFromShortfall(state.takenTotal, base))),
            paces: SIPHON_PACES,
            nextPeriodAtCareful: { wouldTake: standing.taken },
            narrationHint:
                `${sect.name} keeps ${Math.max(0, base - state.takenTotal).toLocaleString()} spirit stones in reserve, ` +
                `and ${membership.rankTitle} can sign for them. ` +
                (state.takenTotal > 0
                    ? `${state.takenTotal.toLocaleString()} is already gone, and the ledger is ${round2(state.drawNotice + noticeFromShortfall(state.takenTotal, base))} of the way to somebody asking about it. `
                    : 'Nothing has been taken and nobody has been given a reason to count. ') +
                'Nothing was taken now either - this was a look at the books. Careful takes half a per cent a month and buys years; greedy takes eight and buys months. The hole speaks for itself however slowly it is made, so the question is not whether to start but when to stop.',
            note:
                'Nothing was taken. Access is the rank, the pace is the whole strategy, and the ' +
                'shortfall speaks for itself however slowly it was made - so the question is when to stop.'
        };
    }

    // ── Run the months. Each is a draw and a chance the house works it out. ──
    const rng = new CultivationRNG(`${run.seed}:siphon:${cultivator.id}:${state.takenTotal}`);
    let current = state;
    let taken = 0;
    let months = 0;
    let caught = false;

    for (; months < args.months; months++) {
        const period = siphonPeriod(current, base, args.pace, membership.rankIndex, rankCount);
        current = { drawNotice: period.drawNotice, takenTotal: period.takenTotal };
        taken += period.taken;
        if (rng.next() < period.discoveryChance) { caught = true; months++; break; }
    }

    const days = months * SIPHON_PERIOD_DAYS;
    const suspicion = current.drawNotice + noticeFromShortfall(current.takenTotal, base);

    const applied = repos.db.transaction(() => {
        writeFlag(repos.db, cultivator.id, flagTaken(sect.id), String(current.takenTotal));
        writeFlag(repos.db, cultivator.id, flagNotice(sect.id), String(current.drawNotice));
        repos.cultivators.applyDeltas(cultivator.id, { spiritStones: taken });
        repos.runs.advanceDays(run.id, days);
        repos.runs.incrementTurn(run.id, 1);
        return true;
    })();
    void applied;

    if (!caught) {
        const after = repos.cultivators.getById(cultivator.id)!;
        const runAfter = repos.runs.getById(run.id)!;
        return {
            caught: false,
            sect: { id: sect.id, name: sect.name },
            monthsRun: months,
            takenThisTime: taken,
            takenInTotal: current.takenTotal,
            reservesLeft: Math.max(0, base - current.takenTotal),
            shareOfReservesGone: round2(current.takenTotal / Math.max(1, base)),
            suspicion: round2(suspicion),
            discoveryChanceNextPeriod: round2(discoveryChance(suspicion)),
            narrationHint:
                `${months} month${months === 1 ? '' : 's'} of it, at a ${args.pace} pace, and ` +
                `${taken.toLocaleString()} spirit stones came across without anybody saying anything. ` +
                `${current.takenTotal.toLocaleString()} of ${sect.name}'s reserve is gone in total, ` +
                `which is ${Math.round((current.takenTotal / Math.max(1, base)) * 100)} per cent of it. ` +
                (discoveryChance(suspicion) >= 0.5
                    ? 'The next reconciliation is more likely than not to find it. Whatever is being waited for, this is past the point of waiting.'
                    : discoveryChance(suspicion) >= 0.15
                        ? 'Somebody has started checking figures that used to be taken on trust. It is not a question yet. It is the shape of one.'
                        : 'Nobody has counted. The hole does not close and the notice does not fade, and every further month is drawn against a larger shortfall than the last.'),
            note:
                'Not noticed yet. The hole does not close and the notice does not fade; every ' +
                'further month is drawn against a larger shortfall than the last.',
            cultivator: describeCultivator(repos, after, runAfter)
        };
    }

    // ── Found out. The rank was the access, so the rank goes with it. ──
    const held = repos.cultivators.getById(cultivator.id)!.spiritStones;
    const outcome = resolveDiscovery(held, current.takenTotal, membership.contribution);
    repos.db.transaction(() => {
        repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -outcome.recovered });
        repos.sects.removeMember(sect.id, cultivator.id);
        writeFlag(repos.db, cultivator.id, FLAG_MARKED_THIEF, sect.id);
    })();

    const after = repos.cultivators.getById(cultivator.id)!;
    const runAfter = repos.runs.getById(run.id)!;
    return {
        caught: true,
        sect: { id: sect.id, name: sect.name },
        monthsRun: months,
        takenInTotal: current.takenTotal,
        recovered: outcome.recovered,
        keptAnyway: Math.max(0, current.takenTotal - outcome.recovered),
        formerRank: membership.rankTitle,
        contributionForfeited: outcome.contributionForfeited,
        markedAsThief: true,
        narrationHint:
            `${sect.name} reconciled the reserve and the figure did not come out. ` +
            `${current.takenTotal.toLocaleString()} stones, over ${months} month${months === 1 ? '' : 's'}, ` +
            `taken by its own ${membership.rankTitle}. They take back the ${outcome.recovered.toLocaleString()} ` +
            'still in the purse and cannot touch what has already been spent. The rank goes with it, ' +
            'because the rank was the access. ' +
            (outcome.contributionForfeited > 0
                ? `${outcome.contributionForfeited} contribution, earned over a lifetime of service to them, is struck off. `
                : '') +
            'Resigning would have cost the contribution and nothing else. Being found out follows the name.',
        note:
            `${sect.name} reconciled the reserve and found the shortfall. The rank is gone because ` +
            'the rank was the access, the contribution is gone because it was always theirs to ' +
            'withdraw, and what has already been spent cannot be taken back. This is the difference ' +
            'between resigning and being found out, and it follows the name.',
        cultivator: describeCultivator(repos, after, runAfter)
    };
}

export async function handleStanding(args: z.infer<typeof StandingSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const membership = repos.sects.getMembership(cultivator.id);
    if (!membership) {
        return {
            member: false,
            cultivator: { id: cultivator.id, name: cultivator.name, rank: rankName(cultivator.realmOrdinal) },
            note: 'Unaffiliated. No stipend, no array, no elder, and nobody to notice if this run ends badly.'
        };
    }

    const sect = repos.sects.getById(membership.sectId);
    if (!sect) {
        return guidingError('unknown_sect', `Sect ${membership.sectId} no longer exists.`);
    }

    const nextIndex = membership.rankIndex + 1;
    const atTop = nextIndex >= sect.ranks.length;
    const lastPaidDay = readNumberFlag(repos.db, cultivator.id, FLAG_STIPEND_PAID_DAY, 0);
    const elapsed = Math.max(0, run.elapsedDays - lastPaidDay);

    return {
        member: true,
        sect: {
            id: sect.id,
            name: sect.name,
            alignment: sect.alignment,
            powerRank: rankName(sect.powerOrdinal),
            memberCount: repos.sects.listMembers(sect.id).length,
            ...(sectCatalogFacts(sect.id) ?? {})
        },
        rank: {
            index: membership.rankIndex,
            title: membership.rankTitle,
            ladder: sect.ranks,
            stipendPerMonth: repos.sects.stipendForRank(sect.id, membership.rankIndex)
        },
        contribution: membership.contribution,
        nextRank: atTop
            ? null
            : {
                index: nextIndex,
                title: sect.ranks[nextIndex],
                requiredOrdinal: requiredOrdinalForRank(sect.admissionOrdinal, nextIndex),
                requiredRank: rankName(requiredOrdinalForRank(sect.admissionOrdinal, nextIndex)),
                requiredContribution: requiredContributionForRank(nextIndex),
                ordinalShortfall: Math.max(
                    0,
                    requiredOrdinalForRank(sect.admissionOrdinal, nextIndex) - cultivator.realmOrdinal
                ),
                contributionShortfall: Math.max(
                    0,
                    requiredContributionForRank(nextIndex) - membership.contribution
                )
            },
        stipendAccrual: {
            perMonth: repos.sects.stipendForRank(sect.id, membership.rankIndex),
            daysSinceLastPayment: round2(elapsed),
            monthsOwed: Math.floor(elapsed / STIPEND_PERIOD_DAYS)
        },
        joinedAt: membership.joinedAt
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════

const definitions: Record<SectAction, ActionDefinition> = {
    siphon: {
        schema: SiphonSchema,
        handler: handleSiphon,
        aliases: ['embezzle', 'skim', 'divert'],
        description: "Take from the house reserves over time. Rank-gated, and the house notices eventually"
    },
    list: {
        schema: ListSchema,
        handler: handleList,
        aliases: ['all', 'sects', 'query'],
        description: 'Sects that exist, with admission gates and stipends'
    },
    join: {
        schema: JoinSchema,
        handler: handleJoin,
        aliases: ['enrol', 'enroll', 'apply'],
        description: 'Join a sect; the admission ordinal is enforced'
    },
    leave: {
        schema: LeaveSchema,
        handler: handleLeave,
        aliases: ['quit', 'defect', 'resign'],
        description: 'Leave the sect; contribution is forfeited'
    },
    promote: {
        schema: PromoteSchema,
        handler: handlePromote,
        aliases: ['advance', 'raise'],
        description: 'Advance one sect rank if realm and contribution allow it'
    },
    stipend: {
        schema: StipendSchema,
        handler: handleStipend,
        aliases: ['pay', 'draw', 'wages'],
        description: 'Draw the stipend that has accrued since the last payment'
    },
    standing: {
        schema: StandingSchema,
        handler: handleStanding,
        aliases: ['status', 'membership'],
        description: 'Rank, contribution, next-rank requirements, stipend accrual'
    },
    prospect: {
        schema: ProspectSchema,
        handler: handleProspect,
        aliases: ['consider', 'weigh', 'access', 'worth_joining'],
        description: 'Would joining this house put anything new within reach - the thing a sect actually sells'
    },
    patronage: {
        schema: PatronageSchema,
        handler: handlePatronage,
        aliases: ['backing', 'patron', 'guest_elder', 'grant'],
        description: 'Who backs this house and on what terms; or be seated as a guest elder, which is not membership'
    },
    verify_claim: {
        schema: VerifyClaimSchema,
        handler: handleVerifyClaim,
        aliases: ['certify', 'audit', 'verify', 'certification'],
        description: 'Buy a certification of a faction\'s ancestral claim. Published either way.'
    },
    denounce: {
        schema: DenounceSchema,
        handler: handleDenounce,
        aliases: ['accuse', 'expose', 'denunciation'],
        description: 'Say it in public. It lands only if a certification is already in hand.'
    },
    petition: {
        schema: PetitionSchema,
        handler: handlePetition,
        aliases: ['appeal', 'ask_upward', 'request'],
        description: 'Send a request upward through the chain, as far as somebody will pass it'
    },
    wake: {
        schema: WakeSchema,
        handler: handleWake,
        aliases: ['ancestor', 'dormant', 'under_the_mountain'],
        description: 'What it would take to wake the thing under the mountain, and what waking it costs'
    },
    above: {
        schema: AboveSchema,
        handler: handleAbove,
        aliases: ['hierarchy', 'stack', 'who_rules', 'over'],
        description: 'What stands above this house, as far as this cultivator can name it'
    },
    authority: {
        schema: AuthoritySchema,
        handler: handleAuthority,
        aliases: ['command', 'powers', 'what_can_i_do', 'lead'],
        description: 'What this rank may make other people do, what it would cost, and what the house currently thinks'
    },
    order: {
        schema: OrderSchema,
        handler: handleOrder,
        aliases: ['send', 'tell', 'delegate', 'dispatch', 'instruct'],
        description: 'Send the rungs below on an errand. Their days instead of yours; opens at rung one'
    },
    recruit: {
        schema: RecruitSchema,
        handler: handleRecruit,
        aliases: ['take_in', 'hire', 'enlist', 'take_disciples'],
        description: 'Take disciples in under your own line (elder rungs), or buy an elder in from outside (the seat)'
    },
    admission: {
        schema: AdmissionSchema,
        handler: handleAdmission,
        aliases: ['standard', 'set_bar', 'entrance', 'admit_from'],
        description: 'Set the realm the house admits from. Both directions insult somebody'
    },
    curriculum: {
        schema: CurriculumSchema,
        handler: handleCurriculum,
        aliases: ['methods', 'library', 'teach', 'foundational_methods'],
        description: 'Change what the house hands its intake. Generational, and the dearest thing here'
    },
    expel: {
        schema: ExpelSchema,
        handler: handleExpel,
        aliases: ['dismiss', 'fire', 'remove_elder', 'cast_out'],
        description: 'Dismiss an elder. They leave with their disciples, and the next one costs more'
    },
    grow: {
        schema: GrowSchema,
        handler: handleGrow,
        aliases: ['expand', 'build_up', 'enlarge'],
        description: 'Make the house bigger over decades. The only act that earns standing rather than spending it'
    },
    guest: {
        schema: GuestSchema,
        handler: handleGuest,
        aliases: ['sit_in', 'study_under', 'study_at', 'guest_student', 'visiting_student', 'attend'],
        description: 'Sit in at a house that has not taken you. Access and nothing else, and you keep your own house'
    }
};

const router = createActionRouter({ actions: ACTIONS, definitions, threshold: 0.6 });

export const SectManageTool = {
    name: 'sect_manage',
    description: `Sect membership: admission, rank, contribution, stipend.

- list      sects, alignment, admission ordinal, stipend ladder, territory, what they teach, who
            they feud with, and the state of the inherited compound they occupy
- join      the admission ordinal AND the catalog's attribute minimums are enforced by the engine.
            Being narrated impressively does not get a Qi Condensation disciple into a Core
            Formation sect. The Hollow Court and the Kiln Court take no applicants at all.
- leave     contribution is forfeited; it does not travel
- promote   requires BOTH the realm ordinal and the contribution for the next rank; the
            contribution is spent, not merely met
- stipend   pays what has accrued since the last payment, from the in-world clock. Calling it
            twice in a row pays nothing the second time.
- standing  rank, contribution, exactly what the next rank costs

POLITICS - the half of a sect that is not a stipend:
- prospect  would joining put anything NEW within reach. Access is a hard filter on comprehension:
            a road with nothing behind it is absent rather than difficult, and effort does not
            widen the set. This is what a house is mechanically selling.
- patronage who backs this house, on what terms, and what independence costs the ones nobody
            backs. seekGuestElder seats a cultivator STRONGER than the house as a guest: no rank,
            no contribution, and they may walk out during a siege with nothing to point at.
- verify_claim  buy a certification of a faction's claimed living ancestor. Sold to the claimant
            or to a rival and PUBLISHED EITHER WAY, so the house learns somebody paid to check.
- denounce  say it in public. It lands if and only if a certification is already in hand; without
            one the house does not have to answer and will not, and it remembers the name.
- petition  send a request upward. It travels as far as somebody is willing AND ABLE to pass it,
            which is usually not far - most houses do not know what is above their own patron.
            Reaching a tier is one of the few legitimate ways a new name enters a run.
- wake      the thing under the mountain: where it lies, what would wake it, what waking costs.
            Hidden ones stay hidden from outsiders. No caller may assert the condition is met.
- above     what stands above this house, AS FAR AS THIS CULTIVATOR CAN NAME IT. Beyond that
            you get what is noticed with nobody's name on it. Do not narrate past the last name.

AUTHORITY - what a rank makes other people do. AUTHORITY IS THE RANK INDEX AND IT REACHES EVERY
LOWER RUNG IN THE SAME HOUSE. Not a tier table: an Outer Disciple sends servants, an Inner
Disciple sends outer disciples and servants, the head of the house sends anybody. Standing is
one number for the whole ladder and every act below spends it.
- authority what this rank may do, what each act would cost in standing, who the elders are and
            how many disciples each of them brought in. Takes nothing and changes nothing.
- order     send the rungs below on an errand: gather (herbs), carry (spirit stones), labour
            (contribution). Opens at rung ONE, and it is the first thing membership actually
            buys - it spends their days instead of the caller's. Ordering upward fails.
- recruit   elder rungs take disciples in under their own line, which costs years and stones and
            builds the following that makes a later bid for the seat survivable. The seat may
            also buy an elder in from OUTSIDE, which is the specific insult to whoever waited.
- admission the realm the house admits from. Raising it insults everyone admitted under the old
            bar; lowering it insults everyone whose only distinction was clearing it. Enforced by
            join and it is the same number promotion is measured from.
- curriculum what the house hands its intake. The dearest act here, and generational: the decree
            is immediate and takes thirty years to be what the house is.
- expel     dismiss an elder. They do not leave alone - the disciples in their line go too - and
            each dismissal costs more than the last.
- grow      decades of deliberate intake. The ONLY act that earns standing. Through the seat is
            slow and the new people are yours; through the elders is faster and they are theirs.

BACKLASH escalates and is visible before it lands: grumbling, then obstruction (the order is
simply not carried out - the one roll, and its odds come from accumulated standing), then
departure (elders walk and take their followings, shrinking the house), then a challenge to the
seat, and for a house that answers to a patron, removal by letter with no fight to win.

Actions: ${ACTIONS.join(', ')}
Aliases: enrol/apply->join, quit/defect->leave, pay/draw->stipend, membership->standing,
certify->verify_claim, accuse->denounce, hierarchy->above, backing->patronage,
send/tell/delegate->order, dismiss/fire->expel, command/powers->authority`,
    actionSchemas: router.actionSchemas,
    inputSchema: z.object({
        action: z.string().describe(`Action: ${ACTIONS.join(', ')}`),
        cultivatorId: z.string().optional(),
        sectId: z.string().optional(),
        alignment: z.enum(['righteous', 'neutral', 'demonic']).optional(),
        admissibleOnly: z.boolean().optional(),
        seekGuestElder: z.boolean().optional(),
        matter: z.string().optional(),
        // Authority
        errand: z.enum(['gather', 'carry', 'labour']).optional(),
        toRankIndex: z.number().int().optional(),
        hands: z.number().int().optional(),
        days: z.number().int().optional(),
        kind: z.enum(['disciple', 'elder']).optional(),
        count: z.number().int().optional(),
        ordinal: z.number().int().optional(),
        teach: z.array(z.string()).optional(),
        retire: z.array(z.string()).optional(),
        elderId: z.string().optional(),
        through: z.enum(['seat', 'elders']).optional(),
        decades: z.number().int().optional(),
        accept: z.boolean().optional(),
        depart: z.boolean().optional()
    })
};

export async function handleSectManage(
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
            output = RichFormatter.header('Sect Error', '❌');
            output += RichFormatter.alert(data.message || 'Unknown error', 'error');
            if (data.hint) output += `\n*${data.hint}*\n`;
        } else if (data.sects) {
            output = RichFormatter.header(`Sects (${data.count})`, '🏯');
            output += RichFormatter.table(
                ['Name', 'Alignment', 'Admits from', 'Power', 'Members', 'Open'],
                data.sects.map((s: Record<string, unknown>) => [
                    String(s.name), String(s.alignment), String(s.admissionRank),
                    String(s.powerRank), String(s.memberCount),
                    s.admissible === null ? '?' : s.admissible ? 'yes' : 'no'
                ])
            );
            if (data.note) output += RichFormatter.alert(String(data.note), 'info');
        } else if (data.joined) {
            output = RichFormatter.header(`Joined ${data.sect?.name}`, '🏯');
            output += RichFormatter.keyValue({
                'Rank': data.membership?.rankTitle,
                'Defected from': data.defectedFrom ?? '-'
            });
        } else if (data.promoted) {
            output = RichFormatter.header('Promoted', '🎖️');
            output += RichFormatter.keyValue({
                'Sect': data.sect?.name,
                'From': data.fromRank,
                'To': data.toRank,
                'Contribution spent': data.contributionSpent,
                'New stipend': `${data.newStipendPerMonth}/month`
            });
        } else if (data.paid) {
            output = RichFormatter.header('Stipend Drawn', '💰');
            output += RichFormatter.keyValue({
                'Sect': data.sect?.name,
                'Months': data.monthsPaid,
                'Stones paid': data.spiritStonesPaid,
                'Now holding': data.spiritStonesNow
            });
        } else {
            output = RichFormatter.header('Sect Standing', '🏯');
            output += RichFormatter.keyValue({
                'Sect': data.sect?.name ?? '(none)',
                'Rank': data.rank?.title ?? '-',
                'Contribution': data.contribution ?? 0,
                'Next rank': data.nextRank?.title ?? '-'
            });
        }

        output += RichFormatter.embedJson(data, 'SECT_MANAGE');
        return { content: [{ type: 'text', text: output }] };
    } catch {
        return response;
    }
}
