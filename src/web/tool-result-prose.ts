/**
 * An engine result, turned into the sentences a player and an operator read.
 *
 * `summariseToolBody` is the whole reason this is a file. It turns a tool
 * result into prose through branches keyed on what the result carries, and a
 * verb whose shape has no branch here does not fail - it falls through to "It
 * is done. Nothing about it drew attention.", which reads like a sentence and
 * says nothing. AGENTS.md records three verbs that sat there at once: a fight
 * that omitted two thirds of the HP and an untreated wound, four years of work
 * with the wounds left out, and a petition's entire journey. Nothing notices
 * this except a person reading the answer and asking "and then what happened?",
 * so the branch table wants to be somewhere a reader can see all of it.
 *
 * Everything beside it is the same job at a smaller scale: `skipCalls`,
 * `worldCalls`, `structureCalls` and `tollCalls` turn a result into inspector
 * rows; `routingCall` and `narrationCall` record which reader chose the verb
 * and which narrator wrote the prose; `refused` is the shape of a declined
 * action; `reportFromDigest` renders what the world did while a span passed.
 *
 * Moved out of `game.ts` unchanged. The reason to change this file is that a
 * result gained a shape that needs a sentence - which is a different reason
 * from anything about how a turn is run.
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
 *
 * Reported across several sessions and it keeps surviving because it looks like
 * debug output somebody meant to remove. It is not - it is a deliberate
 * mechanical channel that the player also reads. Four occurrences in eleven
 * turns of ordinary play, on the two commonest early actions:
 *
 *   technique_manage.list_available: 4 compatible, 0 conflicting, 134 gated...
 *   encounters.assessFit: suited at grade ordinal 0; reach=match, element=match
 *
 * The playtester's diagnosis is the fix: "The content is fine and arguably
 * useful; it's the `module.function:` prefix that shouldn't be in the story."
 * Being told what is compatible, what is gated by realm, and that an art suits
 * you on reach and on element is genuinely worth knowing. Being told which MCP
 * handler said so is not.
 *
 * Done here rather than at the several dozen `structure.push` sites, because
 * one place cannot go stale and a convention across dozens will. Nothing is
 * lost to an operator: every `calls[]` entry still carries its handler in
 * `name`, which is where a handler name belongs.
 *
 * Narrow on purpose. It requires a lowercase identifier, at least one dot, no
 * spaces, and a colon - so "Day 3: ..." and any ordinary sentence are untouched.
 */
