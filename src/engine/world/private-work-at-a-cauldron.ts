/** An accepted private refinement uses the existing recipe, real bench and shared odds. */
import type { WorldState } from './world-state.js';
import type { NpcRecord } from './npc-state.js';
import type { HistoricalFact } from './history.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { factsWithDataValue } from './witness-reaction-index.js';
import type { ObligationRecord } from '../social/grudges.js';
import type { PrivateWorkBodies, PrivateWorkObjective } from './private-paid-work.js';
import { privateWorkTerms } from './private-paid-work.js';
import { privatePeopleCanSpeak } from './private-requests.js';
import { whatThisPersonHasOnTheBench, theIdsOnTheBench } from './what-is-on-the-bench.js';
import { takeWhatTheRecipeNames } from './taking-the-materials-off-the-bench.js';
import { daysAtTheWork } from '../social-leverage/commissioning-a-craft.js';
import { refineChance } from '../cultivation/the-odds-a-refinement-holds.js';
import { whatAnIngredientIs } from '../cultivation/what-a-cauldron-will-take.js';
import { whatTheRecipeSpends, type Recipe as BenchRecipe } from '../../data/cultivation/what-an-artifact-is-made-of.js';
import { getRecipe } from '../../data/cultivation/recipes.js';
import { getPill } from '../../data/cultivation/pills.js';
import { disciplineWorksIn, HOME_REGION_ID } from '../../data/cultivation/regions.js';
import { regionCatalogIdOf } from './how-a-cultivator-comes-by-a-road.js';
import { theBestVesselToHand } from './the-vessel-somebody-works-at.js';
import { makeObject, transferPossession, type ObjectRecord } from './possessions.js';
import { forStream } from '../cultivation/rng.js';

export function ingredientsOfPrivateRefinement(recipeId: string): BenchRecipe | null {
    const recipe = getRecipe(recipeId);
    if (!recipe) return null;
    const slots: BenchRecipe[number][] = [];
    for (const ingredient of recipe.ingredients) {
        const material = whatAnIngredientIs(ingredient.itemId);
        if (!material) return null;
        for (let unit = 0; unit < ingredient.quantity; unit++) slots.push({ what: material.name,
            materialId: material.id, grade: material.grade, from: material.from });
    }
    return slots;
}

/** Materialize one already-produced private dose, retaining its actual maker/custody. */
export function recordPrivateRefinementDose(state: WorldState, offer: HistoricalFact,
    maker: { id: string; name: string }, recipeId: string, day: number): ObjectRecord | null {
    const recipe = getRecipe(recipeId), pill = recipe && getPill(recipe.producesPillId);
    if (!pill) return null;
    const id = `private-refined:${offer.id}`;
    const existing = state.objects.find(object => object.id === id);
    if (existing) return existing;
    const dose = transferPossession(makeObject({ id, name: pill.name, kind: 'pill', ownerId: maker.id,
        ownerName: maker.name, possessorId: maker.id, description: pill.description,
        data: { privateRefinement: offer.id, pillId: pill.id, quantity: 1, grade: pill.grade } }), {
        toHolderId: maker.id, toHolderName: maker.name, onDay: day, how: 'crafted', factId: offer.id });
    state.objects.push(dose); return dose;
}

/** Only the successful actual player/MCP refinement writer calls this receipt hook. */
export function recordAnActualPrivateRefinement(state: WorldState, maker: { id: string; name: string }, recipeId: string, day: number): boolean {
    const word = state.obligations.find(word => word.status === 'open' && word.holderId === maker.id
        && word.tags.includes('private-paid-work') && (word.dueOnDay ?? Infinity) >= day);
    const offer = word && state.history.facts.find(fact => fact.id === word.triggeringEventId);
    const terms = offer && privateWorkTerms(offer);
    return !!offer && terms?.objective.kind === 'refine' && terms.objective.recipeId === recipeId
        && recordPrivateRefinementDose(state, offer, maker, recipeId, day) !== null;
}

