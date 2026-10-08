/** The authored role, not its level or ownership, supplies a combat working.
 * Defensive arts retain the existing confrontation projection; a damage-bearing
 * working (including forbidden work) remains offensive. A partner ritual,
 * gathering manual or noncombat service is not secretly cast with a punch. */
import type {Technique} from '../../schema/cultivation.js';
export function anArtThatCanBeUsedInAFight(art:Pick<Technique,'category'|'damage'>):boolean {
 return art.category==='attack'||art.category==='defense'||art.damage!==null;
}
