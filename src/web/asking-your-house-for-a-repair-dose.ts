/**
 * Asking your own house for a structural repair dose.
 *
 * THE STANDARD WAS WRITTEN AND NOBODY COULD ASK IT. The holdings are live
 * (`who-holds-the-structural-repair-medicine.ts`: which house holds which dose
 * today, and `spendRepairDose` to spend one), and the standard a house applies
 * when somebody in it cracks was written beside them
 * (`willTheHouseSpendOnThem`: blood, the house's chosen, or a century of its
 * own investment). Nothing in play put the question. A player whose core had
 * cracked could barter a stranger's house out of a dose, or swallow one they
 * were holding, and could not ask their own house - which is the one door the
 * catalog says the medicine goes through: *"the medicine is not sold, it is
 * spent, and it is spent on the house's own."*
 *
 * THE ASK IS THE REQUEST OR THE PETITION A PLAYER ALREADY MAKES. "I ask my sect
 * for a Core-Knitting Pill" reaches the request verb with the house as the
 * party, and "I petition the sect for a Second Casting Pill" reaches the
 * petition verb; both call this first, and it answers only where a dose is
 * named and the body asked is the player's own house. Anything else falls
 * through to the road it always took, so asking a stranger's house for one is
 * still the barter it was.
 *
 * WHAT IT DECIDES, WHICH IS NOTHING. The standard decides whether they clear
 * the bar, `doseAHouseWouldUse` decides which dose (the cheapest that reaches,
 * not the one named), `applyStructuralRepair` decides what closes. This file
 * reads who they are to the house off the world and reports.
 */

import type { Cultivator, Injury, Run } from '../schema/cultivation.js';
import {
    STRUCTURAL_REPAIR_MEDICINES,
    type StructuralRepairMedicine
} from '../data/cultivation/structural-repair-medicine.js';
import { getSect } from '../data/cultivation/sects.js';
import { getWoundType } from '../data/cultivation/wounds.js';
import { brokenStatusKeyOf } from '../engine/cultivation/what-goes-wrong-at-a-realm-boundary.js';
import {
    applyStructuralRepair,
    mendsThisBreak
} from '../engine/cultivation/what-structural-repair-medicine-can-reach.js';
import {
    chosenOf,
    willTheHouseSpendOnThem
} from '../engine/cultivation/who-a-house-will-spend-a-repair-dose-on.js';
import { elderRungOf } from '../engine/cultivation/leadership.js';
import { DAYS_PER_YEAR } from '../engine/cultivation/cultivation.js';
import { whatAnInsiderMustStandAt } from '../engine/world/promotion-inside-a-house.js';
import {
    doseAHouseWouldUse,
    spendRepairDose
} from '../engine/world/who-holds-the-structural-repair-medicine.js';
import type { WorldState } from '../engine/world/world-state.js';
import { matchScore } from './entities.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { refused } from './tool-result-prose.js';
import type { Execution } from './turn-wire-shapes.js';
import type { GameService } from './turn-engine.js';
import { A_HOUSE_TYPE_NOUN_ALONE_OR_PLURAL } from './what-a-house-is-called.js';

/** How close a name has to be before it is the dose they meant. The swallowing verb's figure. */
const CLOSE_ENOUGH = 60;

/** "my sect", "the house", "our clan": the house the speaker belongs to, by its type noun. */
const ONES_OWN_HOUSE = new RegExp(
    String.raw`^(?:my |our |the |this )?(?:own )?(?:${A_HOUSE_TYPE_NOUN_ALONE_OR_PLURAL})$`,
    'i'
);

/** The dose these words name, or null. */
function theDoseNamed(said: string): StructuralRepairMedicine | null {
    let best: { medicine: StructuralRepairMedicine; score: number } | null = null;
    for (const medicine of STRUCTURAL_REPAIR_MEDICINES) {
        const score = matchScore(said, medicine.name);
        if (score >= CLOSE_ENOUGH && (best === null || score > best.score)) best = { medicine, score };
    }
    return best?.medicine ?? null;
}

/** The structural break they carry: the one the named dose was made for first. */
function theBreakTheyCarry(injuries: readonly Injury[], named: StructuralRepairMedicine): string | null {
    const breaks = injuries
        .filter(i => !i.treated)
        .map(i => brokenStatusKeyOf(i.woundType))
        .filter((key): key is string => key !== null);
    return breaks.find(key => named.mends.includes(key)) ?? breaks[0] ?? null;
}

/**
 * Who the asker is to their house, read off the world: blood of somebody at
 * the elder rung or above, one of its chosen, and how long it has had them.
 */
function whoTheyAreToTheHouse(
    world: WorldState | null,
    houseId: string,
    asker: { id: string; realmOrdinal: number }
): { kin: boolean; chosen: boolean; years: number; today: number } {
    const today = Math.floor(world?.currentDay ?? 0);
    const sect = getSect(houseId);
    if (!world || !sect) return { kin: false, chosen: false, years: 0, today };
    const rankCount = sect.ranks.length;
    const elderRung = elderRungOf(rankCount);
    const roll = world.npcs.filter(n => n.status === 'alive' && n.factionId === houseId);

    // BLOOD: a child or a grandchild of somebody seated at the elder rung or
    // above, by the kinship rows the world writes (`parent`/`child`).
    const childrenOf = (id: string): string[] =>
        (world.npcs.find(n => n.id === id)?.relationships ?? [])
            .filter(r => r.kind === 'child')
            .map(r => r.targetId);
    const kin = roll
        .filter(n => n.factionRankIndex >= elderRung)
        .some(senior => {
            const children = childrenOf(senior.id);
            return children.includes(asker.id)
                || children.some(child => childrenOf(child).includes(asker.id));
        });

    // THE CHOSEN, off the house's own roll with the asker on it.
    const elderFloor = whatAnInsiderMustStandAt(
        houseId, elderRung, rankCount, sect.admissionOrdinal, sect.powerOrdinal);
    const chosen = chosenOf(
        [...roll.map(n => ({ id: n.id, realmOrdinal: n.cultivation.realmOrdinal })), asker],
        elderFloor
    ).some(m => m.id === asker.id);

    // THE YEARS, from the first robes the house issued them.
    const robed = world.objects
        .filter(o => o.ownerId === houseId && o.tags.includes('uniform') && o.data.memberId === asker.id)
        .map(o => Number(o.data.issuedOnDay))
        .filter(Number.isFinite);
    const years = robed.length === 0 ? 0 : Math.max(0, (today - Math.min(...robed)) / DAYS_PER_YEAR);
    return { kin, chosen, years, today };
}

