/**
 * Sect politics: the half of a sect that is not a stipend.
 *
 * The catalogs have carried all of this for a while and none of it had an
 * action attached: dormant ancestors with a wake condition and a wake cost,
 * grievances, the things a faction is certain of and wrong about, the whole
 * `claimIsTrue` apparatus, four governance models, parentage chains, and guest
 * elders who are neither members nor outsiders. Data with no verb is not in the
 * game.
 *
 *   prospect      would joining this house put anything new within reach
 *   patronage     who backs this faction, on what terms - and being taken on
 *                 as a guest elder, which is not membership and never becomes it
 *   verify_claim  buy a certification of somebody's ancestral claim
 *   denounce      say it in public, and find out whether you had evidence
 *   petition      send a request upward through the chain, as far as it goes
 *   wake          the thing under the mountain: what it would take, and what
 *                 waking it costs
 *
 * ── TWO RULES THAT GOVERN EVERY LINE BELOW ────────────────────────────────
 *
 * 1. THE DISCOVERY GATE APPLIES TO TOOL OUTPUT. `docs/world/discovery.md` is
 *    not a narration guideline that stops at the prompt boundary - if these
 *    actions hand back the apex institution's name to a cultivator who has
 *    never heard of it, the careful work in `web/knowledge.ts` is undone from
 *    behind. So the stack comes back as far as this cultivator can name it and
 *    no further, and the rest arrives as `unattributedEffectsOf` - the things
 *    that visibly happen with nobody's name on them.
 *
 * 2. NO STRUCTURAL LABELS. `governance: 'federated'` is a category that invites
 *    a narrator to explain the world instead of showing it. What comes back is
 *    what it is like from below: somebody nearby to petition, or a counter with
 *    a queue at it. The model is used to decide; it is not the answer.
 */

import { z } from 'zod';
import { rankName } from '../../engine/cultivation/index.js';
import { hasAccessTo } from '../../engine/cultivation/understanding.js';
import {
    auditAncestralClaim,
    getSect,
    getSectAncestry,
    isDaoHouse,
    getDaoHouse
} from '../../data/cultivation/sects.js';
import { FACTION_CHARACTER } from '../../data/cultivation/faction-character.js';
import {
    DIRECT_RULE,
    REGION_GOVERNANCE,
    UNBACKED_PLAYER_TRADE,
    chainToApex,
    getApexInstitution,
    getCourt,
    getGuestElders,
    getParentage,
    mayBeNamed,
    tierOf,
    unattributedEffectsOf
} from '../../data/cultivation/hierarchy.js';
import { getTechnique } from '../../data/cultivation/techniques.js';
import {
    discoveryContextFor,
    ensureCultivationDb,
    guidingError,
    isGuidingErrorBody,
    persistBeliefs,
    readFlag,
    resolveActiveRun,
    writeFlag
} from './cultivation-support.js';
import { standingOf } from './cultivation-mortal.js';
import { capabilityActorFor } from './cultivation-perception.js';
import {
    assessCapability,
    makeSubject,
    requirementsFromOpposition
} from '../../engine/world/index.js';
import { KnowledgeGate } from '../../web/knowledge.js';
import type { Cultivator, InsightDomain } from '../../schema/cultivation.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The house that sells certification of an ancestral claim.
 *
 * Only one institution in the world can settle whether a sect actually has an
 * ancestor above the Lid, and it sells the answer to the claimant or to a
 * rival, publishing either way. That asymmetry is the whole market.
 */
export const CERTIFYING_HOUSE_ID = 'house-ninefold-ledger';

/**
 * Spirit stones a certification costs.
 *
 * The catalog's published placement fee, which is what the house charges for
 * the same kind of work: an authoritative statement about somebody else that
 * nobody else can make.
 */
export const CERTIFICATION_COST_STONES = 70;

/** Flag recording a guest arrangement. Not membership, and never becomes one. */
export const FLAG_GUEST_OF = 'guest_elder_of';

