/**
 * THE HOUSEHOLD A SIXTEEN-YEAR-OLD CAME OUT OF.
 *
 * Measured before this existed: across 80 lives on 20 pinned worlds, a player
 * held ZERO rows in any relationship store. `bindNewbornToHousehold`,
 * `applyTeachingLines` and `applyPassedOver` write kin, master and rival ties
 * for world people only, and the player was not one of them - so the only
 * person a run opened knowing was a neighbour.
 *
 * The design owner ruled on all three:
 *
 *   > "the player needs to find a master, that doesn't change. but kin yes.
 *   > rival no. how can you have a rival as a mortal? you don't"
 *
 * So KIN and only kin. A master is the road the game is about and handing one
 * over at birth takes it away. A rival is earned by being somebody worth being
 * rivals with, which a mortal of sixteen is not. Neither is drawn here and
 * neither should be added.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * TWO STANDARDS FOR KIN, AND THE FIRST IS NOT A GAP
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The owner, on what a mortal parent is worth:
 *
 *   > "note that if your parents are mortals they're just mentioned once and
 *   > you never really see them again. that's how xianxia works too. so that
 *   > wouldn't be a defect. its only a defect if your parents are immortals and
 *   > don't have entities"
 *
 * A MORTAL PARENT IS A MENTION AND THAT IS THE GENRE WORKING. Named in the
 * opening, and then the story leaves the village behind. Nobody should build a
 * way to go home and see your mother, and nobody should read the absence of one
 * as something to close - the reason is the owner's own and it is the whole
 * argument: *"cuz we don't track mortals, so we don't have a choice."* A mortal
 * bound to a particular record is a promise this engine cannot keep, because
 * that person can die, move or be cleaned up and nothing will ever say so.
 *
 * A CULTIVATOR PARENT WITHOUT A RECORD IS THE ENGINE LYING. Somebody past
 * {@link FOUNDATION_ORDINAL} is alive in a hundred years, is somewhere the
 * world can name, and can be found, helped, disappointed or lost. Telling a
 * life it has a cultivator parent and holding no row for that person promises
 * somebody who does not exist. That half is pinned by `requires a world record
 * of a cultivator kin` and it must not be softened.
 *
 * The line is {@link FOUNDATION_ORDINAL} and it is not chosen here. `realms.ts`
 * draws it - *"below it a character is a mortal with a party trick, above it
 * they are a cultivator"* - and the same rung is where a lifespan stops being a
 * mortal question, which is the property this ruling actually turns on: whether
 * the person is still there to be found. Both readings land on the same number,
 * and it is the same one the marriage seeding uses.
 *
 * AND SOMEBODY THE CATALOG WROTE IS PAST IT AT ANY RUNG, which is the ruling
 * applied rather than an exception to it. The question is whether the world can
 * still speak of the person in a hundred years, the rung is a proxy for it, and
 * `theWorldForgetsTheMortalDead` says in its own code where the proxy stops: it
 * deletes the mortal dead and keeps everybody a catalog names. So a Sword Hand
 * at ordinal 4 standing on her sect's ground is a record, a tie and a place to
 * go, and a player born there can be her child. A villager at the same rung is
 * still a mention, for the reason above and for no other.
 *
 * AND THERE IS NO HOMECOMING. `I go home` is travel to an ordinary place: walk
 * there, look at who is standing there, done. No verb, no scene, no derived
 * account of who died while you were away. The owner, asked how much of one to
 * build: *"don't even build it."*
 *
 * SO A MORTAL HOUSEHOLD IS NAMED AND NOTHING MORE, and the name is still drawn
 * from a real person standing in the birthplace. That is not an inconsistency
 * and it is the thing somebody will later read as one: the rule that any name
 * this game prints is a name it must accept is pinned in two places, and the
 * villager is standing there whether or not this points at them. NO ENTITY
 * BEHIND THEM means no tie, no location claim, and nothing that can go stale -
 * not that the name has to come from nowhere.
 *
 * What the player loses with it is real and was accepted: `I look at my mother`
 * stops resolving, the opening drops the whereabouts clause for a mortal
 * parent, and a player whose parents are mortal carries for nobody.
 *
 * AND A MENTION NAMES THE WHOLE HOUSEHOLD, both parents and the other children.
 * A mortal who was KILLED is the one mortal the world keeps -
 * `whoIsStillCarriedFor` holds the row of everybody a priced deed names, which
 * is the exception `theWorldForgetsTheMortalDead` carries - so a dead mortal
 * parent is nameable where the world is still carrying them and is not where it
 * is about to forget them. WHICH OF THE TWO is not asked here: it is the same
 * question as whether the killing may be said at all, and `facesFromHome` asks
 * it once for both. Carrying for them is still refused whatever the answer -
 * a mention writes no tie, and `whoTheyCarryFor` reads ties.
 *
 * AND THE WORLD'S OWN MORTAL FAMILIES ARE UNTOUCHED. This is player-side and
 * must stay player-side: `the-families-a-world-opens-holding.ts` puts a blood
 * tie on 34-41% of the living, and it exists because `whoTheyCarryFor` reached
 * 0 of 595 people without it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NOTHING HERE IS A SECOND NOTION OF FAMILY
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `bindNewbornToHousehold` is the world's own answer to "a child is born, who
 * are they to whom", and it is called unchanged. What this module does is pick
 * the parent out of the people standing where the birth happened and hand the
 * household back. Every rule about how many children a parent has, whether
 * there is a second parent, and which of their children count as siblings is
 * that function's and is not restated.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHOSE HALF LANDS WHERE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The kin's half - the parent's `child` row, the siblings' `kin` rows - is
 * written onto their world records and persists.
 *
 * The player's half lands on the player's world row where the world already
 * holds one, and `newRun` now creates it before calling this. Both cases are
 * handled rather than one, because the order is not this module's to choose: a
 * caller with no row gets the household back and writes it as knowledge, and a
 * caller with one gets the ties written symmetrically as well.
 *
 * It matters for one reader. `whoTheyCarryFor` in `what-a-telling-lands-on.ts`
 * reads the HEARER's own rows to decide whose killing they may open an account
 * for, so a player whose row carries no tie cannot tell anybody their parent
 * was killed. `rescuersFor` reads the other end - the rescuer's row toward the
 * subject - and is unaffected by which half lands, which is why the asymmetry
 * hid. It is worth being exact about that one, because it reads as though kin
 * gained something and they did not: a rescuer has to hold `PIERCE_GRANT`,
 * which opens at Void Tribulation, and no parent a childhood can reach stands
 * within twenty rungs of it. Kin never qualified and still do not.
 */

