/** One fight-sized adaptation; the body learns harm, never an art's identity. */
import type { BaseDamageType } from '../../schema/base-schemas.js';
import type { Technique, Injury } from '../../schema/cultivation.js';
import { REALM_TIERS } from './realms.js';

const BODY_FLOOR = REALM_TIERS.find(t => t.key === 'tribulation_transcendence')!.ordinalStart;
const ELEMENTAL = new Set<BaseDamageType>(['fire', 'cold', 'lightning', 'thunder', 'acid', 'poison', 'radiant']);

export interface Adaptation {
    key: BaseDamageType | null;
    closed: number;
    recent: BaseDamageType[];
}

/** Physical roads cut, crush or poison; abstract workings act as force or on the mind. */
export function harmOf(art: Technique | null | undefined, soul = false): BaseDamageType {
    if (soul) return 'psychic';
    if (art?.element === 'fire') return 'fire';
    if (art?.element === 'lightning') return 'lightning';
    if (art?.element === 'ice' || art?.element === 'water') return 'cold';
    if (art?.subjects.includes('weapon') || art?.element === 'metal') return 'slashing';
    if (art?.element === 'wood' || art?.subjects.includes('alchemy')) return 'poison';
    if (art?.element === 'earth' || art?.subjects.includes('body')) return 'bludgeoning';
    if (art?.subjects.includes('life_death')) return 'necrotic';
    return art ? 'force' : 'bludgeoning';
}

export function hasTribulationBody(ordinal: number): boolean { return ordinal >= BODY_FLOOR; }

export function imperfectBody(injuries: readonly Injury[]): boolean {
    return injuries.some(i => !i.treated && i.woundType === 'imperfect-tribulation-body');
}

export function maximumClosure(imperfect: boolean): number { return imperfect ? 0.45 : 0.8; }

/** Reduction is applied before learning this blow; every landed blow still costs at least one HP. */
export function defendWithBody(
    ordinal: number, imperfect: boolean, harm: BaseDamageType,
    slot: Adaptation
): { factor: number; next: Adaptation } {
    if (!hasTribulationBody(ordinal)) return { factor: 1, next: slot };
    const floor = ELEMENTAL.has(harm) ? 0.55 : 1;
    const factor = floor * (slot.key === harm ? 1 - slot.closed : 1);
    const recent = [...slot.recent, harm].slice(-5);
    const counts = new Map<BaseDamageType, number>();
    for (const key of recent) counts.set(key, (counts.get(key) ?? 0) + 1);
    const dominant = [...counts].sort((a, b) => b[1] - a[1])[0]!;
    let key = slot.key;
    let closed = slot.closed;
    if (key === dominant[0]) closed = Math.min(maximumClosure(imperfect), closed + (imperfect ? 0.1 : 0.2));
    else if (closed > 0) {
        closed = Math.max(0, closed - (imperfect ? 0.4 : 0.2));
        if (closed === 0) key = null;
    } else if (dominant[1] >= 2) {
        key = dominant[0];
        closed = imperfect ? 0.1 : 0.2;
    }
    return { factor, next: { key, closed, recent } };
}