export function servePrivateRefinement(state: WorldState, offer: HistoricalFact, term: ObligationRecord,
    objective: Extract<PrivateWorkObjective, { kind: 'refine' }>, worker: NpcRecord, day: number, bodies?: PrivateWorkBodies): void {
    const recipe = getRecipe(objective.recipeId), pill = recipe && getPill(recipe.producesPillId);
    const slots = ingredientsOfPrivateRefinement(objective.recipeId);
    if (!recipe || !pill || !slots || recipe.requiredOrdinal > worker.cultivation.realmOrdinal
        || !disciplineWorksIn(regionCatalogIdOf(state, worker.locationId) ?? HOME_REGION_ID, 'alchemy')) return;
    const recipient = bodies?.person(objective.recipientId) ?? state.npcs.find(person => person.id === objective.recipientId);
    const employer = bodies?.person(term.subjectId ?? '') ?? state.npcs.find(person => person.id === term.subjectId);
    const speaks = (person: NpcRecord) => bodies?.canSpeak(worker, person, day) ?? privatePeopleCanSpeak(state, worker, person, day);
    const bench = () => [...(bodies?.bench?.(worker.id) ?? whatThisPersonHasOnTheBench(undefined, state.objects, worker.id)),
        ...(employer && speaks(employer) ? bodies?.bench?.(employer.id)
            ?? whatThisPersonHasOnTheBench(undefined, state.objects, employer.id) : [])];
    let started = factsWithDataValue(state, 'privateRefinementStarted', offer.id)[0];
    if (!started) {
        const days = daysAtTheWork(pill.grade, worker.cultivation.realmOrdinal);
        if (!employer || !speaks(employer) || day + days > (term.dueOnDay ?? Infinity)
            || whatTheRecipeSpends(pill.grade, theIdsOnTheBench(bench()), slots) === null) return;
        started = appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret', locationId: worker.locationId,
            actors: [{ id: worker.id, name: worker.name, role: 'refiner' }], causes: [offer.id],
            summary: `${worker.name} began refining ${pill.name}.`,
            data: { privateRefinementStarted: offer.id, readyOnDay: day + days } }), { recur: false, bystanders: false });
        const at = state.npcs.findIndex(person => person.id === worker.id);
        state.npcs[at] = { ...state.npcs[at], activity: { ...worker.activity!, untilDay: day + days } };
    }
    const due = Number(started.data.readyOnDay);
    if (day < due || worker.locationId !== started.locationId) return;
    if (!factsWithDataValue(state, 'privateRefinementResolved', offer.id).length) {
        const materials = bench();
        const took = bodies?.takeRecipeMaterials ? bodies.takeRecipeMaterials(pill.grade, slots, materials, day, pill.name)
            : takeWhatTheRecipeNames({ objects: state.objects, grade: pill.grade, recipe: slots, bench: materials,
                onDay: day, intoWhat: pill.name }) !== null;
        if (!took) return;
        const vessel = theBestVesselToHand(state.objects, worker.id, 'cauldron', worker.cultivation.realmOrdinal);
        const odds = refineChance(recipe.baseSuccessRate, worker.cultivation.realmOrdinal, recipe.requiredOrdinal,
            worker.cultivation.attributes.insight, 0, vessel?.grade ?? null);
        const succeeded = forStream(state.seed, 'private-refinement-work', offer.id, worker.id).chance(odds.chance);
        appendWorldFact(state, makeFact({ day: due, kind: 'opportunity', visibility: 'secret', locationId: worker.locationId,
            actors: [{ id: worker.id, name: worker.name, role: 'refiner' }], causes: [offer.id],
            summary: `${worker.name}'s refinement of ${pill.name} ${succeeded ? 'produced a dose' : 'failed'}.`,
            data: { privateRefinementResolved: offer.id, succeeded } }), { recur: false, bystanders: false });
        if (succeeded) recordPrivateRefinementDose(state, offer, worker, recipe.id, due);
        const at = state.npcs.findIndex(person => person.id === worker.id);
        state.npcs[at] = { ...state.npcs[at], activity: { ...state.npcs[at].activity!, untilDay: term.dueOnDay } };
    }
    const dose = state.objects.find(object => object.data.privateRefinement === offer.id && object.possessorId === worker.id);
    if (!dose || !recipient || !speaks(recipient)) return;
    if (bodies?.payPill) bodies.payPill(dose.id, worker.id, recipient.id, day, offer.id);
    else state.objects[state.objects.findIndex(object => object.id === dose.id)] = transferPossession(dose, {
        toHolderId: recipient.id, toHolderName: recipient.name, onDay: day, how: 'bought', transfersOwnership: true, factId: offer.id });
}