import type { Cultivator } from '../schema/cultivation.js';
import { forStream } from '../engine/cultivation/rng.js';
import { DAYS_PER_YEAR } from '../engine/cultivation/cultivation.js';
import { FOUNDATION_ORDINAL } from '../engine/cultivation/realms.js';
import {
    bindNewbornToHousehold,
    couldParent,
    rosterOf,
    theOtherChildrenOf,
    theOtherParentOf
} from '../engine/world/the-ties-an-ordinary-life-produces.js';
import {
    createNpc, somebodyTheCatalogWrote, type NpcRecord, type RelationshipKind
} from '../engine/world/npc-state.js';
import { getNpc, upsertNpc, type WorldState } from '../engine/world/world-state.js';

/** The two kinds a birth produces, as the household machinery names them. */
const A_HOUSEHOLD_PRODUCES: ReadonlySet<RelationshipKind> = new Set(['parent', 'kin']);

/** One person the household put in this life, and what they are to it. */
export interface KinFromBirth {
    npc: NpcRecord;
    /** `parent` or `kin`, read off the tie rather than decided here. */
    kind: RelationshipKind;
    /**
     * True where nothing was written and nothing is claimed.
     *
     * A mortal household. The name is real and the person is real; what is
     * absent is the tie and the whereabouts, because mortals are not tracked
     * and anything said about where one of them is goes stale the moment the
     * world moves without telling anybody.
     */
    aMentionOnly: boolean;
}