const A_HANDLER_NAME_AT_THE_FRONT = /^[a-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+:\s*/;

/**
 * The sum somebody said they were putting down, off their own sentence.
 *
 * Read here rather than in the parser because it is not a routing decision:
 * `actions.ts` chooses a verb, and how much money is in a bribe is a parameter
 * of the act. Keeping it out of the plan object also keeps a model from ever
 * being in a position to name a figure that leaves the purse - the enum's whole
 * discipline - since this reads the PLAYER'S raw sentence and nothing else.
 *
 * Requires the noun. A bare number in "I bribe the third guard" is not an offer,
 * and reading it as one would have somebody paying three stones for a sentence
 * about a person.
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
 *
 * Every `summary` here is either composed from the digest's own numbers or is a
 * `SimEvent.summary` verbatim - engine strings, not prose. The per-event rows
 * are what make the inspector worth opening: a decade of seclusion shows up as
 * the breakthroughs, deviations and opportunities the engine ruled, in order,
 * next to whatever the narration made of them.
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
 *
 * Deliberately a small allowlist rather than a dump of the whole body: these
 * results are large, and everything not listed here is either an id the player
 * cannot use or a projection the sheet already shows.
 */
/**
 * Strip the deliberate-override word out of a named target.
 *
 * "I take the pill anyway" parses to `target: "pill anyway"`, and the override
 * is not part of the pill's name - left in, confirming a wasted pill refused a
 * second time for an entirely different reason ("no pill called pill anyway on
 * you"), which is a worse answer than the one being confirmed.
 *
 * A module function rather than a static on the class: the same word will want
 * stripping wherever an override is offered, and a target is a string rather
 * than anything the game service owns.
 */
export function withoutTheOverride(target: string): string {
    return target.replace(/\b(?:anyway|anyhow|regardless|even so)\b/gi, '').replace(/\s+/g, ' ').trim();
}

export function summariseToolBody(body: Record<string, unknown>): string[] {
    const lines: string[] = [];

    // ── THE TERMS OF A GUEST PLACE ───────────────────────────────────────
    //
    // The sixth verb to land on the shrug, caught on its first played run:
    // "can I study at the House of the Narrow Hour" came back as one sentence
    // saying the house would let you sit in, and said nothing whatever about
    // what it would show you, what it would keep, how long it would watch you,
    // or the five things the place is not. All of that was in the body.
    //
    // The order below is the order somebody deciding actually wants it: what is
    // on the table, then what is not, then what the position does not carry -
    // because that last is the part that has to be read BEFORE accepting rather
    // than discovered afterwards.
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

    // ── WHERE SOMEBODY STANDS IN THEIR OWN HOUSE ─────────────────────────
    //
    // `handleStanding` returns rank, contribution and exactly what the next
    // rung wants, and this function had no branch for that shape - so asking
    // came back "It is done. Nothing about it drew attention." The fallback
    // defect again, on the read that answers "how much contribution do I have",
    // which is the number gating every promotion in the game.
    //
    // The promotion refusal already states both requirements and both current
    // values and is the best sentence of its kind in the codebase. This says
    // the same thing before the player is refused rather than after.
    // A house taking somebody back at the seat they left. Said, not merely
    // applied: a returning member seated below what their rung would otherwise
    // buy has to be told why, or the house looks as though it has misjudged
    // them. See the entry cap in `sect-manage.ts`.
    const returning = body.returning as { note?: string } | null | undefined;
    if (returning?.note) lines.push(returning.note);

    // ── BEING RAISED A RUNG ──────────────────────────────────────────────
    //
    // `handlePromote` returns the old title, the new one, the contribution it
    // cost and the new stipend, and this function had no branch for that shape.
    // Measured in play:
    //
    //     > I ask to be promoted to Outer Disciple
    //     It is done. Nothing about it drew attention.
    //
    // The state changed correctly and one of the few structural events in a
    // career came back as the last-resort line. It is the fifth time this
    // fallback has swallowed a verb, which is why the shrug is the thing worth
    // hunting rather than any one of the verbs.
    //
    // The contribution is the part a player most needs said: a promotion is
    // BOUGHT, the ledger is spent rather than merely met, and somebody who does
    // not know that will plan the next twenty years off a balance they no
    // longer have.
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
                    ? ` The seat draws ${body.newStipendPerMonth} spirit stones a month.`
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

    // ── what a fight cost ──
    //
    // `combat_manage.resolve` returns a rich body - every exchange with its
    // damage, the HP left afterwards, the wounds each side picked up, the
    // lethal-injury threshold - and NONE of it reached the player, because
    // this function had no combat branch and the handler's `narrationHint` is
    // atmosphere rather than accounting.
    //
    // Found by playing. One swing at somebody standing in the square came back
    // as "Broken off. Both parties are worse than they were, the wounds are
    // real, and nothing is settled." - which is true, and reads well, and does
    // not mention that it took two thirds of the HP off a sixteen-year-old and
    // left an untreated wound behind. The player had to read /api/state to find
    // out they had nearly died.
    //
    // This is the same defect the work path carried until it was played too,
    // and it is worse here: work drains you over years and combat does it in a
    // turn, and the injury threshold is the fastest way to die in the game.
    if (typeof body.outcome === 'string' && Array.isArray(body.exchanges)) {
        const them = body.opponent as { id?: string; name?: string } | undefined;

        // ── AND WHAT WOULD HAVE WORKED ───────────────────────────────────
        //
        // `assessGap` computes `REAL_OPTIONS` alongside the refusal and puts
        // them on `gap.options`, which rides all the way here and was never
        // printed. Measured in play: six identical no-contests against somebody
        // seven realms up, and not one word about what would have worked - a
        // refusal with the route already in the payload and thrown away by the
        // last hop.
        //
        // `gap-routes.ts` maps them to what a player would actually type and
        // drops the five that have no verb behind them, because printing those
        // would be the narrator inventing affordances at the exact moment
        // somebody is desperate enough to try every line in the paragraph.
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
        //
        // These two lines used to say the wounds would kill and count down to
        // it. They do not kill - a torn channel is a torn muscle - and a threat
        // the engine never carries out teaches a player to ignore the line.
        //
        // The true version is not softer. Untreated wounds accumulate, nothing
        // closes them, and at the threshold the body stops mending itself
        // altogether, so every scratch after that one is permanent until
        // somebody is paid. That is what a player needs in order to decide to
        // go and have them treated, which is the decision this line exists for.
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
        //
        // The time-skip path has warned at this threshold since it was written;
        // the work path never did, and work is where a player spends years.
        // Found by playing: fourteen consecutive years of innkeeping took HP
        // from 30 to 15 and satiety to 20, the purse to twelve hundred stones,
        // and said nothing but the wages each time. A meal costs one stone.
        //
        // The information was not even hidden - `status` prints "Satiety
        // 20/100" - but a player has no reason to open a status sheet while a
        // job is going fine, and nothing in the job's own account suggested it
        // was not.
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
        //
        // Work runs the ordinary event layer, so a labourer picks up wounds
        // across years like anybody else. This branch reported wages, food and
        // health and said nothing about them at all.
        //
        // Found by playing. An innkeeper worked three spans across four years,
        // was told the pay every time, and died of `untreated_injuries` without
        // one sentence about a wound. The satiety warning above was written
        // after the same discovery about hunger.
        //
        // That death is retired - a torn channel does not kill anybody - and
        // the line is still needed, for the reason that was underneath the
        // original one. Untreated is a state that does not improve on its own,
        // it takes a growing share of everything the body does, and at the
        // threshold the body stops mending itself at all. A player who is never
        // told cannot decide to go and have them treated.
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
    //
    // `sect_manage.join` and `.leave` return a membership record rather than a
    // narration hint. Without this the last-resort line reached a player as
    // "The Gleaners' Company is done." - which reads as the sect being
    // finished, not as the joining having happened. Same defect class as the
    // work and market boards: a tool surface written for a model that will
    // phrase the figures, called here by something that has to phrase them
    // itself.
    if (body.joined === true) {
        const joinedSect = body.sect as { name?: string } | undefined;
        const membership = body.membership as { rankTitle?: string } | undefined;
        lines.push(
            // "at ${rankTitle}" read as a place. Barrow Hand is the lowest
            // rank in the Gleaners' Company and it is also a town, so the line
            // told a player standing in Sweptground that they were somewhere
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
    //
    // `handleStipend` returns `spiritStonesPaid` and no narration hint, so a
    // payment of a hundred and fifty stones reached a player as "It is done.
    // Nothing about it drew attention." - the last-resort line, on the single
    // largest sum a low cultivator ever sees. Same defect class as `work` and
    // `join`: a tool surface written for a model that will phrase the figures,
    // called by something that has to phrase them itself.
    // A pill swallowed. `handleConsumePill` returns the applied effect and no
    // narration hint, so the single most consequential object in the game -
    // and, through FLAG_PENDING_PILL, the largest modifier in it - landed in
    // the generic catch-all as "It is done. Nothing about it drew attention."
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

    // ── WHAT HAPPENS IF THEY TRY, WHICH IS THE WHOLE POINT OF THE VERB ───
    //
    // The eighth verb on the shrug, and the most expensive one to lose. Played:
    //
    //     > what can I gather here
    //     It is done. Nothing about it drew attention.
    //
    // `assess` is described in this file as "the capability predicates, asked
    // rather than discovered by dying" - the difference between a player who
    // chose badly and one who was not told the ground was lethal - and the
    // branch above answers only the `student` subject. Every assessment of a
    // PLACE, which is what the verb is mostly used for, came back as the
    // last-resort line with five verdicts and a hazard list in the body.
    //
    // Rendered as the qualitative answers rather than the margins, on the
    // capability layer's own rule: "SURVIVAL: unlikely - no method of resisting
    // the soul pressure here is a scene. A survival probability of 0.31 is
    // not." The numbers stay on the structure channel, where they belong.
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
        // The specific thing that is not handled, which is the half a player
        // can act on - a hazard names the preparation that answers it.
        //
        // The keys are whole descriptions with the spaces taken out -
        // `dead_ground_which_looks_like_ordinary_heath_and_is_silent_in_a_way_
        // visitors_take_a_few_minutes_to_identify` - so they read as prose the
        // moment the underscores come back, and read as a database dump if they
        // do not. Two, because four of those in one sentence is a paragraph of
        // identifiers whatever the punctuation.
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
        // Only where nothing above landed. `assessment.summary` is the
        // capability layer's own one-liner and it restates the survival verdict
        // in different words - said after the sentences above, it is the same
        // fact twice, which is the repeated-clause half of the dump rule.
        if (lines.length === saidBefore && typeof body.summary === 'string') {
            lines.push(body.summary);
        }
    }

    // ── a petition, and how far it actually got ──
    //
    // `sect_politics.petition` returns where it went, how far up it climbed,
    // every stop on the way, what asking is like in that house's own terms and
    // when an answer might come - and none of it reached the player, because
    // this function had no branch for it. Petitioning a sect came back as "It
    // is done. Nothing about it drew attention.", which is the last-resort line
    // this file already calls out as a defect: a sentence about the software,
    // shipped to somebody who had just asked an institution for something.
    //
    // Found by playing. Same shape as combat and the work board before them.
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
        // ── THE STALL NEXT TO THE COOKING POTS ───────────────────────────
        //
        // Rendered on its own rather than folded into the board above, because
        // the first question a player has about a book is not what it costs. It
        // is where the book stops and whether they can open it today, and
        // neither of those is a fact about any other line on a market board.
        //
        // Written from the defect: the game refused "buy a manual" with the
        // look people give somebody asking for a thing that is not sold, and
        // then listed millet, inns and ferry crossings - so the correct verb
        // was blocked, the free one worked, and the board never once mentioned
        // the only object in the world a beginner actually needs.
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

        // Whether this ground can still take them anywhere is the one thing a
        // price board actually decides, and it is why leaving is a goal.
        if (body.groundHereStillGives === false) {
            lines.push(
                'Whatever else is true of this place, the ground here has nothing further to give ' +
                'somebody at this rank.'
            );
        }
    }

    // AND IF THEY DIED DOING IT, SAY SO.
    //
    // Every verb that consumes time can kill somebody - untreated injuries, a
    // disturbance that lands, starvation - and only the seclusion path ever
    // reported it. `facts.ts` has rendered death since it was written and is
    // reached from the time-skip narration alone, so a cultivator who died
    // working got the wages line and then, on every turn afterwards, nothing at
    // all. Found by playing: fourteen years of farm work ended in
    // `untreated_injuries` and the game never said a word.
    //
    // Here rather than in each verb, because the next verb added would have the
    // same hole and nobody would notice.
    // The no-cause branch has to say the word. "And that was the end of it."
    // reads as the end of the FIGHT, and it was the only sentence a player got
    // on the turn a duel killed them: measured in a played run, the account ran
    // "Broken off. Both parties are worse than they were... 2 exchanges: 5
    // dealt, 3 taken, which leaves 3 of 50. And that was the end of it." and
    // then a line about how many people watched. Every subsequent turn came
    // back 409. Nothing anywhere told the player they had died.
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
 *
 * `lines` is the narrator's licence to have somebody say it. `prose` is the
 * zero-provider rendering, and a name that only existed in the prompt would
 * simply not happen for an operator running without a model - which would make
 * the whole mechanism a paid feature.
 */
export function addHearing(facts: EngineFacts, hearing: Hearing): void {
    const fact = hearingFact(hearing);
    facts.lines.push(fact);
    facts.prose = `${facts.prose}

${fact}`;
}

/**
 * The fact of having heard a name, for the narrator's fact list.
 *
 * Says that a word was said and withholds everything else, because that is
 * genuinely all the player has. What the thing is does not travel with the
 * name, and stating it here would put the meaning in the narrator's hands one
 * sentence after the design took it out.
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
 *
 * The lines go to the narrator verbatim, because the world layer has already
 * done the redaction on its own side and doing it twice would only risk
 * disagreeing with it. The counts go to the inspector: how much of a span the
 * player never heard about is a fact about the simulation, and a curious player
 * can go and look, but it must not become a sentence in the prose. The moment
 * it does, "the world is mostly none of your business" becomes a status line.
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
 *
 * Only the structural half. The digest lines themselves are already in the
 * narration facts, and repeating them here would double every world event in
 * the play log.
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
 *
 * These are the categories the narrator is never shown: ordinals, grades,
 * governance, rank ladders. They are precisely what an operator auditing a run
 * wants, and precisely what would turn a scene into a lecture.
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
 *
 * Deliberately first in the list and deliberately explicit about where the verb
 * came from: this is the one place a model influenced anything, and a player
 * auditing the run should be able to see that it influenced only this.
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
