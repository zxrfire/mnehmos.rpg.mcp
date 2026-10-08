/** Real provider-owned inherited terminals are watch sites; a courier's counter is not a portal.
 * Board offers, exact post validation and ordinary NPC postings share this pure
 * projection. IDs carry stable location identity, never a display-name parser.
 */
import type { LocationRecord } from './locations.js';
import type { WorldState } from './world-state.js';
import { publicTransportHubsAt } from './public-transport-at-a-place.js';
import { counterPlaceNameAt } from './where-the-measured-span-still-answers.js';
type State = Pick<WorldState,'seed'|'locations'|'currentDay'>;
/** One observation/posting pass projects the provider sites once. */
export function publicWatchTargetsTogether(state: State): Map<string,LocationRecord[]> {
    const byHouse=new Map<string,LocationRecord[]>();
    for(const place of state.locations) {
        if(counterPlaceNameAt(place.name)===null)continue;
        for(const hub of publicTransportHubsAt(state,place.name,state.currentDay)) {
            if(!hub.providerHouseId || hub.inheritedTerminal!==true)continue;
            const sites=byHouse.get(hub.providerHouseId)??[];
            sites.push(place);byHouse.set(hub.providerHouseId,sites);
        }
    }
    for(const sites of byHouse.values())sites.sort((a,b)=>a.id.localeCompare(b.id));
    return byHouse;
}
export function publicWatchTargetsOf(state: State, houseId: string): LocationRecord[] {
    return publicWatchTargetsTogether(state).get(houseId)??[];
}
export function missionPostId(missionId: string, houseId: string, targetId?: string): string {
    return (targetId === undefined ? missionId : missionId+'~'+encodeURIComponent(targetId))+'@'+houseId;
}
export function targetInMissionPostId(entryId: string): string|null {
    const at=entryId.indexOf('@');
    if(at<1 || at!==entryId.lastIndexOf('@') || at===entryId.length-1)return null;
    const before=entryId.slice(0,at);
    const mark=before.indexOf('~');
    if(mark<1 || mark!==before.lastIndexOf('~') || mark===before.length-1)return null;
    try{return decodeURIComponent(before.slice(mark+1));}catch{return null;}
}
export function publicWatchTargetForPost(state: State, houseId: string, entryId: string): LocationRecord|null {
    if(!entryId.endsWith('@'+houseId))return null;
    const target=targetInMissionPostId(entryId);
    return target === null ? null : publicWatchTargetsOf(state,houseId).find(place=>place.id===target)??null;
}
