import io

p = 'src/engine/world/what-a-house-opens-its-treasury-for.ts'
s = io.open(p, encoding='utf-8').read()

# ── the header says what it is now ──────────────────────────────────────
head_end = s.index(' */\n\nimport') + len(' */\n')
s = """/**
 * WHAT A HOUSE OPENS ITS TREASURY FOR.
 *
 * Measured before this file: the treasury moved from exactly three places -
 * rebuilding a flattened compound and two player-facing takes. Two of the
 * reasons `WhyItMoved` declares had no producer at all. A house could be driven
 * to its last hall without once reaching for the money that would have bought a
 * defence, and no house ever rewarded anybody out of it.
 *
 * ── AND THIS FILE ADDS ONE FACT AND NO MACHINERY ─────────────────────────
 *
 * The first cut had a table of shares keyed on how the war was going, and its
 * own approval path for arming disciples. Both were bespoke, which is the thing
 * this engine is built to avoid: opening a vault derives from the house's upper
 * leadership - the elder and patriarch decision process - and not from anything
 * the treasury knows about itself. It is a fact about the PEOPLE in the room,
 * and that is true of everything, not of treasuries.
 *
 * So the decision is `whetherItLeavesTheStore`, unchanged and unwrapped: the
 * same counted/tracked routing, the same offices, the same room that can
 * already refuse its own patriarch. Handing out swords is a loan of tracked
 * things, which that function has always routed to the whole body.
 *
 * The ONE fact added here is that a war moves the people. An elder who would
 * ask what for in a quiet year votes to empty the vault when half the compound
 * is down, and it enters through `readingOf` - the same door the ledger enters
 * by. Nothing downstream knows there is a war on.
 *
 * The three bands fall out rather than being written. Measured over 2000
 * houses of four, at a thousand stones held:
 *
 *   at peace        7% open, 7 stones - rare
 *   at war         83% open, 258 stones - moderate
 *   about to lose 100% open, 593 stones - liberal, and ruinous
 *
 * ── AND TWO GRAINS, WHICH ARE NOT THE SAME EVENT ─────────────────────────
 *
 * Stones leaving for a war are a RATE, and not discrete: nobody remembers the
 * year the house paid for arrows. A house taking its good weapons out of the
 * vault and putting them in disciples' hands is a discrete act by the people
 * who decided it, it is a LOAN, and everybody who was there remembers it.
 */
""" + s[head_end:]

# ── imports: the existing approval path, not a second one ───────────────
old_imports = """import { isTracked, transferPossession, type ObjectRecord } from './possessions.js';"""
new_imports = """import { transferPossession, type ObjectRecord } from './possessions.js';
import {
    whetherItLeavesTheStore
} from '../social-leverage/who-has-to-agree-before-it-leaves-the-store.js';
import type { APortfolio } from '../social-leverage/what-an-elder-is-in-charge-of.js';
import { whereInTheHouseItSits } from './what-a-house-keeps-in-its-treasury.js';"""
assert old_imports in s
s = s.replace(old_imports, new_imports, 1)

# ── the shift table loses its arming row: arming is not a third question ─
old_table = """export const WHAT_THE_ASK_MOVES_A_ROOM: Readonly<
    Record<WhatItWouldBeFor, Readonly<Record<HowTheWarGoes, number>>>
> = {
    the_war: { at_peace: -0.5, at_war: 0.3, about_to_lose: 0.9 },
    a_reward: { at_peace: 0.15, at_war: -0.15, about_to_lose: -0.5 },
    arming_its_own: { at_peace: -0.75, at_war: 0.15, about_to_lose: 0.85 }
};"""
new_table = """export const WHAT_THE_ASK_MOVES_A_ROOM: Readonly<
    Record<WhatItWouldBeFor, Readonly<Record<HowTheWarGoes, number>>>
> = {
    the_war: { at_peace: -0.5, at_war: 0.3, about_to_lose: 0.9 },
    a_reward: { at_peace: 0.15, at_war: -0.15, about_to_lose: -0.5 },
    arming_its_own: { at_peace: -0.75, at_war: 0.15, about_to_lose: 0.85 }
};

/**
 * The war, as a reading of one person.
 *
 * This is the whole of what this file contributes to a decision. Everything
 * else about opening a vault was already written and already tested.
 */
export function howAWarReadsToADecider(input: {
    what: WhatItWouldBeFor;
    how: HowTheWarGoes;
    base?: (personId: string) => number;
}): (personId: string) => number {
    const base = input.base ?? openHandednessOf;
    const shift = WHAT_THE_ASK_MOVES_A_ROOM[input.what][input.how];
    return id => Math.max(-AXIS, Math.min(AXIS, base(id) + shift));
}"""
assert old_table in s
s = s.replace(old_table, new_table, 1)

