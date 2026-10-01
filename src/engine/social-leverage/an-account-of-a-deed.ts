/** A deed is judged by a witness; an account is judged against that witness's evidence. */
import { oddsOf, type AttemptInput } from './an-attempt-to-move-somebody.js';
import type { Wrong } from './what-somebody-does-about-being-wronged.js';

export type DeedAccount = 'found' | 'already_damaged' | 'defence' | 'denial' | 'blame' | 'permission' | 'admitted';
export type DeedBelief = 'belief' | 'half-belief' | 'disbelief';

export interface SeenDeed {
    wrong: Wrong | 'bones' | null;
    sawAct: boolean;
    sawFirstAttack: boolean;
    foundBeforeActor: boolean;
    sawPermission: boolean;
    recognisedProperty: boolean;
    bonesTaken: boolean;
    competingAccount: boolean;
    /** A loss visible across several people, not an opinion of the act. */
    manyHarmed?: boolean;
}

/** Alignment supplies values, ties supply whose interests this person carries. */
export function doesTheDeedNeedExplaining(input: {
    trust: AttemptInput;
    seen: SeenDeed;
    carriesForVictim: boolean;
    ownsGround: boolean;
    forOwnSide?: boolean;
}): boolean {
    const { trust, seen } = input;
    if (seen.wrong === null) return false;
    if (input.carriesForVictim || input.ownsGround) return true;
    if (input.forOwnSide) return false;
    if (seen.manyHarmed) return true;
    const base = trust.subject.alignment === 'righteous' ? 0.8
        : trust.subject.alignment === 'demonic' ? trust.actor.alignment === 'demonic' ? 0.04 : 0.25
            : 0.35;
    const stake = seen.recognisedProperty || seen.wrong === 'trespassed' ? 0.2 : 0;
    const debt = (trust.ledger ?? []).some(row => row.status === 'open'
        && row.holderId === trust.subject.id && row.subjectId === trust.actor.id) ? 0.2 : 0;
    const defence = seen.sawFirstAttack ? 0.35 : 0;
    const trustInActor = (trust.theirTie?.strength ?? 0) * 0.2;
    return trust.rng.chance(Math.max(0.01, Math.min(0.99,
        base + stake + debt - defence - trustInActor)));
}

/** Direct contradiction cannot be bought off with charm or a higher rung. */
export function weighAnAccountOfADeed(input: {
    trust: AttemptInput;
    seen: SeenDeed;
    account: DeedAccount;
}): { belief: DeedBelief; confidence: number; responsible: boolean } {
    const { seen, account } = input;
    const denies = account === 'found' || account === 'denial' || account === 'blame' || account === 'already_damaged';
    const contradiction = (denies && seen.sawAct)
        || (account === 'found' && seen.bonesTaken)
        || (account === 'found' && seen.wrong !== 'killed')
        || (account === 'already_damaged' && seen.wrong !== 'robbed' && seen.wrong !== 'trespassed');
    if (contradiction) return { belief: 'disbelief', confidence: 0, responsible: true };
    const supported = account === 'admitted'
        || (account === 'found' && seen.foundBeforeActor)
        || (account === 'defence' && seen.sawFirstAttack)
        || (account === 'permission' && seen.sawPermission);
    const confidence = Math.max(0, Math.min(1, oddsOf(input.trust).odds
        + (supported ? 0.5 : 0) - (seen.competingAccount ? 0.3 : 0)
        - (seen.recognisedProperty && (denies || account === 'permission') ? 0.2 : 0)));
    const belief: DeedBelief = confidence >= 0.65 ? 'belief'
        : confidence < 0.25 ? 'disbelief' : 'half-belief';
    return { belief, confidence, responsible: account === 'admitted' || belief === 'disbelief' };
}