export interface FamilyInput {
    world: WorldState;
    cultivator: Cultivator;
    /**
     * Who a childhood could have contained, already filtered by the caller.
     * A parent is somebody a childhood contained by definition, so the reach
     * rule that governs the neighbours governs them too rather than getting a
     * rule of its own.
     */
    candidates: readonly NpcRecord[];
    /** The run seed. Which parent, out of several, is drawn from it. */
    seed: string;
    /**
     * Whether this birth's own family is a cultivating one.
     *
     * Read by the caller off `familyHouse.standingFrom`, which `origin.ts` says
     * in as many words is the family's STANDING rather than its word - the one
     * field that answers what kind of people this household is made of. It
     * decides nothing but which candidates are looked at first: a clan's child
     * is born to the clan, and a farm child to whoever is on the farm.
     */
    bornToCultivators: boolean;
}

/**
 * The household this life came out of, bound into the world.
 *
 * Empty is a real answer and is the orphan: nowhere the birth happened holds
 * anybody old enough to have raised them and near enough to have been in the
 * room. It is not forced open, and nobody is invented to fill it.
 */
export function theFamilyThisLifeOpensWith(input: FamilyInput): KinFromBirth[] {
    const { world, cultivator, candidates, seed, bornToCultivators } = input;
    const day = world.currentDay;

    // Already bound, on a second read of the same life. Re-running the draw
    // would be a second household for one person.
    const existing = getNpc(world, cultivator.id);
    const held = existing?.relationships.filter(tie => A_HOUSEHOLD_PRODUCES.has(tie.kind)) ?? [];
    if (held.length > 0) return asKin(world, held);

    const eligible = couldParent(candidates, Math.floor(cultivator.age), day)
        .sort((a, b) => (a.id < b.id ? -1 : 1));
    if (eligible.length === 0) return [];

    // A HOUSEHOLD BEFORE SOMEBODY LIVING ALONE, read off the two markers the
    // world already uses for one. Drawing uniformly over every adult in the
    // square made nearly every player the only child of somebody who had never
    // kept a household at all, which is the opposite of what
    // `bindNewbornToHousehold` models. Measured without the preference, over 30
    // pinned worlds: 21 of 30 lives had exactly one parent and no siblings.
    // With it, over 40: 19 of 40 have a sibling, 19 have a parent alone, 2 have
    // nobody.
    //
    // A preference and not a requirement. Where nobody eligible keeps one the
    // draw falls back to whoever is there, and a child with one parent is
    // common and is not a gap - `bindNewbornToHousehold`'s own ruling, not a
    // second one.
    //
    // AND A CULTIVATING FAMILY'S CHILD IS BORN TO CULTIVATORS, which is the
    // half that makes two cultivator parents reachable at all. Before it,
    // measured over six `established_clan` births - a tier whose whole
    // description is a cultivating clan - the parent drawn was a Qi Condensation
    // townsman every single time, because a settlement holds far more of them
    // than it holds cultivators and the draw was uniform.
    //
    // Scored rather than filtered in a cascade, because the three things being
    // preferred are independent and a cascade of every combination of them is
    // six lists that say one sentence. A spouse outranks a child: both mean a
    // household was kept, and only the first of them can give this life a
    // second parent.
    const ranked = (one: NpcRecord): number =>
        (bornToCultivators && one.cultivation.realmOrdinal >= FOUNDATION_ORDINAL ? 4 : 0)
        + (one.relationships.some(tie => tie.kind === 'spouse') ? 2 : 0)
        + (one.relationships.some(tie => tie.kind === 'child') ? 1 : 0);

    // The best band anybody is in, which is never empty: everybody scores.
    const best = Math.max(...eligible.map(ranked));
    const parents = eligible.filter(one => ranked(one) === best);

    const chosen = parents[forStream(seed, 'childhood', 'household').int(0, parents.length - 1)];

    // ── A MORTAL HOUSEHOLD IS A MENTION AND NOTHING ELSE ────────────────
    //
    // No tie on anybody's record, and no claim about where they are. The name
    // is still a real person standing in the birthplace, and that is not an
    // inconsistency: any name this game prints is a name it has to accept, and
    // the villager is there whether or not this points at them. What "no entity
    // behind them" means is NO TIE, NO LOCATION CLAIM, AND NOTHING THAT CAN GO
    // STALE - not that the name has to come from nowhere.
    //
    // The membership is `theOtherChildrenOf`, which is the same read the bind
    // path uses, so a mentioned household and a bound one are the same people.
    //
    // AND THE RUNG IS NOT THE QUESTION - WHETHER THE WORLD KEEPS THEM IS. The
    // owner's reason for the mention is *"cuz we don't track mortals, so we
    // don't have a choice"*: a mortal can die, move or be cleaned up and nothing
    // will ever say so. `theWorldForgetsTheMortalDead` is that sentence in code,
    // and it has an exception - somebody the catalog wrote is kept by name at
    // ANY rung, because the catalog still holds it. So a Sword Hand of the Cold
    // Sword Sect at ordinal 4 is a real record and a real tie, and the ruling is
    // untouched: what it refuses is a promise this engine cannot keep, and this
    // is one it can.
    // AND IT IS THE WHOLE HOUSEHOLD, WHICH IT WAS NOT.
    //
    // This named one parent and the children, because the read for the second
    // parent lived inside `bindNewbornToHousehold` and there was no way to ask
    // it without writing. So a mortal life opened knowing it had one parent
    // whatever the world held - and a mortal parent who had been KILLED was
    // unreachable for that reason alone, which is the open question
    // `a-childhood-can-have-a-victim-in-it` recorded and the design owner then
    // ruled on: you know what you were told, and a killing the world is still
    // holding is a thing the people who raised you can tell you.
    //
    // Measured on 1,950 births over 13 pinned worlds, twice. On the day a world
    // opens, NO mortal parent holds a spouse tie at all - `seedTheMarriages`
    // pairs cultivators only - so the case cannot arise and 0 of 1,853 mortal
    // households were short anybody. After the same worlds ran 25 years, 1,355
    // of 1,634 held one and 22 had a second parent who had been killed inside
    // the life's own sixteen years. Every one of the 22 said nothing.
    //
    // A mention and nothing more, exactly as before: no tie, no whereabouts,
    // and nothing that can go stale. Whether a DEAD one is somebody the world
    // will still have next year is the caller's to ask - see the header.
    if (chosen.cultivation.realmOrdinal < FOUNDATION_ORDINAL
        && !somebodyTheCatalogWrote(chosen)) {
        const { at } = rosterOf(world);
        const other = theOtherParentOf(world, at, chosen, Math.floor(cultivator.age), day);
        const parents = other === null ? [chosen] : [chosen, other];
        return [
            ...parents.map(npc => ({
                npc, kind: 'parent' as RelationshipKind, aMentionOnly: true
            })),
            ...theOtherChildrenOf(world, at, parents, cultivator.id)
                .map(npc => ({ npc, kind: 'kin' as RelationshipKind, aMentionOnly: true }))
        ];
    }

    // The row the world would hold for this person, whether or not it holds one
    // yet. `bindNewbornToHousehold` accumulates the child's half onto the record
    // it is given and hands it back, so a stand-in carries the answer out even
    // when there is nothing on the roster to write it to.
    const child = existing ?? createNpc(world.seed, {
        id: cultivator.id,
        name: cultivator.name,
        bornOnDay: Math.max(0, Math.floor(day - cultivator.age * DAYS_PER_YEAR)),
        onDay: day,
        occupation: 'the one being played'
    });

    const household = bindNewbornToHousehold(world, child, chosen.id, day, rosterOf(world));
    // Only where the world already holds this person. Inserting a row here
    // would make `refreshThePlayerRow` find one where it expects none, and that
    // is the call whose first write is what flushes the world at all.
    if (existing) Object.assign(world, upsertNpc(world, household.child));

    return asKin(world, household.child.relationships);
}

function asKin(
    world: WorldState,
    ties: readonly { targetId: string; kind: RelationshipKind }[]
): KinFromBirth[] {
    const out: KinFromBirth[] = [];
    for (const tie of ties) {
        if (!A_HOUSEHOLD_PRODUCES.has(tie.kind)) continue;
        const npc = getNpc(world, tie.targetId);
        if (npc === null) continue;
        out.push({ npc, kind: tie.kind, aMentionOnly: false });
    }
    // Parents before siblings, then by id, so a family reads as a family and
    // the order is a function of the world rather than of insertion.
    return out.sort((a, b) =>
        (a.kind === b.kind ? 0 : a.kind === 'parent' ? -1 : 1)
        || (a.npc.id < b.npc.id ? -1 : 1));
}