/** Claim key a certification's findings are filed under. */
export function traceClaimKey(factionId: string): string {
    return `ancestral_claim:${factionId}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

export const ProspectSchema = z.object({
    action: z.literal('prospect'),
    sectId: z.string().describe('The house being considered'),
    cultivatorId: z.string().optional()
});

export const PatronageSchema = z.object({
    action: z.literal('patronage'),
    sectId: z.string().optional().describe('Defaults to the cultivator\'s own sect'),
    seekGuestElder: z.boolean().optional().default(false)
        .describe('Offer to be seated as a guest elder. Neither member nor outsider.'),
    cultivatorId: z.string().optional()
});

export const VerifyClaimSchema = z.object({
    action: z.literal('verify_claim'),
    sectId: z.string().describe('The faction whose ancestral claim is to be certified'),
    cultivatorId: z.string().optional()
});

export const DenounceSchema = z.object({
    action: z.literal('denounce'),
    sectId: z.string().describe('The faction being denounced'),
    cultivatorId: z.string().optional()
});

export const PetitionSchema = z.object({
    action: z.literal('petition'),
    sectId: z.string().optional().describe('Where the petition starts. Defaults to the cultivator\'s own sect.'),
    matter: z.string().min(1).max(400)
        .describe('What is being asked for, in the petitioner\'s own words. Never an outcome.'),
    cultivatorId: z.string().optional()
});

export const WakeSchema = z.object({
    action: z.literal('wake'),
    sectId: z.string().describe('The faction with something under its mountain'),
    cultivatorId: z.string().optional()
});

export const AboveSchema = z.object({
    action: z.literal('above'),
    sectId: z.string().optional().describe('Defaults to the cultivator\'s own sect'),
    cultivatorId: z.string().optional()
});

// ═══════════════════════════════════════════════════════════════════════════
// PROSPECT - THE ACCESS QUESTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Would joining this house put anything new within reach?
 *
 * Mechanically this is what a sect is actually selling. Access is a HARD FILTER
 * on comprehension, not a modifier: a road with nothing behind it is absent
 * rather than difficult, and two hundred years of effort will not widen the
 * set. So the honest answer to "should I join" is a set difference - what is
 * reachable from inside that is not reachable from outside - and that is a
 * question `hasAccessTo` was exported to answer without anybody duplicating the
 * derivation.
 */
export async function handleProspect(args: z.infer<typeof ProspectSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const sect = repos.sects.getById(args.sectId);
    const entry = getSect(args.sectId);
    if (!sect || !entry) {
        return guidingError('unknown_sect', `No sect with id ${args.sectId}.`);
    }

    const gate = new KnowledgeGate(repos.db);
    if (!gate.isAwareOf(cultivator.id, 'sect', sect.id)) {
        return guidingError(
            'sect_not_known',
            `${cultivator.name} has never heard of this house.`,
            {
                hint:
                    'A name has to reach a cultivator before they can weigh joining it. ' +
                    'sect_manage({ action: "list" }) shows the ones they hold.'
            }
        );
    }

    const current = discoveryContextFor(repos, cultivator, { runId: run.id });
    // What the house would put in the room: the arts it teaches, read as texts
    // this cultivator would then be able to read, and its signature art as a
    // teacher who holds it and is willing.
    const wouldTeach = entry.teaches
        .map(id => getTechnique(id))
        .filter((t): t is NonNullable<typeof t> => t !== undefined && t.element !== null)
        .map(t => ({ element: t.element, label: `${entry.name}: ${t.name}`, id: t.id }));

    const inside = {
        ...current.context,
        readableManuals: [...(current.context.readableManuals ?? []), ...wouldTeach],
        tradition: isDaoHouse(entry.id)
            ? {
                label: `${entry.name}, ${getDaoHouse(entry.id)?.principle ?? 'its own discipline'}`,
                subject: getDaoHouse(entry.id)?.principle ?? null,
                id: entry.id
            }
            : null
    };

    const opened: { domain: InsightDomain; subject: string; through: string }[] = [];
    for (const candidate of candidatesFor(cultivator, inside)) {
        const already = hasAccessTo(cultivator, candidate, current.context);
        if (already) continue;
        const via = hasAccessTo(cultivator, candidate, inside);
        if (!via) continue;
        opened.push({
            domain: candidate.domain,
            subject: candidate.subject,
            through: `${via.kind} - ${via.label}`
        });
    }

    return {
        sect: { id: sect.id, name: sect.name, admissionRank: rankName(sect.admissionOrdinal) },
        admissible: cultivator.realmOrdinal >= sect.admissionOrdinal && entry.recruits,
        // The set difference. An empty list is a real and common answer, and it
        // is the honest one: many houses have nothing to teach this person.
        putsWithinReach: opened,
        alreadyReachable: current.sources,
        note:
            opened.length === 0
                ? 'Nothing here is out of reach that would come into it. Whatever else this house offers, ' +
                  'it is not comprehension.'
                : 'Access is a filter, not a discount. What is listed here is currently absent rather than ' +
                  'difficult, and no amount of effort outside these walls will reach it.'
    };
}

/** Candidate comprehensions worth testing the difference against. */
function candidatesFor(
    cultivator: Cultivator,
    inside: Parameters<typeof hasAccessTo>[2]
): { domain: InsightDomain; subject: string }[] {
    // Derived from the inside context itself rather than from a list this
    // module keeps: the engine holds no library and neither does this file.
    const seen = new Set<string>();
    const out: { domain: InsightDomain; subject: string }[] = [];
    for (const manual of inside?.readableManuals ?? []) {
        if (!manual.element) continue;
        const key = `element:${manual.element}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ domain: 'element', subject: manual.element });
    }
    if (inside?.tradition?.subject) {
        const key = `${domainOfPrinciple(inside.tradition.subject)}:${inside.tradition.subject}`;
        if (!seen.has(key)) {
            seen.add(key);
            out.push({
                domain: domainOfPrinciple(inside.tradition.subject),
                subject: inside.tradition.subject
            });
        }
    }
    void cultivator;
    return out;
}

