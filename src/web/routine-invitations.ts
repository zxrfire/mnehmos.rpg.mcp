import { activityForVerb } from './encounters.js';
import { spendOnPersonalAirCourse } from './an-actual-personal-air-course.js';
import { spendOnOwnedPassage } from './an-owned-passage.js';
import { spendAboardTheShip, spendAboardTheCarriage } from './an-actual-paid-passage.js';
import { thePaidCarriageClaim } from './a-paid-carriage-on-the-road.js';
/** Invitations end at night; visits end when the host leaves the room. */
import { routineTime } from '../engine/world/npc-routines.js';
import { journeyTimeHasReached } from '../engine/world/places-on-the-way.js';
import { walkingDaysFrom } from '../engine/world/locations.js';
import { isActing, type NpcRecord } from '../engine/world/npc-state.js';
import type { GameService } from './game.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { Execution } from './turn-wire-shapes.js';
import { factsForToolResult } from './facts.js';
import { aSpanPastTheEndOfThisLife } from './actions.js';
import { factsForRefusal } from './facts.js';
import { refused } from './tool-result-prose.js';
import { WAITING_FOCUS } from './turn-constants.js';

/** Only an invited person is returned; ordinary world activity is never stepped. */
export function endInvitation(game: GameService, npc: NpcRecord): void {
    const world = game.atHand;
    const redirect = npc.activity?.redirect;
    if (!world || !redirect || !isActing(npc.status)) return;
    const home = npc.activity?.returnTo ?? npc.locationId;
    const days = home && npc.locationId && home !== npc.locationId
        ? walkingDaysFrom(world.locations, npc.locationId).get(home) : 0;
    redirect.until = Math.min(redirect.until, routineTime(world));
    redirect.returnDays = days ?? null;
    if (days !== undefined && routineTime(world) >= redirect.until + days) {
        npc.locationId = home;
        npc.activity = redirect.previous;
    } else {
        npc.activity = { kind: 'travelling', note: days === undefined ? 'seeking a road home' : 'walking home',
            withIds: [], sinceDay: redirect.until,
            untilDay: days === undefined ? null : redirect.until + days, returnTo: home, redirect };
    }
    game.theWorldMoved();
}

/** Shared by the turn boundary and local walks, without an hourly world pass. */
export function invitationsDue(game: GameService, leader: Cultivator): void {
    const world = game.atHand;
    if (!world) return;
    for (const npc of world.npcs) {
        if (!isActing(npc.status)) continue;
        const redirect = npc.activity?.redirect;
        if (!redirect || !npc.activity?.withIds.includes(leader.id)) continue;
        if (routineTime(world) >= redirect.until
            || (redirect.visit && redirect.standingIn?.includes('#room#')
                && leader.standingIn !== redirect.standingIn)) endInvitation(game, npc);
        else if (redirect.visit && leader.standingIn?.includes('#room#') && redirect.standingIn !== leader.standingIn) {
            redirect.standingIn = leader.standingIn;
            game.theWorldMoved();
        }
    }
}

/** A wait for an hour uses the ordinary wait verb and the same world day. */
export async function waitForHour(
    game: GameService, run: Run, cultivator: Cultivator, input: string
): Promise<Execution | null> {
    const world = game.atHand;
    if (!world) return null;
    const named = /\b(?:until|till|to)\s+(?:the\s+)?(morning|dawn|midday|noon|evening|night|nightfall)\b/i.exec(input);
    const span = /\bwait\s+(?:for\s+)?(-?\d+(?:\.\d+)?)\s+hours?\b/i.exec(input);
    if (!named && !span) return null;
    const hours: Record<string, number> = { morning: 8, dawn: 6, midday: 12, noon: 12, evening: 18, night: 21, nightfall: 21 };
    const from = world.currentHour ?? 8;
    const target = named ? hours[named[1]!.toLowerCase()]! : from + Number(span![1]);
    const elapsed = named ? (target > from ? target - from : target + 24 - from) : target - from;
    if (!Number.isFinite(elapsed) || elapsed < 0) return refused('world.waitForHour', 'wait', factsForRefusal(
        'That hour span cannot pass.', 'Waiting needs a finite, nonnegative number of hours.', 'Nothing spent.'));
    const advanced = await passHours(game, run, cultivator, elapsed);
    if (!advanced.finished) return advanced.spent;
    if (!game.atHand) return null;
    const spent = advanced.spent;
    const done = spent ?? game.freeAction(run, 'wait', factsForToolResult('Time passes.', []));
    done.calls.push({ name: 'world.waitForHour', action: 'wait', summary: `${elapsed} hours passed.`, ok: true });
    return done;
}

