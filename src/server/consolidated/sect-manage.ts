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
import { getSect, getSectAdmission } from '../../data/cultivation/sects.js';
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

const ACTIONS = ['list', 'join', 'leave', 'promote', 'stipend', 'standing'] as const;
type SectAction = typeof ACTIONS[number];

// ═══════════════════════════════════════════════════════════════════════════
// PROMOTION RULES
// The engine's, not the caller's. Stated here because sects are content and
// the promotion curve is mechanics.
// ═══════════════════════════════════════════════════════════════════════════

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

    const membership = repos.db.transaction(() => {
        const result = repos.sects.addMember(sect.id, cultivator.id, 0);
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
            Formation sect. The Hollow Court and the Kiln Wardens take no applicants at all.
- leave     contribution is forfeited; it does not travel
- promote   requires BOTH the realm ordinal and the contribution for the next rank; the
            contribution is spent, not merely met
- stipend   pays what has accrued since the last payment, from the in-world clock. Calling it
            twice in a row pays nothing the second time.
- standing  rank, contribution, exactly what the next rank costs

Actions: ${ACTIONS.join(', ')}
Aliases: enrol/apply->join, quit/defect->leave, pay/draw->stipend, membership->standing`,
    actionSchemas: router.actionSchemas,
    inputSchema: z.object({
        action: z.string().describe(`Action: ${ACTIONS.join(', ')}`),
        cultivatorId: z.string().optional(),
        sectId: z.string().optional(),
        alignment: z.enum(['righteous', 'neutral', 'demonic']).optional(),
        admissibleOnly: z.boolean().optional()
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
