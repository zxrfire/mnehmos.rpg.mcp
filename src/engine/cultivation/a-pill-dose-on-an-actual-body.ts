/** Native dose preparation; repositories and world actors retain their own body/stock stores. */
import type { Pill } from '../../schema/cultivation.js';
import type { CultivationRNG } from './rng.js';
import { pillBandOrdinal } from './breakthrough.js';
import { drawGradeOutcome,rungsUnderThePitch,whatItDoesToTheSheet,type SheetForOutcome } from './grade-spread.js';
import { createInjury,rollInjurySeverity } from './injuries.js';
import { ordinaryWoundFor } from './which-wound-an-ordinary-injury-is.js';

/** Native medicine threshold, moved unchanged from alchemy_manage. */
export const TOXICITY_TOLERANCE=3;

export function preparePillDose(pill:Pill,body:SheetForOutcome,outcomeRng:CultivationRNG) {
    const pitch=pillBandOrdinal(pill.grade);
    const under=rungsUnderThePitch(body.realmOrdinal,pitch);
    const outcome=drawGradeOutcome(pill.grade,outcomeRng,under);
    const change=whatItDoesToTheSheet(outcome,body,{sourceOrdinal:pitch},outcomeRng);
    const dosed:Pill={...pill,potency:pill.potency*outcome.potencyMultiplier};
    return {pitch,under,outcome,change,dosed};
}

export function preparePillToxicity(pill:Pill,toxicityMultiplier:number,toxicityBefore:number,
    nextTurn:number,toxicityRng:CultivationRNG) {
    const toxicityAfterRaw=toxicityBefore+pill.toxicity*toxicityMultiplier;
    const poisoned=toxicityAfterRaw>=TOXICITY_TOLERANCE;
    const toxicityAfter=poisoned?toxicityAfterRaw-TOXICITY_TOLERANCE:toxicityAfterRaw;
    const poisonSeverity=rollInjurySeverity(toxicityRng);
    const poisonInjury=poisoned?createInjury({severity:poisonSeverity,source:'poison',turn:nextTurn,
        woundType:ordinaryWoundFor('poison',poisonSeverity),
        description:`Accumulated pill toxicity finally told. ${pill.name} was one too many.`},toxicityRng):null;
    return {toxicityAfterRaw,poisoned,toxicityAfter,poisonSeverity,poisonInjury};
}

/** Native restore_qi arithmetic, read once by both actual actor adapters. */
export function qiRestoredByDose(qi:number,maxQi:number,potency:number):number {
    return Math.min(potency,maxQi-qi);
}