/** Fractions persist on the run clock; midnight advances the world with its observer. */
export async function passHours(game: GameService, run: Run, cultivator: Cultivator, elapsed: number, resolvesOnTurn = run.turn + 1, finishTurn = true, whileApproaching?: () => string | null,
    label = 'Waiting'): Promise<{
    spent: Execution | null; finished: boolean;
}> {
    const days = elapsed / 24;
    let spent: Execution | null = null;
    if (days > 0) {
        const pastTheEnd = aSpanPastTheEndOfThisLife(cultivator, days);
        if (pastTheEnd) return { finished: false, spent: refused('engine.aSpanPastTheEnd', 'wait', factsForRefusal(
            'Longer than the life asking for it.', pastTheEnd.line, 'Nothing spent.')) };
        const flying = game.worldEnabled
            ? await spendOnPersonalAirCourse(game, run, cultivator, days, resolvesOnTurn, finishTurn) : null;
        if (flying) {
            invitationsDue(game, game.repos.cultivators.getById(cultivator.id) ?? cultivator);
            return { spent: flying, finished: flying.outcome === 'executed' && !flying.cutShort
                && !flying.timeSkip?.interrupted && !flying.timeSkip?.died
                && (game.repos.cultivators.getById(cultivator.id)?.alive ?? false) };
        }
        const owned = game.worldEnabled ? await spendOnOwnedPassage(game, run, cultivator, days, WAITING_FOCUS, resolvesOnTurn, false, finishTurn) : null;
        if (owned) {
            invitationsDue(game, game.repos.cultivators.getById(cultivator.id) ?? cultivator);
            // An event at the final instant does not erase the span already lived.
            const whole=journeyTimeHasReached(owned.timeSkip?.simulatedDays??0,days);
            return { spent: owned, finished: owned.outcome === 'executed'
                && (whole || !owned.cutShort && !owned.timeSkip?.interrupted)
                && (game.repos.cultivators.getById(cultivator.id)?.alive ?? false) };
        }
        const aboard = game.worldEnabled ? await spendAboardTheShip(game, run, cultivator, days, resolvesOnTurn, finishTurn) : null;
        if (aboard) {
            invitationsDue(game, game.repos.cultivators.getById(cultivator.id) ?? cultivator);
            return { spent: aboard, finished: aboard.outcome === 'executed' && !aboard.cutShort && !aboard.timeSkip?.interrupted
                && (game.repos.cultivators.getById(cultivator.id)?.alive ?? false) };
        }
        const carried = game.worldEnabled
            ? await spendAboardTheCarriage(game, run, cultivator, days, WAITING_FOCUS, resolvesOnTurn, finishTurn) : null;
        if (carried) {
            invitationsDue(game, game.repos.cultivators.getById(cultivator.id) ?? cultivator);
            return { spent: carried, finished: carried.outcome === 'executed' && !carried.cutShort && !carried.timeSkip?.interrupted
                && (game.repos.cultivators.getById(cultivator.id)?.alive ?? false) };
        }
        if (thePaidCarriageClaim(game.db, cultivator.id)) return { finished: false,
            spent: refused('engine.physicalCarriageClock', 'wait', factsForRefusal(
                'The actual paid carrier cannot continue.',
                'Its current physical source no longer carries the accepted passage. Nothing spent.',
                'A retained receipt cannot replace a lost driver or hull.')) };
        // Route adapters above remain authoritative. Off transport, ordinary
        // time uses native encounters, food, hostility and the held body iterator.
        spent = await game.shortSkip(run, cultivator, game.ambientFor(cultivator, run),
            // The label words the account; what can happen in the hours is a wait's, whatever it is called.
            WAITING_FOCUS, label, days, activityForVerb('Waiting'), resolvesOnTurn, finishTurn, whileApproaching);
        game.atHand = await game.loadWorld();
        if (game.atHand) {
            invitationsDue(game, game.repos.cultivators.getById(cultivator.id) ?? cultivator);
            game.theWorldMoved();
        }
        return { spent, finished: spent.outcome === 'executed' && !spent.cutShort && !spent.timeSkip?.interrupted
            && !spent.timeSkip?.died
            && (game.repos.cultivators.getById(cultivator.id)?.alive ?? false) };
    }
    game.atHand = await game.loadWorld();
    if (game.atHand) {
        invitationsDue(game, game.repos.cultivators.getById(cultivator.id) ?? cultivator);
        game.theWorldMoved();
    }
    return { spent, finished: true };
}

/** Ending company needs no agreement; it names the invitation already held. */
export function dismissCompany(game: GameService, run: Run, cultivator: Cultivator, target: string | undefined): Execution {
    const withYou = game.whoIsWithYouOnTheRoad(cultivator);
    const said = target?.trim().toLowerCase();
    const addressed = said ? game.partyPutTo(cultivator, said, game.scopeFor(cultivator)) : null;
    const leaving = said ? withYou.filter(n => n.id === addressed?.id) : withYou;
    for (const npc of leaving) {
        if (npc.activity?.redirect) endInvitation(game, npc);
        else if (npc.activity?.kind === 'travelling') delete npc.activity.passageCompany;
        else npc.activity = null;
    }
    if (leaving.length) game.theWorldMoved();
    return game.freeAction(run, 'request', factsForToolResult('Company ends.', [
        leaving.length ? 'The company agreement has ended.' : 'Nobody in your company answers to that name.'
    ]));
}