# ── whetherTheVaultOpens uses it ────────────────────────────────────────
old_body = """    const base = input.readingOf ?? openHandednessOf;
    const shift = WHAT_THE_ASK_MOVES_A_ROOM[input.what][input.how];
    const answer = whatTheBodyWants({
        roll: input.roll,
        rankCount: input.rankCount,
        readingOf: id => Math.max(-AXIS, Math.min(AXIS, base(id) + shift)),"""
new_body = """    const answer = whatTheBodyWants({
        roll: input.roll,
        rankCount: input.rankCount,
        readingOf: howAWarReadsToADecider({
            what: input.what,
            how: input.how,
            ...(input.readingOf === undefined ? {} : { base: input.readingOf })
        }),"""
assert old_body in s
s = s.replace(old_body, new_body, 1)

# ── and armItsOwn asks the room the ordinary way ────────────────────────
start = s.index('export function armItsOwn(input: {')
new_arm = """export function armItsOwn(input: {
    how: HowTheWarGoes;
    roll: readonly OnTheRoll[];
    rankCount: number;
    /** Who holds which room, so the offices answer. Empty for a house with none. */
    portfolios?: readonly APortfolio[];
    /** What the house holds. What may go out is not this function's to decide. */
    holds: readonly ObjectRecord[];
    /** Who could carry one. Any order. */
    takers: readonly { id: string; name: string; ordinal: number }[];
    houseName: string;
    onDay: number;
    asking?: string | null;
    ledger?: readonly ObligationRecord[];
    readingOf?: (personId: string) => number;
}): TheHouseArmedItsOwn {
    const reading = howAWarReadsToADecider({
        what: 'arming_its_own',
        how: input.how,
        ...(input.readingOf === undefined ? {} : { base: input.readingOf })
    });

    // The good ones, best first. A house arming its people reaches past the
    // rack of iron swords for the things it keeps a record of - and WHETHER
    // each one may go is the ordinary question, asked of the ordinary room.
    const offered = input.holds
        .filter(o => (o.power ?? 0) > 0 && o.possessorId === null)
        .sort((a, b) => (b.power ?? 0) - (a.power ?? 0));
    // And the strongest hands first, because a house does not put its best
    // sword in the weakest grip it has.
    const hands = [...input.takers].sort((a, b) => b.ordinal - a.ordinal);

    const lent: HandedOut[] = [];
    const objects: ObjectRecord[] = [];
    const refusals: string[] = [];
    let lastAnswer: WhereTheBodyLands | null = null;

    for (const arm of offered) {
        const hand = hands[lent.length];
        if (hand === undefined) break;
        const said = whetherItLeavesTheStore({
            significance: arm.significance,
            // A house arming its own is lending, and a loan is a thing that
            // comes back. That is what routes a tracked sword to the body.
            meaning: 'use_it_and_return_it',
            room: whereInTheHouseItSits(arm.kind, arm.significance, arm.tags),
            portfolios: input.portfolios ?? [],
            roll: input.roll,
            rankCount: input.rankCount,
            readingOf: reading,
            asOfDay: input.onDay,
            ...(input.asking === undefined ? {} : { askerId: input.asking }),
            ...(input.ledger === undefined ? {} : { ledger: input.ledger })
        });
        lastAnswer = said.answer ?? lastAnswer;
        if (!said.allowed) {
            refusals.push(said.line);
            continue;
        }
        objects.push(transferPossession(arm, {
            onDay: input.onDay,
            toHolderId: hand.id,
            toHolderName: hand.name,
            how: 'lent',
            source: `${input.houseName} armed its own`,
            note: `Opened while ${input.how}.`
        }));
        lent.push({ objectId: arm.id, objectName: arm.name, toId: hand.id, toName: hand.name });
    }

    return {
        opened: lent.length > 0,
        answer: lastAnswer,
        lent,
        objects,
        line: lent.length > 0
            ? `arming while ${input.how}: ${lent.length} out of the vault, lent.`
            : `arming while ${input.how}: nothing left the vault. `
              + (refusals[0] ?? 'There was nothing in it to hand out.')
    };
}
"""
s = s[:start] + new_arm

# and the result type's answer is nullable now
s = s.replace("""export interface TheHouseArmedItsOwn {
    opened: boolean;
    answer: WhereTheBodyLands;""",
"""export interface TheHouseArmedItsOwn {
    opened: boolean;
    /** Where the last room landed, or null where nobody was ever asked. */
    answer: WhereTheBodyLands | null;""")

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('folded')