/** A Dao house's principle, as a comprehension domain. */
function domainOfPrinciple(principle: string): InsightDomain {
    switch (principle) {
        case 'karma': return 'karma';
        case 'fate': return 'time';
        case 'severance': return 'void';
        case 'space': return 'void';
        case 'fixity': return 'formation';
        default: return 'karma';
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// PATRONAGE
// ═══════════════════════════════════════════════════════════════════════════

export async function handlePatronage(args: z.infer<typeof PatronageSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const membership = repos.sects.getMembership(cultivator.id);
    const sectId = args.sectId ?? membership?.sectId;
    if (!sectId) {
        return guidingError('no_sect', 'Name a sect, or join one first.', {
            hint: 'sect_manage({ action: "patronage", sectId })'
        });
    }
    const sect = repos.sects.getById(sectId);
    const entry = getSect(sectId);
    if (!sect || !entry) return guidingError('unknown_sect', `No sect with id ${sectId}.`);

    const gate = new KnowledgeGate(repos.db);
    if (!gate.isAwareOf(cultivator.id, 'sect', sect.id)) {
        return guidingError('sect_not_known', `${cultivator.name} has never heard of this house.`);
    }

    const parentage = getParentage(sectId);
    const guests = getGuestElders(sectId);

    // ── The write: being seated as a guest elder. ──
    let seated: Record<string, unknown> | null = null;
    if (args.seekGuestElder) {
        // A guest elder provides presence. A faction seats one because it
        // fields a deterrent it could not otherwise field, so the bar is not a
        // rank ladder - it is being stronger than anything the house has.
        if (cultivator.realmOrdinal <= sect.powerOrdinal) {
            return guidingError(
                'nothing_to_offer',
                `${entry.name} already fields ${rankName(sect.powerOrdinal)}. ` +
                `Seating ${cultivator.name} at ${rankName(cultivator.realmOrdinal)} would deter nobody.`,
                {
                    sectPowerOrdinal: sect.powerOrdinal,
                    currentOrdinal: cultivator.realmOrdinal,
                    hint:
                        'A guest elder is not a senior member. It is a arrangement a house makes ' +
                        'because the guest is stronger than the house.'
                }
            );
        }
        if (membership && membership.sectId === sectId) {
            return guidingError(
                'already_a_member',
                'A member cannot be a guest of their own house. The whole value of the arrangement is not being one.',
                { hint: 'sect_manage({ action: "leave" }) first, and consider what that forfeits.' }
            );
        }
        writeFlag(repos.db, cultivator.id, FLAG_GUEST_OF, sectId);
        seated = {
            hostFactionId: sectId,
            hostName: entry.name,
            rank: null,
            contribution: null,
            provides: 'Presence. Nothing else is contracted and nothing else is expected.',
            receives: 'Cave rent on the house\'s ground at no charge, and its silence about where you were before.',
            term: 'Renewed by nothing more formal than staying.',
            leaveClause:
                'You may walk out at any time, including during a siege, and no oath, contract or ' +
                'obligation will exist that anyone could point at afterwards. The house knows this.',
            hostRisk:
                'You are stronger than its master, are not bound by its rules, and its disciples will ' +
                'begin coming to you rather than to its elders.'
        };
    }

    return {
        sect: { id: sect.id, name: sect.name, powerRank: rankName(sect.powerOrdinal) },
        // What backing actually is here, stated as terms rather than as a
        // category. A reader should be able to work out the model from the
        // terms without ever being told its name.
        backing: parentage
            ? {
                holds: parentage.holds,
                standing: parentage.standing,
                terms: parentage.terms
                    ? {
                        tributeStonesPerYear: parentage.terms.tributeStonesPerYear,
                        inKind: parentage.terms.inKind,
                        disciplesOwedPerCycle: parentage.terms.disciplesPerCycle,
                        whatItBuys: parentage.terms.buys,
                        renewal: parentage.terms.renewal
                    }
                    : null,
                // The unbacked survive for one specific reason each. General
                // resilience is not a reason and the catalog does not permit it.
                whyNobodyHasTakenThem: parentage.unbackedReason,
                independence: parentage.independenceStance,
                costOfIndependence: parentage.costOfIndependence,
                note: parentage.note
            }
            : null,
        unbackedTrade:
            parentage && parentage.parentFactionId === null
                ? {
                    upside: UNBACKED_PLAYER_TRADE.upside,
                    downside: UNBACKED_PLAYER_TRADE.downside,
                    trap: UNBACKED_PLAYER_TRADE.trap
                }
                : null,
        guestElders: guests.map(g => ({
            name: g.name,
            rank: rankName(g.realmOrdinal),
            provides: g.provides,
            receives: g.receives,
            term: g.term,
            hostRisk: g.hostRisk,
            guestRisk: g.guestRisk,
            leaveClause: g.leaveClause
        })),
        seatedAsGuestElder: seated,
        currentlyGuestOf: readFlag(repos.db, cultivator.id, FLAG_GUEST_OF),
        onDay: Math.floor(run.elapsedDays)
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// VERIFY A CLAIM
// ═══════════════════════════════════════════════════════════════════════════

export async function handleVerifyClaim(
    args: z.infer<typeof VerifyClaimSchema>
): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const sect = repos.sects.getById(args.sectId);
    const entry = getSect(args.sectId);
    if (!sect || !entry) return guidingError('unknown_sect', `No sect with id ${args.sectId}.`);

    const gate = new KnowledgeGate(repos.db);
    if (!gate.isAwareOf(cultivator.id, 'sect', sect.id)) {
        return guidingError('sect_not_known', `${cultivator.name} has never heard of this house.`);
    }
    if (!gate.isAwareOf(cultivator.id, 'sect', CERTIFYING_HOUSE_ID)) {
        return guidingError(
            'no_certifier_known',
            `${cultivator.name} does not know of anybody who does this work.`,
            {
                hint:
                    'Certification of an ancestral claim is sold by exactly one institution in the ' +
                    'world, and knowing that it exists is itself something to be learned.'
            }
        );
    }

    const audit = auditAncestralClaim(args.sectId);
    if (!audit) {
        return guidingError(
            'no_claim_to_certify',
            `${entry.name} claims no living ancestor. There is nothing to certify.`,
            {
                hint:
                    'A house that makes no claim cannot be caught making a false one. That is ' +
                    'usually why it makes none.'
            }
        );
    }

    if (cultivator.spiritStones < CERTIFICATION_COST_STONES) {
        return guidingError(
            'insufficient_stones',
            `The certification costs ${CERTIFICATION_COST_STONES} spirit stones; ` +
            `${cultivator.name} holds ${cultivator.spiritStones}.`,
            { required: CERTIFICATION_COST_STONES, held: cultivator.spiritStones }
        );
    }

    const onDay = Math.floor(run.elapsedDays);
    // The findings are what the auditors turned up. An honest claim comes back
    // clean, which is a purchase the buyer made and does not get refunded.
    const traces = audit.traces;
    const findings = traces.length === 0
        ? 'The auditors found nothing that does not match the claim.'
        : `The auditors found ${traces.length} thing${traces.length === 1 ? '' : 's'} that does not match the claim.`;

    repos.db.transaction(() => {
        repos.cultivators.applyDeltas(cultivator.id, {
            spiritStones: -CERTIFICATION_COST_STONES
        });
        persistBeliefs(repos.db, [
            {
                holderId: cultivator.id,
                claimKey: traceClaimKey(args.sectId),
                // `knows` rather than `believes`: this is a certification, and
                // it is accepted as proof by every righteous sect in the region.
                stance: 'knows',
                statement: findings,
                onDay,
                source: {
                    kind: 'read',
                    note: 'A certification bought from the house that sells them, and published either way.'
                },
                detail: {
                    factionId: args.sectId,
                    traces: traces.length,
                    // The finding is a fact about the claim, which is why it is
                    // evidence a denunciation can rest on.
                    claimStands: audit.true ? 1 : 0
                },
                confidence: 0.95,
                tags: ['certification', 'ancestral_claim', args.sectId]
            }
        ]);
    })();

    const after = repos.cultivators.getById(cultivator.id)!;

    return {
        certified: true,
        sect: { id: sect.id, name: sect.name },
        paidStones: CERTIFICATION_COST_STONES,
        spiritStonesNow: after.spiritStones,
        // Published either way. The claimant will hear that this was bought.
        published: true,
        findings: {
            claimStands: audit.true,
            recency: audit.recency,
            partingGiftIntact: audit.giftIntact,
            // The concrete things that do not match, which is what a
            // denunciation would have to rest on.
            traces
        },
        note:
            'The house sells this to the claimant or to a rival and publishes either way. ' +
            (audit.true
                ? 'This one holds, and the house being asked now knows somebody paid to check.'
                : 'This one does not hold, and the house being asked now knows somebody paid to check.')
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// DENOUNCE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Say it in public.
 *
 * The engine decides whether it lands, and it decides on ONE thing: whether the
 * denouncer is holding evidence. An accusation with a certification behind it
 * is a problem the accused institution has to answer; the same words without
 * one are a person shouting, and the house has forty-one towns' worth of
 * arbitration benches and a great deal more standing than the shouter.
 *
 * Both outcomes write real state, and neither is a coin flip.
 */
export async function handleDenounce(args: z.infer<typeof DenounceSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const sect = repos.sects.getById(args.sectId);
    const entry = getSect(args.sectId);
    if (!sect || !entry) return guidingError('unknown_sect', `No sect with id ${args.sectId}.`);

    const gate = new KnowledgeGate(repos.db);
    if (!gate.isAwareOf(cultivator.id, 'sect', sect.id)) {
        return guidingError('sect_not_known', `${cultivator.name} has never heard of this house.`);
    }

    const onDay = Math.floor(run.elapsedDays);
    const evidence = heldCertification(repos.db, cultivator.id, args.sectId);
    const character = FACTION_CHARACTER[args.sectId];

    // Evidence is a certification in hand that says the claim does not stand.
    // Nothing else counts, and the caller cannot supply one.
    const landed = evidence !== null && evidence.claimStands === false;

    repos.db.transaction(() => {
        persistBeliefs(repos.db, [
            {
                holderId: cultivator.id,
                claimKey: `denounced:${args.sectId}`,
                stance: 'knows',
                statement: landed
                    ? `Said in public, with a certification in hand, that ${entry.name}'s claim does not stand.`
                    : `Said in public that ${entry.name} is not what it says it is, and produced nothing.`,
                onDay,
                source: { kind: 'witnessed', note: 'Said it themselves, in front of people.' },
                detail: { factionId: args.sectId, hadEvidence: landed ? 1 : 0 },
                confidence: 1,
                tags: ['denunciation', args.sectId]
            }
        ]);
        // The house now holds something about the denouncer, whichever way it
        // went. This is the row a grudge is later inherited from.
        persistBeliefs(repos.db, [
            {
                holderId: args.sectId,
                // A faction is a holder of memory in the same way a person is,
                // and the knowledge layer's holder kinds are 'character' and
                // 'public'. An institution's record of something said in front
                // of it is the public kind: it is not one person's memory, and
                // everybody in the house has it.
                holderKind: 'public',
                claimKey: `denounced_by:${cultivator.id}`,
                stance: 'knows',
                statement: `${cultivator.name} denounced us in public on day ${onDay}.`,
                onDay,
                source: { kind: 'witnessed', note: 'It happened in front of the house.' },
                detail: { cultivatorId: cultivator.id, hadEvidence: landed ? 1 : 0 },
                confidence: 1,
                tags: ['denunciation', 'grievance']
            }
        ]);
    })();

    return {
        denounced: true,
        sect: { id: sect.id, name: sect.name },
        // Whether it landed is decided by what was in the denouncer's hand, not
        // by how it was phrased.
        evidenceHeld: evidence !== null,
        landed,
        // What the house is actually aggrieved about, and what it holds with
        // total confidence and is wrong about. Both are what it will say back.
        houseAnswers: character
            ? {
                grievance: character.grievance,
                wrongAbout: character.wrongAbout
            }
            : null,
        consequence: landed
            ? 'The certification was already published. What changed today is that somebody stood up ' +
              'and read it out, and the house now knows exactly who.'
            : 'Nothing was produced. The house does not have to answer an assertion, and it will not - ' +
              'but it will remember the name, and so will everyone who was standing there.',
        note:
            'The house holds a record of this now. A grievance outlives the people who made it and ' +
            'travels down a line, which is what makes it worth more than the afternoon it cost.'
    };
}

interface HeldCertification {
    claimStands: boolean;
    onDay: number;
}

function heldCertification(
    db: import('better-sqlite3').Database,
    holderId: string,
    factionId: string
): HeldCertification | null {
    const row = db
        .prepare(`
            SELECT detail, acquired_on_day FROM knowledge_records
            WHERE holder_id = ? AND claim_key = ? AND superseded = 0
            ORDER BY acquired_on_day DESC LIMIT 1
        `)
        .get(holderId, traceClaimKey(factionId)) as
        | { detail: string; acquired_on_day: number }
        | undefined;
    if (!row) return null;
    try {
        const detail = JSON.parse(row.detail) as Record<string, unknown>;
        return {
            claimStands: Number(detail.claimStands) === 1,
            onDay: row.acquired_on_day
        };
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// PETITION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Send a request upward, and find out how far up there is.
 *
 * The petition travels the parentage chain one tier at a time and stops where
 * the world stops it. What comes back is never the whole stack: a tier can only
 * pass a petition to something it is itself aware of, and most sects are not
 * aware of what is above their own patron. Where the chain runs out of names
 * the cultivator holds, the answer is the effect without the attribution -
 * which is exactly how the top of this world reaches anybody.
 */
export async function handlePetition(args: z.infer<typeof PetitionSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const membership = repos.sects.getMembership(cultivator.id);
    const startId = args.sectId ?? membership?.sectId;
    if (!startId) {
        return guidingError(
            'nowhere_to_petition',
            `${cultivator.name} belongs to nothing and has named nothing. A petition needs somewhere to go.`,
            { hint: 'sect_manage({ action: "petition", sectId, matter })' }
        );
    }
    const start = repos.sects.getById(startId);
    if (!start) return guidingError('unknown_sect', `No sect with id ${startId}.`);

    const standing = standingOf(cultivator);
    const governance = REGION_GOVERNANCE[standing.regionId];
    const chain = chainToApex(startId);
    const gate = new KnowledgeGate(repos.db);
    const onDay = Math.floor(run.elapsedDays);

    const stops: Record<string, unknown>[] = [];
    const learned: string[] = [];
    let reached = 0;

    for (let i = 0; i < chain.length; i++) {
        const id = chain[i];
        const parentage = getParentage(id);
        const namable =
            gate.isAwareOf(cultivator.id, 'sect', id) ||
            (i === 0 && membership?.sectId === id);

        if (!namable) {
            // The petition went somewhere and the petitioner cannot say where.
            // That is not a failure state; it is the ordinary experience of
            // asking for something from below.
            const apex = getApexInstitution(id) ?? apexBehind(id);
            stops.push({
                tier: i,
                named: false,
                // Observable consequence only. No name, no category.
                whatIsNoticed: apex
                    ? unattributedEffectsOf(apex.id).slice(0, 2)
                    : ['A decision arrives from somewhere further off than anyone here can point to.']
            });
            break;
        }

        reached = i;
        const sectRow = repos.sects.getById(id);
        stops.push({
            tier: i,
            named: true,
            id,
            name: sectRow?.name ?? getCourt(id)?.name ?? getApexInstitution(id)?.name ?? id,
            // What passing it on would depend on, stated as circumstance.
            standingHere: parentage?.standing ?? 'not_applicable',
            holds: parentage?.holds ?? null,
            passesUpward: parentage?.parentFactionId !== null && parentage !== undefined
        });

        // A tier can only pass a petition to something it is itself aware of.
        // Most are not, and the petition stops there without anybody refusing it.
        if (parentage && !mayBeNamed(parentage.awarenessOfApex) && i + 1 < chain.length) {
            stops.push({
                tier: i + 1,
                named: false,
                whatIsNoticed: [
                    `${sectRow?.name ?? id} does not know where to send this, and says so in as many words as it can afford to.`
                ]
            });
            break;
        }

        // Reaching a tier is one of the few legitimate ways a name enters a
        // cultivator's world. It enters as a name, and nothing more.
        const next = chain[i + 1];
        if (next && parentage && mayBeNamed(parentage.awarenessOfApex)) {
            const nextName =
                repos.sects.getById(next)?.name ??
                getCourt(next)?.name ??
                getApexInstitution(next)?.name;
            if (nextName && gate.learnIfNew({
                holderId: cultivator.id,
                kind: 'sect',
                id: next,
                name: nextName,
                onDay,
                sourceKind: 'told',
                sourceNote: `Named in the answer to a petition sent up from ${sectRow?.name ?? id}.`,
                stance: 'believes'
            })) {
                learned.push(nextName);
            }
        }
    }

    return {
        petitioned: true,
        matter: args.matter,
        from: { id: start.id, name: start.name, tier: tierOf(startId) },
        // How far it actually went, which is usually not far.
        reachedTier: reached,
        chainLength: chain.length,
        stops,
        namesLearned: learned,
        // What petitioning is LIKE here, without ever naming the model.
        whatAskingIsLike: governance
            ? governance.fromBelow
            : 'There is nobody nearby with the authority to decide anything.',
        howLong:
            governance?.model === 'administered'
                ? DIRECT_RULE.legalism
                : 'An answer comes back through whoever passed it along, at whatever speed they care to.',
        note:
            'A petition travels as far as somebody is willing and able to pass it, and no further. ' +
            'Nothing above that answered, and nothing above that refused either.'
    };
}

/** The apex behind a court id, when the chain ends at one. */
function apexBehind(id: string): { id: string } | undefined {
    const court = getCourt(id);
    if (court) return { id: court.apexId };
    return getApexInstitution(id);
}

// ═══════════════════════════════════════════════════════════════════════════
// WAKE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The thing under the mountain.
 *
 * What this returns is the condition and the cost, and it deliberately does NOT
 * perform a waking. The wake condition is a fact about the world - "the library
 * is entered by force", "not theft, not trespass - force" - and there is no
 * state anywhere in this engine that records whether it has been met. Adding a
 * `conditionMet` parameter would be exactly the affordance the authority
 * boundary exists to refuse: a caller asserting the circumstance that produces
 * the outcome.
 *
 * So this is the honest half: it says what would do it, what it costs, and
 * refuses to be the mechanism. When the world layer can record that a library
 * was entered by force, this action resolves against that fact and not before.
 */
export async function handleWake(args: z.infer<typeof WakeSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { run, cultivator } = resolved;
    const sect = repos.sects.getById(args.sectId);
    const entry = getSect(args.sectId);
    if (!sect || !entry) return guidingError('unknown_sect', `No sect with id ${args.sectId}.`);

    const records = getSectAncestry(args.sectId);
    const dormant = records?.dormant ?? null;

    const membership = repos.sects.getMembership(cultivator.id);
    const isSenior =
        membership !== null &&
        membership.sectId === args.sectId &&
        membership.rankIndex >= sect.ranks.length - 2;
    const gate = new KnowledgeGate(repos.db);
    const onDay = Math.floor(run.elapsedDays);

    // Most of these are hidden, and they are hidden on purpose. Outsiders do
    // not know there is anything under the mountain, and a tool that says so
    // has leaked a revelation the run was supposed to earn.
    if (!dormant || (!dormant.publiclyKnown && !isSenior)) {
        return {
            sect: { id: sect.id, name: sect.name },
            somethingUnderTheMountain: false,
            note:
                'Nothing this cultivator knows of. That is not the same as nothing being there, and ' +
                'the engine will not say which.'
        };
    }

    // Learning that there is something under the mountain is a revelation, and
    // it is recorded as one so it cannot be un-learned by a later filter.
    const first = gate.learnIfNew({
        holderId: cultivator.id,
        kind: 'event',
        id: `dormant:${args.sectId}`,
        name: dormant.name,
        onDay,
        sourceKind: dormant.publiclyKnown ? 'told' : 'read',
        sourceNote: isSenior
            ? 'Shown the records that only the top of the house is shown.'
            : 'Common knowledge, in the way that a thing everybody repeats is common knowledge.',
        stance: 'believes',
        statement: `${dormant.name} is at ${dormant.restingPlace}.`
    });

    return {
        sect: { id: sect.id, name: sect.name },
        somethingUnderTheMountain: true,
        learnedJustNow: first,
        ancestor: {
            name: dormant.name,
            restingPlace: dormant.restingPlace,
            dormantYears: dormant.dormantYears,
            publiclyKnown: dormant.publiclyKnown
        },
        // The circumstance under which the house would actually break the
        // glass. Stated so it can be planned around, never so it can be claimed.
        wakeCondition: dormant.wakeCondition,
        // Nearly always the ancestor.
        wakeCost: dormant.wakeCost,
        // The risky action routed through the predicates rather than refused.
        // The seal is a physical fact, so `attempt` genuinely fails and says
        // why - which is the one legitimate reason it may fail at all.
        ifYouTriedItYourself: describeSealAssessment(cultivator, dormant, onDay),
        woken: false,
        whyNot:
            'The condition is a fact about the world, and no action anywhere in this engine lets a ' +
            'caller assert that it has been met. When something happens that satisfies it, it will ' +
            'have happened - and this will resolve against that, not against a claim about it.',
        note: run.turn >= 0 ? records?.standingNote ?? null : null
    };
}

/**
 * What breaking the seal yourself would actually mean.
 *
 * The requirements come from the engine's own opposition constructor against
 * the sleeper's real ordinal, so nothing here is arithmetic this file invented.
 * `alertness` is zero because a sleeper is not watching, and `attempt` is
 * blocked by the seal itself - a physical fact, and the only kind of reason
 * `attempt` is ever permitted to fail for.
 */
function describeSealAssessment(
    cultivator: Cultivator,
    dormant: { name: string; realmOrdinal: number; restingPlace: string },
    onDay: number
): Record<string, unknown> {
    const subject = makeSubject({
        kind: 'formation',
        id: `seal:${dormant.name}`,
        name: `the seal at ${dormant.restingPlace}`,
        requirements: requirementsFromOpposition({
            id: `seal:${dormant.name}`,
            name: dormant.name,
            realmOrdinal: dormant.realmOrdinal,
            alertness: 0
        }),
        // Shut, and there is no key row anywhere that opens it.
        sealed: true,
        keyId: null
    });
    const assessment = assessCapability(capabilityActorFor(cultivator), subject, onDay);
    return {
        sleeperRank: rankName(dormant.realmOrdinal),
        attempt: {
            holds: assessment.attempt.holds,
            blockers: assessment.attempt.blockers,
            reason: assessment.attempt.reason
        },
        survive: { likelihood: assessment.survive.likelihood, reason: assessment.survive.reason },
        force: { likelihood: assessment.force.likelihood, reason: assessment.force.reason },
        understand: {
            likelihood: assessment.understand.likelihood,
            reason: assessment.understand.reason
        },
        summary: assessment.summary
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// ABOVE - THE STACK, AS THIS CULTIVATOR KNOWS IT
// ═══════════════════════════════════════════════════════════════════════════

export async function handleAbove(args: z.infer<typeof AboveSchema>): Promise<object> {
    const repos = ensureCultivationDb();
    const resolved = resolveActiveRun(repos, { cultivatorId: args.cultivatorId });
    if (isGuidingErrorBody(resolved)) return resolved;

    const { cultivator } = resolved;
    const membership = repos.sects.getMembership(cultivator.id);
    const startId = args.sectId ?? membership?.sectId;
    const standing = standingOf(cultivator);
    const governance = REGION_GOVERNANCE[standing.regionId];
    const gate = new KnowledgeGate(repos.db);

    if (!startId) {
        return {
            standingIn: standing.regionName,
            // No structural label. What it is like from below, which is the
            // thing a person standing there could actually report.
            whatItIsLikeHere: governance?.fromBelow ?? 'Nobody nearby with authority to decide anything.',
            joiningHere: governance?.joining ?? null,
            stack: [],
            note: 'Unaffiliated, and nothing above them that they could name.'
        };
    }

    const chain = chainToApex(startId);
    const stack: Record<string, unknown>[] = [];
    for (let i = 0; i < chain.length; i++) {
        const id = chain[i];
        const known =
            gate.isAwareOf(cultivator.id, 'sect', id) || (i === 0 && membership?.sectId === id);
        if (!known) {
            const apex = apexBehind(id);
            stack.push({
                tier: i,
                named: false,
                // The whole of what an unaware cultivator gets: things that
                // visibly happen with nobody's name on them.
                whatIsNoticed: apex ? unattributedEffectsOf(apex.id) : []
            });
            break;
        }
        const parentage = getParentage(id);
        const row = repos.sects.getById(id);
        stack.push({
            tier: i,
            named: true,
            id,
            name: row?.name ?? getCourt(id)?.name ?? getApexInstitution(id)?.name ?? id,
            holds: parentage?.holds ?? null,
            standing: parentage?.standing ?? null,
            // What the arrangement costs them, which is the observable half of
            // whatever model it happens to be.
            pays: parentage?.terms
                ? {
                    stonesPerYear: parentage.terms.tributeStonesPerYear,
                    inKind: parentage.terms.inKind,
                    disciplesPerCycle: parentage.terms.disciplesPerCycle,
                    renewal: parentage.terms.renewal
                }
                : null
        });
    }

    return {
        standingIn: standing.regionName,
        whatItIsLikeHere: governance?.fromBelow ?? null,
        joiningHere: governance?.joining ?? null,
        from: { id: startId, name: repos.sects.getById(startId)?.name ?? startId },
        stack,
        note:
            'As far up as this cultivator can name, and no further. What is above that is not secret; ' +
            'they have simply never been given a word for it.'
    };
}
