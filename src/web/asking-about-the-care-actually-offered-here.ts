/** Clinical questions read an actual provider's offer; they never buy or administer it. */
import { purposeOf } from '../engine/world/architecture.js';
import { isAMortalPhysician, physicianIsWorking, whoDispensesAtTheHouse } from '../engine/world/who-is-actually-seeing-to-wounds.js';
import { countedWoundMedicine, onTheShelf, whatTheShelfChargesAMember, whatTheShelfGivesAMember }
    from '../engine/world/house-wound-medicine.js';
import { medicineReaches } from '../engine/cultivation/what-grade-of-medicine-a-wound-needs.js';
import { activePlague, treatPlagueWithMedicineGrade } from '../engine/cultivation/plague.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { isPermanentWound } from '../data/cultivation/wounds.js';
import type { Cultivator } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import { factsForToolResult } from './facts.js';
import { carePricesHere } from './what-care-costs-where-you-are.js';
import { positionIn } from './standing.js';
import { TREATMENT_DAYS } from './turn-constants.js';
import { asksAboutClinicalCare } from './asking-about-clinical-care.js';

export function askingAboutCareHere(game: GameService, cultivator: Cultivator, askedId: string, topic: string) {
    if (!asksAboutClinicalCare(topic)) return null;
    const world = game.atHand;
    if (!world) return null;
    const placeId = game.worldPlaceOf(cultivator);
    const place = world.locations.find(p => p.id === placeId);
    const provider = world.npcs.find(n => n.id === askedId);
    if (!place || !provider || !game.present(cultivator).some(p => p.id === askedId)) return null;
    const lines: string[] = [];
    if (isAMortalPhysician(provider) && !physicianIsWorking(world, provider)) {
        lines.push('This physician is not currently offering care here. Ask at the clinic while they are working. Nothing has been bought or administered.');
    } else if (physicianIsWorking(world, provider)) {
        const quote = carePricesHere(game, cultivator);
        lines.push(`This physician offers mortal-grade care here. A paid course lasts ${TREATMENT_DAYS} days; `
            + `ordinary bodily care costs ${quote.restingPrice} spirit stones, and a course for each reachable wound costs ${quote.perWound} spirit stones, with the bodily-care price as the minimum fee. `
            + 'Food for the month is paid separately from the remaining purse through ordinary provisioning.');
        lines.push('Asking has bought no course, spent nothing and promised no completed treatment.');
        lines.push('Ordinary care does not reach every wound or every body. Stronger injuries need medicine of a grade that reaches them.');
        lines.push('This describes the physician\'s care, not what other medicines may be kept here.');
        if (activePlague(cultivator, routineTime(world))) lines.push(treatPlagueWithMedicineGrade(cultivator, 'mortal', routineTime(world))
            ? `This physician can administer mortal medicine for your plague before the stay, for ${quote.perWound} spirit stones; food remains separately paid.`
            : 'This physician\'s mortal medicine does not reach your plague. Stronger wound medicine is needed.');
        const wounds = cultivator.injuries.filter(w => !w.treated);
        if (wounds.length) {
            const reachable = wounds.filter(w => !isPermanentWound(w.woundType)
                && medicineReaches('mortal', w.severity, cultivator.realmOrdinal));
            lines.push(`Of the wounds you currently carry, mortal care reaches ${reachable.length}; `
                + 'the others cannot be closed by this physician\'s ordinary course.');
        }
    } else if (purposeOf(place) === 'infirmary' && place.controllingFactionId
        && whoDispensesAtTheHouse(world, place.controllingFactionId)?.id === askedId) {
        const house = world.factions.find(h => h.id === place.controllingFactionId)!;
        lines.push(`This infirmary dispenses ${house.name}'s finite medicine to its members for contribution.`);
        const shelf = countedWoundMedicine().filter(pill => onTheShelf(house, pill.id) > 0);
        lines.push(...shelf.map(pill => `${pill.name}: ${onTheShelf(house, pill.id)} doses on the shelf, `
            + `${pill.grade} grade, ${whatTheShelfChargesAMember(pill)} contribution per dose.`));
        if (!shelf.length) lines.push('There is no counted wound medicine left on the shelf.');
        const position = positionIn(game.repos, cultivator.id);
        if (position?.sectId === house.id) {
            lines.push(`You have ${position.contribution} contribution with this house.`);
            const offer = whatTheShelfGivesAMember(world, { houseId: house.id,
                member: { id: cultivator.id, rankIndex: position.rankIndex, realmOrdinal: cultivator.realmOrdinal,
                    injuries: cultivator.injuries }, contribution: position.contribution });
            if (offer.doses.length) lines.push(`For the wounds you carry now, the shelf could offer ${offer.doses.length} doses for ${offer.contribution} contribution; nothing has been dispensed.`);
            if (offer.withheld?.why === 'contribution') lines.push(`${offer.withheld.pill.name} would reach a wound you carry, but costs ${offer.withheld.price} contribution.`);
            if (offer.withheld?.why === 'kept') lines.push(`${offer.withheld.pill.name} is held back for ${offer.withheld.above} wounded members who are seen to before you.`);
        } else lines.push('You are not on this house\'s roll. Its member medicine is not offered to you.');
    } else return null;
    return factsForToolResult('The care offered here.', lines);
}
