/**
 * An engine result, turned into the sentences a player and an operator read.
 */
import { getMembersOf } from '../data/cultivation/members.js';
import { rankName } from '../engine/cultivation/realms.js';
import { LOW_SATIETY } from '../engine/cultivation/survival.js';
import type { PlayerDigest } from '../engine/world/digest.js';
import type { TimeSkipResult } from '../schema/cultivation.js';
import type { PlanSource, PlannedAction } from './actions.js';
import { DEATH_IN_WORLD, humanDays, type EngineFacts } from './facts.js';
import { routesOutOfAGap, sayingWhatWouldWork } from './gap-routes.js';
import { hearingProse, type Hearing } from './hearsay.js';
import {
    boardSample,
    describePurseCash,
    priceOf,
    type MarketPrice
} from './market-prices.js';
import type { Execution, ToolCallRecord } from './turn-wire-shapes.js';

/** Engine event summaries appended to the log per action, at most. */
export const MAX_LOGGED_EVENTS = 40;

/**
 * A structure line, with the name of the function that produced it taken off.
 */
const A_HANDLER_NAME_AT_THE_FRONT = /^[a-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+:\s*/;

/**
 * The sum somebody said they were putting down, off their own sentence.
 */
export function stonesNamedIn(sentence: string): number | null {
    const said = /\b(\d[\d,]*)\s*(?:spirit\s+)?stones?\b/i.exec(sentence);
    if (!said) return null;
    const value = Number.parseInt(said[1].replace(/,/g, ''), 10);
    return Number.isFinite(value) && value > 0 ? value : null;
}

export function withoutTheHandlerName(line: string): string {
    const stripped = line.replace(A_HANDLER_NAME_AT_THE_FRONT, '');
    if (stripped === line) return line;
    return stripped.length > 0 ? stripped[0].toUpperCase() + stripped.slice(1) : line;
}

/**
 * A time-skip, broken into the calls it actually made.
 */
export function skipCalls(action: string, skip: TimeSkipResult, provisioning: string | null): ToolCallRecord[] {
    const calls: ToolCallRecord[] = [];

    if (provisioning) {
        calls.push({
            name: 'cultivator.applyDeltas',
            action: 'buy_provisions',
            summary: provisioning,
            ok: true
        });
    }

    calls.push({
        name: 'engine.simulateTimeSkip',
        action,
        summary:
            `${skip.simulatedDays} of ${skip.requestedDays} day(s) resolved in one deterministic pass` +
            (skip.interrupted ? `, interrupted: ${skip.interruptReason ?? 'unspecified'}` : '') +
            `. ${skip.events.length} event(s); ` +
            `${skip.deltas.realmOrdinal >= 0 ? '+' : ''}${skip.deltas.realmOrdinal} rank, ` +
            `${Math.round(skip.deltas.cultivationProgress)} progress, ` +
            `${skip.deltas.injuriesGained} injury(ies).`,
        ok: true
    });

    for (const event of skip.events.slice(0, MAX_LOGGED_EVENTS)) {
        calls.push({
            name: 'engine.simulateTimeSkip',
            action: event.kind,
            summary: `Day ${Math.round(event.dayOffset)}: ${event.summary}`,
            ok: true
        });
    }
    if (skip.events.length > MAX_LOGGED_EVENTS) {
        calls.push({
            name: 'engine.simulateTimeSkip',
            action: 'events_elided',
            summary: `${skip.events.length - MAX_LOGGED_EVENTS} further event(s) are in the seclusion digest.`,
            ok: true
        });
    }

    calls.push({
        name: 'storage.applyTimeSkip',
        action: 'persist',
        summary:
            `Wrote the result: ${skip.simulatedDays} day(s) of in-world time, ` +
            `${skip.deltas.injuriesGained} injury row(s), one turn.`,
        ok: true
    });

    if (skip.died) {
        calls.push({
            name: 'cultivator.markDead',
            action: 'death',
            summary: `Run closed: ${skip.deathCause}. Permadeath - no reload, no revival.`,
            ok: true
        });
    }

    return calls;
}

/**
 * The handful of fields worth reading off an MCP handler's result.
 */
/**
 * Strip the deliberate-override word out of a named target.
 */
export function withoutTheOverride(target: string): string {
    return target.replace(/\b(?:anyway|anyhow|regardless|even so)\b/gi, '').replace(/\s+/g, ' ').trim();
}

export function summariseToolBody(body: Record<string, unknown>): string[] {
    const lines: string[] = [];

    // THE TERMS OF A GUEST PLACE
    if (typeof body.hostName === 'string' && Array.isArray(body.opens)) {
        const opens = body.opens as Array<{ name?: string; carriesTo?: string | null; requiredRank?: string }>;
        const kept = (body.keepsBack ?? []) as Array<{ name?: string; why?: string }>;
        const notYet = (body.openedButOutOfReach ?? []) as Array<{ name?: string; requiredRank?: string }>;

        lines.push(
            opens.length === 0
                ? `${body.hostName} would put nothing in front of you that you can open as you stand.`
                : `What they would show you: ${opens.map(o =>
                    `${o.name}${o.carriesTo ? `, which carries to ${o.carriesTo}` : ''}`
                ).join('; ')}.`
        );
        if (notYet.length > 0) {
            lines.push(
                `On the same shelf and out of your reach for now: ${notYet.map(o =>
                    `${o.name} (${o.requiredRank})`
                ).join('; ')}.`
            );
        }
        if (kept.length > 0) {
            lines.push(
                `They keep ${kept.length} thing${kept.length === 1 ? '' : 's'} back, `
                + `starting with ${kept[0].name}. ${kept[0].why ?? ''}`
            );
        }
        if (typeof body.watchesForYears === 'number') {
            lines.push(
                `They would watch you for ${body.watchesForYears} years before saying anything `
                + 'about what you are. That is not a price for the shelf - it is how long a '
                + 'house looks at somebody before it is willing to have an opinion.'
            );
        }
        for (const line of (body.notOffered ?? []) as string[]) lines.push(line);
        if (typeof body.yourOwnHouse === 'string') lines.push(body.yourOwnHouse);
        if (typeof body.stillOf === 'string') lines.push(`Still of: ${body.stillOf}`);
    }

    // WHERE SOMEBODY STANDS IN THEIR OWN HOUSE
    const returning = body.returning as { note?: string } | null | undefined;
    if (returning?.note) lines.push(returning.note);

    // BEING RAISED A RUNG
    if (body.promoted === true) {
        const sect = body.sect as { name?: string } | undefined;
        const to = typeof body.toRank === 'string' ? body.toRank : null;
        const from = typeof body.fromRank === 'string' ? body.fromRank : null;
        if (to) {
            lines.push(
                `${from ? `${from} no longer; ` : ''}${to}`
                + `${sect?.name ? ` of ${sect.name}` : ''}.`
                + (typeof body.contributionSpent === 'number'
                    ? ` It cost ${body.contributionSpent} contribution, which is gone rather than met.`
                    : '')
                + (typeof body.newStipendPerMonth === 'number'
                    ? ` The rank draws ${body.newStipendPerMonth} spirit stones a month.`
                    : '')
            );
        }
    }

    const rank = body.rank as { title?: string; stipendPerMonth?: number } | undefined;
    if (body.member === true && rank?.title) {
        const sect = body.sect as { id?: string; name?: string; memberCount?: number } | undefined;
        lines.push(
            `${rank.title}${sect?.name ? ` of ${sect.name}` : ''}`
            + `${typeof body.contribution === 'number' ? `, ${body.contribution} contribution` : ''}`
            + `${typeof rank.stipendPerMonth === 'number' ? `, ${rank.stipendPerMonth} spirit stones a month` : ''}.`
        );
        // WHO LEADS IT. "who leads this sect" came back with the generic
        // "knowing a name is not an introduction" line - the stranger's answer,
        // to a member, about their own house - and named two houses when the
        // player belongs to one. The roll is in the catalog and nothing read it.
        const head = [...getMembersOf(String(sect?.id ?? ''))]
            .sort((a, b) => b.realmOrdinal - a.realmOrdinal)[0];
        if (head) {
            lines.push(
                `${head.name} stands highest in it, at ${rankName(head.realmOrdinal)}`
                + `${head.rank ? ` and titled ${head.rank}` : ''}.`
            );
        }

        const next = body.nextRank as {
            title?: string; requiredRank?: string; requiredContribution?: number;
            ordinalShortfall?: number; contributionShortfall?: number;
        } | null | undefined;
        if (next?.title) {
            const wants: string[] = [];
            if ((next.ordinalShortfall ?? 0) > 0 && next.requiredRank) {
                wants.push(`${next.requiredRank}, which is ${next.ordinalShortfall} rung(s) up`);
            }
            if ((next.contributionShortfall ?? 0) > 0) {
                wants.push(`${next.requiredContribution} contribution, which is ${next.contributionShortfall} more`);
            }
            lines.push(wants.length === 0
                ? `${next.title} is open: the house has no further requirement to state.`
                : `${next.title} wants ${wants.join(' and ')}.`);
        } else if (body.nextRank === null) {
            lines.push('There is no rung above this one in the house.');
        }
    }
    if (body.member === false && typeof body.note === 'string') {
        lines.push(body.note);
    }

    const odds = body.odds as { finalChancePercent?: number; roll?: number } | undefined;
    if (odds && typeof odds.finalChancePercent === 'number') {
        lines.push(`Odds were ${odds.finalChancePercent}%, rolled ${odds.roll ?? 'unrecorded'}.`);
    }

    const produced = body.produced as { name?: string; effect?: string } | null | undefined;
    if (produced?.name) {
        lines.push(`Produced: ${produced.name}${produced.effect ? ` (${produced.effect})` : ''}.`);
    }

    const consumed = body.ingredientsConsumed as Array<{ name?: string; quantity?: number }> | undefined;
    if (Array.isArray(consumed) && consumed.length > 0) {
        lines.push(
            'Consumed whether it worked or not: ' +
            consumed.map(i => `${i.quantity ?? 1} x ${i.name ?? 'unknown'}`).join(', ') + '.'
        );
    }

    if (typeof body.masteryBefore === 'number' && typeof body.masteryAfter === 'number') {
        lines.push(
            `Mastery ${(body.masteryBefore * 100).toFixed(0)}% to ${(body.masteryAfter * 100).toFixed(0)}%.`
        );
    }
    const deviation = body.deviation as { deviated?: boolean; summary?: string } | undefined;
    if (deviation?.deviated && deviation.summary) lines.push(deviation.summary);

    // what a fight cost
    if (typeof body.outcome === 'string' && Array.isArray(body.exchanges)) {
        const them = body.opponent as { id?: string; name?: string } | undefined;

        // AND WHAT WOULD HAVE WORKED
        const gap = body.gap as { options?: unknown } | undefined;
        if (Array.isArray(gap?.options) && gap.options.length > 0) {
            lines.push(...sayingWhatWouldWork(
                routesOutOfAGap(gap.options as string[]),
                them?.name ?? 'somebody that far above you'
            ));
        }
        const exchanges = body.exchanges as Array<{
            damage?: number; defenderId?: string;
        }>;

        // Whose id is on the receiving end decides whose damage it was. The
        // opponent's id is the one field guaranteed present on both sides.
        const taken = exchanges
            .filter(x => x.defenderId !== undefined && x.defenderId !== them?.id)
            .reduce((sum, x) => sum + (x.damage ?? 0), 0);
        const dealt = exchanges
            .filter(x => x.defenderId !== undefined && x.defenderId === them?.id)
            .reduce((sum, x) => sum + (x.damage ?? 0), 0);

        const mine = body.cultivator as {
            vitals?: { hp?: number; maxHp?: number };
            mortality?: {
                untreatedInjuries?: number;
                crippledInjuryThreshold?: number;
                atCrippledInjuryThreshold?: boolean;
                injuryRatePenalty?: number;
            };
        } | undefined;
        const hp = mine?.vitals?.hp;
        const maxHp = mine?.vitals?.maxHp;

        if (taken > 0 || dealt > 0) {
            lines.push(
                `${exchanges.length} exchange${exchanges.length === 1 ? '' : 's'}: `
                + `${dealt} dealt, ${taken} taken`
                + `${typeof hp === 'number' && typeof maxHp === 'number'
                    ? `, which leaves ${hp} of ${maxHp}.` : '.'}`
            );
        }

        // The wounds by name. A player who does not know they are carrying one
        // cannot decide to have it treated, and untreated is the state that
        // kills.
        const hurt = body.injuries as {
            self?: Array<{ severity?: string; description?: string }>;
        } | undefined;
        const fresh = hurt?.self ?? [];
        if (fresh.length > 0) {
            // The descriptions are written as sentences and already carry a
            // full stop. Appending another produced "taken in combat..".
            const said = fresh
                .map(i => (i.description ?? i.severity ?? 'something').replace(/\.\s*$/, ''))
                .join('; ');
            lines.push(
                `Came away with ${fresh.length === 1 ? 'a wound' : `${fresh.length} wounds`}: ${said}.`
            );
        }

        // AND SAY WHAT CARRYING THEM COSTS.
        const carried = mine?.mortality?.untreatedInjuries;
        const crippledAt = mine?.mortality?.crippledInjuryThreshold;
        const rateLoss = mine?.mortality?.injuryRatePenalty;
        const cost = typeof rateLoss === 'number' && rateLoss > 0
            ? ` They are taking ${Math.round(rateLoss * 100)}% of the cultivation rate.`
            : '';
        if (typeof carried === 'number' && typeof crippledAt === 'number' && carried > 0) {
            lines.push(
                mine?.mortality?.atCrippledInjuryThreshold === true
                    ? `${carried} untreated wounds, which is the count at which the body stops mending `
                      + `itself. Nothing closes them on its own and nothing heals from here.${cost}`
                    : `${carried} untreated wound${carried === 1 ? '' : 's'} of the ${crippledAt} at `
                      + `which the body stops mending. They do not close on their own.${cost}`
            );
        }
    }

    // ── the mortal economy ──
    //
    // `work` and `market` return figures rather than a narration hint, because
    // the tool surface's caller is a model that will phrase them. Here they
    // have to become sentences or a player gets "The work is done." and nothing
    // else, which is how the first live check of this path read.
    if (body.worked === true) {
        const occupation = body.occupation as { name?: string } | undefined;
        const days = typeof body.daysWorked === 'number' ? body.daysWorked : 0;
        const paid = typeof body.spiritStonesEarned === 'number' ? body.spiritStonesEarned : 0;
        const now = typeof body.spiritStonesNow === 'number' ? body.spiritStonesNow : null;

        lines.push(
            `${humanDays(days)} of ${occupation?.name ?? 'whatever was going'}, ` +
            `and ${paid > 0 ? `${paid} spirit stones for it` : 'nothing to show for it'}` +
            `${now === null ? '.' : `, which leaves ${now}.`}`
        );
        lines.push(
            'Nothing was gathered in that time. That is what the money costs, and it is why a ' +
            'sect stipend is worth more than the stipend.'
        );
        if (typeof body.unpaid === 'string') lines.push(body.unpaid);

        // AND SAY IF THEY ARE STARVING.
        const satietyNow = typeof body.satiety === 'number' ? body.satiety : null;
        if (satietyNow !== null && satietyNow <= LOW_SATIETY) {
            const hpNow = typeof body.hp === 'number' ? body.hp : null;
            const hpMax = typeof body.maxHp === 'number' ? body.maxHp : null;
            lines.push(
                `Satiety is down to ${satietyNow}. The work pays and it does not feed you, `
                + 'and qi feeds the meridians rather than the body.'
                // Name the cost in the same breath. A player told they are
                // hungry, and separately that they are hurt, has to join the two
                // themselves - and nothing on the work board suggests they are
                // the same fact. Measured by playing: health slid from thirty to
                // fifteen across twenty years and the only warning was a number
                // about food.
                + (hpNow !== null && hpMax !== null && hpNow < hpMax
                    ? ` It is being taken out of you: ${hpNow} of ${hpMax} left.`
                    : '')
            );
        }

        // AND THE WOUNDS THE SPAN LEFT BEHIND.
        const carried = typeof body.untreatedInjuries === 'number'
            ? body.untreatedInjuries : null;
        const crippledAt = typeof body.crippledInjuryThreshold === 'number'
            ? body.crippledInjuryThreshold : null;
        if (carried !== null && carried > 0) {
            lines.push(
                crippledAt !== null && carried >= crippledAt
                    ? `${carried} untreated wounds, which is the count at which the body stops `
                      + 'mending itself. Nothing about the work will close them.'
                    : `${carried} untreated wound${carried === 1 ? '' : 's'}`
                      + `${crippledAt !== null ? ` of the ${crippledAt} at which a body stops mending` : ''}, `
                      + 'picked up along the way. They do not close on their own.'
            );
        }
    }

    // -- the sects --
    if (body.joined === true) {
        const joinedSect = body.sect as { name?: string } | undefined;
        const membership = body.membership as { rankTitle?: string } | undefined;
        lines.push(
            // "at ${rankTitle}" read as a place. Barrow Hand is the lowest
            // rank in the Gleaners' Company and it is also a town, so the line
            // told a player standing in Burnt Earth that they were somewhere
            // else. A rank has to be named as a rank.
            `Taken on by ${joinedSect?.name ?? 'the sect'}` +
            `${membership?.rankTitle ? `, ranked ${membership.rankTitle}` : ''}. ` +
            'No journey was involved and none is implied: being on their roll and being on their ' +
            'ground are two different things.'
        );
        if (typeof body.defectedFrom === 'string' && body.defectedFrom.length > 0) {
            lines.push(
                'Whatever standing was built at the last door stayed there. ' +
                'Contribution does not travel.'
            );
        }
    }

    // An art taken up. `handleLearn` returns the projection and no narration
    // hint, so without this the single most consequential thing a cultivator
    // can do to their own body lands in the generic catch-all.
    if (body.learned === true) {
        const art = body.technique as { name?: string; element?: string | null; grade?: string } | undefined;
        lines.push(
            `${art?.name ?? 'The art'} is held now, at nothing like mastery` +
            `${art?.element ? `, and it runs on ${art.element}` : ''}. ` +
            'Knowing a method and being able to use it are different distances, and practice is ' +
            'the only thing that closes the second one.'
        );
        if (body.elementConflict === true) {
            lines.push(
                'It fights the root rather than running with it. That is a permanent condition of '
                + 'carrying it, not a one-off risk that has now passed.'
            );
        }
        const dev = body.deviation as { deviated?: boolean; summary?: string } | null | undefined;
        if (dev?.summary) lines.push(dev.summary);
    }

    // The stipend, which is the whole reason a poor cultivator joins a house.
    if (body.consumed === true) {
        const swallowed = body.pill as { name?: string; grade?: string } | undefined;
        lines.push(
            `${swallowed?.name ?? 'The pill'}`
            + `${swallowed?.grade ? `, ${swallowed.grade} grade` : ''}, swallowed. It is gone `
            + 'whether it did anything or not.'
        );
        if (typeof body.applied === 'string') lines.push(body.applied);

        if (body.pendingBreakthroughPill) {
            lines.push(
                'It is held for the next bottleneck rather than spent now, and the engine prices it '
                + 'at the moment of the attempt - spent whether the attempt succeeds or not.'
            );
        }

        const tox = body.toxicity as {
            after?: number; tolerance?: number; crossedThreshold?: boolean;
        } | undefined;
        if (tox && typeof tox.after === 'number') {
            lines.push(tox.crossedThreshold
                ? `Toxicity is past ${tox.tolerance ?? 'the tolerance'} at `
                  + `${tox.after.toFixed(2)}. The medicine has become the injury, and that is a `
                  + 'real wound on a real body.'
                : `Toxicity stands at ${tox.after.toFixed(2)} of ${tox.tolerance ?? '?'}. `
                  + 'It does not clear on its own.');
        }
    }

    // A master's read of a student, which is a sentence about a person and not
    // about a place. `handleAssess` returns rows and no narration hint.
    if (body.against === 'student') {
        const stall = body.stall as {
            yearsAtCurrentRealm?: number; stagnationYears?: number;
            stalled?: boolean; yearsPast?: number; yearsRemaining?: number;
        } | undefined;
        const assessor = body.assessor as
            { name?: string; rank?: string; rungsAbove?: number } | null | undefined;

        lines.push(assessor
            ? `${assessor.name ?? 'Somebody'} stands ${assessor.rungsAbove ?? 0} rung`
              + `${assessor.rungsAbove === 1 ? '' : 's'} above you, at ${assessor.rank ?? 'an unnamed rank'}, `
              + 'and is qualified to say anything at all about where you are.'
            : 'Nobody standing over you is standing above you. Whatever comes next is not in '
              + 'this house, and nobody in it is in a position to tell you what it is.');

        if (stall) {
            lines.push(stall.stalled
                ? `${Math.round(stall.yearsAtCurrentRealm ?? 0)} years at this rung against the `
                  + `${Math.round(stall.stagnationYears ?? 0)} the ladder credits. You are `
                  + `${Math.round(stall.yearsPast ?? 0)} years past the point where sitting still `
                  + 'stops being patience.'
                : `${Math.round(stall.yearsAtCurrentRealm ?? 0)} years at this rung, of the `
                  + `${Math.round(stall.stagnationYears ?? 0)} the ladder credits. `
                  + `${Math.round(stall.yearsRemaining ?? 0)} still counted.`);
        }
        if (typeof body.note === 'string') lines.push(body.note);
    }

    // WHAT HAPPENS IF THEY TRY, WHICH IS THE WHOLE POINT OF THE VERB
    if (body.against === 'place' && body.assessed === true) {
        const saidBefore = lines.length;
        const where = body.place as
            { name?: string; hazards?: string[]; sealed?: boolean } | undefined;
        const verdicts = body.verdicts as Record<string, {
            likelihood?: string; reason?: string; blockers?: string[];
            unhandledHazards?: string[];
        }> | undefined;

        const survive = verdicts?.survive;
        const succeed = verdicts?.succeed;
        const attempt = verdicts?.attempt;

        // The blockers first: a shut door is not a matter of how strong
        // anybody is, and reading a survival chance for ground you cannot get
        // onto is answering the wrong question.
        const shut = attempt?.blockers ?? [];
        if (shut.length > 0) {
            lines.push(
                `${where?.name ?? 'It'} is not open to being tried at all as things stand: `
                + `${shut.join('; ')}.`
            );
        }
        if (survive?.likelihood) {
            lines.push(
                `Coming out of ${where?.name ?? 'it'} alive: ${survive.likelihood}. `
                + `${survive.reason ?? ''}`.trim()
            );
        }
        if (succeed?.likelihood && succeed.likelihood !== survive?.likelihood) {
            lines.push(
                `Getting what you went for: ${succeed.likelihood}. ${succeed.reason ?? ''}`.trim()
            );
        }
        // The specific thing that is not handled, which is the half a player can
        // act on - a hazard names the preparation that answers it.
        const unhandled = (survive?.unhandledHazards ?? []).map(h => h.replace(/_/g, ' '));
        if (unhandled.length > 0) {
            const shown = unhandled.slice(0, 2);
            lines.push(
                `Nothing you are carrying answers ${shown.join(', or ')}`
                + `${unhandled.length > shown.length
                    ? `, and ${unhandled.length - shown.length} more like them`
                    : ''}`
                + '. That is what would do it, rather than the rung.'
            );
        }
        if (where?.sealed === true) {
            lines.push('It is sealed. Something was shut here deliberately and has stayed shut.');
        }

        // AND WHO COULD REACH YOU ON IT
        const reach = body.reach as { lines?: string[] } | undefined;
        for (const line of reach?.lines ?? []) lines.push(line);
        // Only where nothing above landed. `assessment.summary` is the
        // capability layer's own one-liner and it restates the survival verdict
        // in different words - said after the sentences above, it is the same
        // fact twice, which is the repeated-clause half of the dump rule.
        if (lines.length === saidBefore && typeof body.summary === 'string') {
            lines.push(body.summary);
        }
    }

    // a petition, and how far it actually got
    if (body.petitioned === true) {
        const from = body.from as { name?: string } | undefined;
        const stops = typeof body.chainLength === 'number' ? body.chainLength : null;
        const reached = typeof body.reachedTier === 'string' ? body.reachedTier : null;

        lines.push(
            `Put to ${from?.name ?? 'them'}`
            + `${stops !== null ? `, and passed along ${stops === 1 ? 'once' : `${stops} times`}` : ''}`
            + `${reached ? `, reaching ${reached}` : ''}.`
        );
        // The house's own account of what asking is like. Written in the
        // world's voice by the tool layer, so it goes through as it stands.
        if (typeof body.whatAskingIsLike === 'string') lines.push(body.whatAskingIsLike);
        if (typeof body.howLong === 'string') lines.push(body.howLong);

        // A petition that travelled learned you names on the way, which is the
        // one thing a player takes from it whatever the answer.
        const learned = body.namesLearned;
        if (Array.isArray(learned) && learned.length > 0) {
            lines.push(
                `Names picked up passing it along: ${learned.map(n => String(n)).join(', ')}.`
            );
        }
        if (typeof body.note === 'string') lines.push(body.note);
    }

    if (body.paid === true) {
        const payingSect = body.sect as { name?: string } | undefined;
        const stones = typeof body.spiritStonesPaid === 'number' ? body.spiritStonesPaid : 0;
        const months = typeof body.monthsPaid === 'number' ? body.monthsPaid : 0;
        const now = typeof body.spiritStonesNow === 'number' ? body.spiritStonesNow : null;
        lines.push(
            `${stones} spirit stone${stones === 1 ? '' : 's'} drawn from ` +
            `${payingSect?.name ?? 'the sect'}` +
            `${months > 0 ? `, being ${months} month${months === 1 ? '' : 's'} of stipend` : ''}` +
            `${typeof body.rank === 'string' ? ` at ${body.rank}` : ''}` +
            `${now === null ? '.' : `. The purse holds ${now}.`}`
        );
        lines.push(
            'Drawing it is service rendered and the house marks it down. Nothing was gathered ' +
            'to earn it, which is exactly what a stipend is for.'
        );
        if (typeof body.daysCarriedForward === 'number' && body.daysCarriedForward > 0) {
            lines.push(
                `${Math.round(body.daysCarriedForward)} day(s) carry forward toward the next payment.`
            );
        }
    }

    if (body.left === true) {
        const formerSect = body.sect as { name?: string } | undefined;
        const formerRank = typeof body.formerRank === 'string' ? body.formerRank : null;
        lines.push(
            `No longer of ${formerSect?.name ?? 'the sect'}` +
            `${formerRank ? `, where the rank was ${formerRank}` : ''}.`
        );
        if (typeof body.note === 'string') lines.push(body.note);
    }

    const offered = body.work as Array<{ name?: string; cashPerMonth?: number; monthsLodgingItCovers?: number; risk?: string }> | undefined;
    if (Array.isArray(offered)) {
        if (offered.length === 0) {
            lines.push(
                'Nobody here is hiring anyone, for anything. Somewhere with more people in it ' +
                'will have something.'
            );
        } else {
            lines.push('What is going, for somebody standing where they are standing:');
            for (const job of offered.slice(0, 6)) {
                const keep = typeof job.monthsLodgingItCovers === 'number'
                    ? `, and a month of it keeps them about ${job.monthsLodgingItCovers} months`
                    : '';
                lines.push(`  ${job.name ?? 'unnamed work'}${keep}${job.risk ? ` (${job.risk})` : ''}.`);
            }
            lines.push(
                'A month spent earning is a month not spent cultivating. That is the whole of the choice.'
            );
        }
    }

    const prices = body.prices as MarketPrice[] | undefined;
    if (Array.isArray(prices)) {
        if (prices.length === 0) {
            lines.push(
                'Nobody here is selling anything. It is a road, or a hillside, and the nearest ' +
                'person with a stall is a long way off.'
            );
        } else {
            // The board is read out in full or it is not read out at all.
            //
            // It used to list eight and then count against twenty-five, so the
            // sentence underneath compared the purse to seventeen things the
            // player could not see. Either number can be right; having both on
            // screen cannot be.
            const shown = boardSample(prices);
            lines.push(
                shown.length === prices.length
                    ? 'What is on offer, and what it costs here:'
                    : `What is nearest to hand, of ${prices.length} things on offer:`
            );
            for (const item of shown) {
                lines.push(`  ${item.name ?? 'unnamed'}, ${priceOf(item)}.`);
            }

            // Said once, about the purse, rather than eleven times about the
            // goods. Whether a bowl of millet is out of reach is a fact about
            // the player, and repeating it on every line turns a market board
            // into a wall of the same sentence.
            const purse = body.purse as { cash?: number; spiritStones?: number } | undefined;
            const afford = shown.filter(item => item.affordable !== false).length;
            if (purse) {
                lines.push(
                    afford === 0
                        ? `The purse holds ${describePurseCash(purse)}, which is not enough for anything here.`
                        : afford === shown.length
                            ? `The purse holds ${describePurseCash(purse)}, which covers all of that.`
                            : `The purse holds ${describePurseCash(purse)}: ${afford} of those ${shown.length} are within it.`
                );
            }
        }
        // THE STALL NEXT TO THE COOKING POTS
        const books = body.manuals as Array<MarketPrice & {
            openAtThisRung?: boolean; note?: string;
        }> | undefined;
        if (Array.isArray(books) && books.length > 0) {
            lines.push('On the stall beside the cooking pots, block-printed and much copied:');
            for (const book of books) {
                lines.push(
                    `  ${book.name ?? 'unnamed'}, ${priceOf({ ...book, category: 'tool' })}`
                    + `${book.openAtThisRung === false ? ', which opens above where you stand' : ''}`
                    + `. ${book.note ?? ''}`.trimEnd()
                );
            }
            lines.push(
                'Block-printed and plainly set down. What a house\'s own canon has that these do '
                + 'not is four hundred years of its teachers writing into it, which is a large '
                + 'part of what anybody sweeps a courtyard for.',
                'A book or the food. Whichever the stones go on, they do not go on the other.'
            );
        }

        // Whether this ground can still take them anywhere is the one thing a price
        // board actually decides, and it is why leaving is a goal.
        if (body.groundHereStillGives === false) {
            const where = body.standing as { place?: unknown; region?: unknown } | undefined;
            const place = typeof where?.place === 'string' ? where.place.trim() : '';
            const region = typeof where?.region === 'string' ? where.region.trim() : '';
            const stops = typeof body.groundCarriesNobodyPast === 'string'
                ? body.groundCarriesNobodyPast
                : '';
            const inside = place && region && place !== region;
            lines.push(
                region
                    ? `${region} carries nobody past `
                      + `${stops || 'where you already stand'}`
                      + `${inside ? `, and ${place} is in it` : ''}. Whatever else is on this `
                      + 'board, nothing on it is a way further up.'
                    : place
                        ? `${place} has nothing further to give somebody at this rank.`
                        : 'Whatever else is true of this place, the ground here has nothing '
                          + 'further to give somebody at this rank.'
            );
        }
    }

    // AND IF THEY DIED DOING IT, SAY SO.
    if (body.died === true || body.alive === false) {
        const cause = typeof body.deathCause === 'string' ? body.deathCause : null;
        lines.push(
            cause === null
                ? 'And that was the end of it - of the life, not of the fight. This cultivator is dead. '
                  + 'The run is closed: there is no reload and no continuation, and what happens next happens to somebody else.'
                : `That was the end of it: ${DEATH_IN_WORLD[cause as keyof typeof DEATH_IN_WORLD] ?? cause.replace(/_/g, ' ')}. `
                  + 'The run is closed: there is no reload and no continuation, and what happens next happens to somebody else.'
        );
    }

    return lines;
}


/**
 * Put a hearing into both channels a player can reach it through.
 */
export function addHearing(facts: EngineFacts, hearing: Hearing): void {
    const fact = hearingFact(hearing);
    facts.lines.push(fact);
    facts.prose = `${facts.prose}

${fact}`;
}

/**
 * The fact of having heard a name, for the narrator's fact list.
 */
function hearingFact(hearing: Hearing): string {
    return hearingProse(hearing);
}

export interface WorldReport {
    /** Narratable. Every line is already safe to name what it names. */
    lines: string[];
    /** Inspector only: the shape of what was withheld. */
    structure: string[];
}

/**
 * Turn a digest into the two channels the rest of this layer uses.
 */
export function reportFromDigest(digest: PlayerDigest | null): WorldReport {
    if (!digest || digest.lines.length === 0) {
        return {
            lines: [],
            structure: digest
                ? [`World digest: nothing reached this cultivator. ${digest.unheard} event(s) passed unheard.`]
                : []
        };
    }

    return {
        lines: digest.lines.map(line => {
            const many = line.occurrences > 1 ? ` (${line.occurrences} times over the span)` : '';
            return `Year ${line.year}: ${line.text}${many}`;
        }),
        structure: [
            `World digest: ${digest.lines.length} line(s) reached this cultivator; ` +
            `${digest.unheard} event(s) reached them by no channel at all.`,
            ...digest.lines.map(line =>
                `  A ${line.kind.replace(/_/g, ' ')} reached them via ${line.channel}, in `
                + `${line.form} form, at magnitude ${line.magnitude}`
                + `${line.occurrences === 1 ? '.' : `, ${line.occurrences} times over the span.`}`)
        ]
    };
}

/**
 * What the world did while the player was busy, as inspectable rows.
 */
export function worldCalls(world: WorldReport): ToolCallRecord[] {
    return world.structure.map(line => ({
        name: 'world.advanceWorldForPlay',
        action: 'world_time',
        summary: line,
        ok: true
    }));
}

/**
 * Structural truth, as inspectable rows.
 */
export function structureCalls(lines: readonly string[]): ToolCallRecord[] {
    return lines.map(line => ({
        name: 'engine.structure',
        action: 'not_narrated',
        summary: line,
        ok: true
    }));
}

/** What the crossings cut away, as inspectable rows. */
export function tollCalls(lines: readonly string[]): ToolCallRecord[] {
    return lines.map(line => ({
        name: 'engine.evaluateToll',
        action: 'toll_charged',
        summary: line,
        ok: true
    }));
}

export function refused(name: string, action: string, facts: EngineFacts): Execution {
    return {
        facts,
        events: [],
        timeSkip: null,
        breakthrough: null,
        outcome: 'refused',
        // The inspector gets the mechanical account, not the scene. A developer
        // reading this row wants to know exactly what failed to resolve; the
        // player already got the version where somebody looked at them blankly.
        calls: [{
            name,
            action,
            summary: facts.structure[0] ?? facts.headline,
            ok: false
        }]
    };
}

/**
 * The routing step, as an inspectable row.
 */
export function routingCall(plan: { action: PlannedAction; source: PlanSource; note?: string }): ToolCallRecord {
    const args = [
        plan.action.days !== undefined ? `days=${plan.action.days}` : null,
        plan.action.target !== undefined ? `target="${plan.action.target}"` : null
    ].filter(Boolean).join(', ');

    return {
        name: 'narrator.plan',
        action: plan.action.action,
        summary:
            (plan.source === 'model'
                ? 'Intent routed by the model to '
                : 'Intent parsed deterministically to ') +
            `${plan.action.action}${args ? `(${args})` : '()'}` +
            (plan.note ? ` - ${plan.note}` : '') +
            '. The verb is a member of a closed set; nothing else from the response was read.',
        ok: true,
        source: plan.source,
        ...(plan.note ? { note: plan.note } : {})
    };
}

/** The prose step. Listed so it is visibly separate from, and after, the engine. */
export function narrationCall(narration: { source: 'model' | 'fallback'; note: string | null }): ToolCallRecord {
    return {
        name: 'narrator.narrate',
        action: 'narrate',
        summary: narration.source === 'model'
            ? 'Prose written by the model from the engine facts above. Not read back into state.'
            : `Prose rendered directly from the engine's own account${narration.note ? ` (${narration.note})` : ''}.`,
        ok: true,
        source: narration.source,
        ...(narration.note ? { note: narration.note } : {})
    };
}