/**
 * The ask, or null where these words are not it: no dose named, or a body
 * asked that is not the player's own house.
 */
export function askingYourHouseForARepairDose(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    /** Who was asked, as said. */
    asked: string,
    /** What was asked for, as said. */
    thing: string
): Execution | null {
    const medicine = theDoseNamed(thing);
    if (!medicine) return null;

    const membership = game.repos.sects.getMembership(cultivator.id);
    const meant = game.factionMeant(asked, cultivator);
    const toOwnHouse = ONES_OWN_HOUSE.test(asked.trim())
        || (membership !== null && meant !== null && meant.id === membership.sectId);
    if (!toOwnHouse) return null;

    const houseId = membership?.sectId ?? null;
    const houseName = houseId === null ? 'a house' : (game.repos.sects.getById(houseId)?.name ?? houseId);
    const woundKey = theBreakTheyCarry(cultivator.injuries, medicine);
    const world = game.atHand;
    const toThem = houseId === null
        ? { kin: false, chosen: false, years: 0, today: Math.floor(world?.currentDay ?? 0) }
        : whoTheyAreToTheHouse(world, houseId, { id: cultivator.id, realmOrdinal: cultivator.realmOrdinal });

    const decision = willTheHouseSpendOnThem({
        id: cultivator.id,
        realmOrdinal: cultivator.realmOrdinal,
        woundKey,
        houseId,
        onTheHouseRoll: membership !== null,
        kinOfSomebodyWhoMatters: toThem.kin,
        chosenOfTheHouse: toThem.chosen,
        yearsTheHouseHasSpent: toThem.years
    });
    const standing = `willTheHouseSpendOnThem: claim ${decision.claim}, break `
        + `${woundKey ?? 'none'}, kin ${toThem.kin}, chosen ${toThem.chosen}, `
        + `${Math.floor(toThem.years)} year(s) on the roll.`;

    if (!decision.meetsTheStandard) {
        return refused('engine.willTheHouseSpendOnThem', 'request', factsForRefusal(
            houseId === null ? 'You are nobody\'s to spend it on.' : `${houseName} will not open the box for you.`,
            decision.because,
            `${standing} Nothing spent, no time passed.`
        ));
    }

    const choice = world && houseId !== null && woundKey !== null
        ? doseAHouseWouldUse(world, houseId, woundKey, cultivator.realmOrdinal)
        : null;
    if (!world || houseId === null || woundKey === null || choice === null) {
        return refused('engine.doseAHouseWouldUse', 'request', factsForRefusal(
            `${houseName} has nothing that reaches it.`,
            `${decision.because} And the house holds no dose that reaches `
            + `${(getWoundType(woundKey)?.name ?? 'the break').toLowerCase()} in somebody standing where `
            + 'you stand. The standard is met and the shelf is not.',
            `${standing} doseAHouseWouldUse found nothing on ${houseId ?? 'no house'}. Nothing spent.`
        ));
    }

    const spent = spendRepairDose(
        world, houseId, cultivator.id, cultivator.name, woundKey, cultivator.realmOrdinal, toThem.today
    );
    if (!spent || !mendsThisBreak(choice.medicine, woundKey, cultivator.realmOrdinal)) return null;
    const kept = applyStructuralRepair(cultivator.injuries, choice.medicine, woundKey, cultivator.realmOrdinal);
    const closed = cultivator.injuries.filter(before => !kept.some(still => still.id === before.id));
    game.db.transaction(() => {
        for (const injury of closed) game.repos.cultivators.treatInjury(injury.id, run.turn + 1);
        game.repos.runs.incrementTurn(run.id, 1);
    })();
    game.theWorldMoved();

    const mended = (getWoundType(woundKey)?.name ?? woundKey).toLowerCase();
    const lines = [
        `${houseName} opens the box. ${decision.because}`,
        `It spends a ${choice.medicine.name} on you`
        + (choice.medicine.id === medicine.id ? '' : `, which is what it holds that reaches, not the ${medicine.name} you named`)
        + `, and the ${mended} is no longer something you are carrying.`,
        'The house\'s record says what it spent, on whom, and on what day.'
    ];
    const facts = factsForToolResult(`${houseName}: ${mended} closed.`, lines);
    (facts.required ??= []).push(lines[1]);
    facts.structure.push(
        standing,
        `spendRepairDose: ${spent.medicineId} out of ${houseId}`
        + `${spent.doseId ? ` (row ${spent.doseId}, kept and marked spent)` : ' (a counted dose off its resources)'}; `
        + `${closed.length} injury row(s) closed through applyStructuralRepair.`
    );
    return {
        facts,
        events: [],
        timeSkip: null,
        breakthrough: null,
        outcome: 'executed',
        calls: [{
            name: 'engine.spendRepairDose',
            action: 'request',
            summary: `${houseId} spent ${spent.medicineId} on ${cultivator.id} for ${woundKey}.`,
            ok: true
        }]
    };
}
