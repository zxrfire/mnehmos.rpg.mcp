/** Invitations end at night; visits end when the host leaves the room. */
import { routineTime } from '../engine/world/npc-routines.js';
import { walkingDaysFrom } from '../engine/world/locations.js';
import { isActing, type NpcRecord } from '../engine/world/npc-state.js';
import type { GameService } from './game.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { Execution } from './turn-wire-shapes.js';
import { factsForToolResult } from './facts.js';
import { aSpanPastTheEndOfThisLife } from './actions.js';
import { factsForRefusal } from './facts.js';
import { refused } from './tool-result-prose.js';
import { theseDaysPassedInTheWorldToo } from '../server/state/cultivation-world.js';
import { WAITING_FOCUS } from './turn-constants.js';
import { DAYS_PER_YEAR } from '../engine/cultivation/cultivation.js';

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
export async function passHours(game: GameService, run: Run, cultivator: Cultivator, elapsed: number): Promise<{
    spent: Execution | null; finished: boolean;
}> {
    const days = elapsed / 24;
    let spent: Execution | null = null;
    if (days > 0) {
        const pastTheEnd = aSpanPastTheEndOfThisLife(cultivator, days);
        if (pastTheEnd) return { finished: false, spent: refused('engine.aSpanPastTheEnd', 'wait', factsForRefusal(
            'Longer than the life asking for it.', pastTheEnd.line, 'Nothing spent.')) };
        const whole = Math.floor(days);
        if (whole > 0) {
            spent = await game.shortSkip(run, cultivator, game.ambientFor(cultivator, run), WAITING_FOCUS, 'Waiting', whole);
            if (spent.cutShort || spent.timeSkip?.simulatedDays !== whole) return { spent, finished: false };
        }
        const fraction = days - whole;
        if (fraction > 0) {
            game.db.transaction(() => {
                game.repos.runs.advanceDays(run.id, fraction);
                const body = game.repos.cultivators.getById(cultivator.id);
                if (body?.alive) game.repos.cultivators.applyDeltas(body.id,
                    { age: fraction / DAYS_PER_YEAR, yearsAtCurrentRealm: fraction / DAYS_PER_YEAR });
            })();
            const afterRun = game.repos.runs.getById(run.id)!;
            const after = game.repos.cultivators.getById(cultivator.id) ?? cultivator;
            if (game.worldEnabled) await theseDaysPassedInTheWorldToo(afterRun, after, fraction);
        }
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
    const withYou = game.whoIsWithYouOnTheRoad(cultivator).filter(n => n.activity?.redirect);
    const said = target?.trim().toLowerCase();
    const addressed = said ? game.partyPutTo(cultivator, said, game.scopeFor(cultivator)) : null;
    const leaving = said ? withYou.filter(n => n.id === addressed?.id) : withYou;
    for (const npc of leaving) endInvitation(game, npc);
    return game.freeAction(run, 'request', factsForToolResult('Company ends.', [
        leaving.length ? 'The invited company has ended.' : 'Nobody in your company answers to that name.'
    ]));
}
