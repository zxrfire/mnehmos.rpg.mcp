/** Aid is offered only at an actual vessel contact, with real people and real medicine. */
import type { WorldState } from './world-state.js';
import { isTheWorldsToMove, woundsCarriedBy, setLocation, type NpcRecord } from './npc-state.js';
import { shipPassengerAt } from './passenger-on-a-vessel.js';
import { locationOnNpcJourney, firstTravellerOnTheWay } from './places-on-the-way.js';
import { bodilyTroubleAboard, captainAnswersTrouble } from './a-captain-answers-trouble.js';
import { publicCaptainMedicalResponse } from './a-public-captain-protects-their-passengers.js';
import { transferPossession } from './possessions.js';
import { woundMedicineIn, whatOneDoseCloses, woundMedicineByHolder, swallowWhatTheyNeed } from './house-wound-medicine.js';
import { activePlague, treatPlague } from '../cultivation/plague.js';
import { treatNativePlagueWithMedicine } from './plague-in-a-place.js';
import { untreatedInjuryCount } from '../cultivation/injuries.js';
import { whetherTheyGiveItAway } from './what-somebody-standing-here-would-part-with.js';
import { theyHaveOutgrownTheFind } from './private-party-finds.js';
import { forStream } from '../cultivation/rng.js';
import { createObligation } from '../social/grudges.js';
import { factsWithDataValue } from './witness-reaction-index.js';

/** The caller supplies a named actual route contact, never a province scan. */
export function aidAtAnActualWaterContact(world: WorldState, receiptId: string, contact: NpcRecord, day: number) {
    const ship = shipPassengerAt(world, receiptId, day), vesselId = contact.activity?.vesselId;
    if (!ship || ship.arrived || ship.unavailable || !ship.locationId || !vesselId || vesselId === ship.vesselId
        || contact.status !== 'alive' || locationOnNpcJourney(world.locations, contact, day) !== ship.locationId) return null;
    const captain = ship.crew.find(person => person.identity.occupation === 'shipmaster');
    if (!captain) return null;
    const patient = isTheWorldsToMove(contact) ? contact : null;
    const trouble = patient && bodilyTroubleAboard(patient, day);
    if (!patient || !trouble) return null;
    const body = { ...patient.cultivation, injuries: woundsCarriedBy(patient) };
    const doseAt = world.objects.findIndex(object => object.ownerId === captain.id && object.possessorId === captain.id
        && woundMedicineIn(object) && (whatOneDoseCloses(woundMedicineIn(object)!, body.injuries, body.realmOrdinal).closed.length > 0
            || activePlague(body, day) && treatPlague(body, woundMedicineIn(object)!, day) !== null));
    let gifted = false;
    const answer = captainAnswersTrouble(world, captain, { ...trouble, key: `distress:${vesselId}:${trouble.key}` },
        receiptId, ship.locationId, day, `render assistance to the nearby vessel.`, () => {
            const patientAt=world.npcs.findIndex(person=>person.id===patient.id);
            world.npcs[patientAt]=setLocation(world.npcs[patientAt],ship.locationId,day);
            if (doseAt < 0) {
                const other = factsWithDataValue(world, 'vesselId', vesselId)
                    .filter(fact => fact.data.publicPassage === true && fact.data.actualBoarding === true && fact.day <= day).at(-1);
                if (other) publicCaptainMedicalResponse(world, other.id, day);
                // The answer and the real medical report are events; no absent supply is invented.
                return true;
            }
            const dose = world.objects[doseAt];
            if (!whetherTheyGiveItAway({ id: captain.id, name: captain.name, ordinal: captain.cultivation.realmOrdinal,
                factionId: captain.factionId, spiritStones: captain.spiritStones }, {
                outgrown: theyHaveOutgrownTheFind(captain, dose), withholdingCostsFace: false,
                recipientStanding: captain.relationships.find(tie => tie.targetId === patient.id)?.standing ?? 0,
                rng: forStream(world.seed, 'captain-aid-goods', captain.id, vesselId, trouble.key) })) return false;
            world.objects[doseAt] = transferPossession(dose, { toHolderId: patient.id, toHolderName: patient.name,
                transfersOwnership: true, onDay: day, how: 'gifted', factId: receiptId });
            gifted = true;
            treatNativePlagueWithMedicine(world, patient.id, patient.id, day);
            const at = world.npcs.findIndex(person => person.id === patient.id), fresh = world.npcs[at];
            const seenTo = swallowWhatTheyNeed(world, woundMedicineByHolder(world.objects), fresh, null, day);
            if (seenTo.swallowed) world.npcs[at] = { ...fresh, cultivation: { ...fresh.cultivation,
                injuries: seenTo.injuries, untreatedInjuries: untreatedInjuryCount(seenTo.injuries) } };
            return true;
        });
    if (answer && gifted) world.obligations.push(createObligation({ kind: 'favor', holderId: captain.id,
        subjectId: patient.id, cause: 'gifted_resource', severity: 'slight', onDay: day,
        triggeringEventId: answer.id, description: 'Actual medicine given at a vessel contact.', tags: ['vessel-assistance'] }));
    return answer;
}

/** A dated accepted crossing is an appointment, including on an NPC-only voyage. */
export function captainWaterAppointments(world: WorldState, afterDay: number, throughDay: number) {
    const appointments: {key:string;day:number;run:()=>void}[] = [];
    const masters = world.npcs.filter(person=>isTheWorldsToMove(person)&&person.status==='alive'
        &&person.identity.occupation==='shipmaster'&&person.activity?.kind==='travelling'
        &&person.activity.seaLaneId&&person.activity.vesselId);
    for (const master of masters) {
        const receipt = factsWithDataValue(world,'vesselId',master.activity!.vesselId!)
            .filter(fact=>fact.data.publicPassage===true&&fact.data.actualBoarding===true).at(-1);
        if (!receipt) continue;
        const ship = shipPassengerAt(world,receipt.id,Math.max(afterDay,master.activity!.sinceDay));
        if (!ship || ship.arrived || ship.unavailable || ship.arrivalDay<=afterDay) continue;
        const crossing = firstTravellerOnTheWay({locations:world.locations,
            npcs:world.npcs.filter(person=>isTheWorldsToMove(person)&&!!person.activity?.vesselId
                &&person.activity.vesselId!==ship.vesselId),fromId:ship.fromId,toId:ship.toId,
            onDay:afterDay,days:Math.min(throughDay,ship.arrivalDay)-afterDay,overWater:true,
            journey:{sinceDay:ship.departureDay,untilDay:ship.arrivalDay}});
        if (!crossing) continue;
        const day=afterDay+crossing.afterDays;
        appointments.push({key:`captain-crossing:${ship.receipt.id}:${crossing.npc.id}:${day}`,day,
            run:()=>{const contact=world.npcs.find(person=>person.id===crossing.npc.id);
                if(contact)aidAtAnActualWaterContact(world,receipt.id,contact,day);}});
    }
    return appointments;
}
