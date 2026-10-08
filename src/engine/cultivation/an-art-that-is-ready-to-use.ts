/** Native art readiness and cooldown expenditure, shared by played and world bodies.
 * Separate fractional actions retain the existing zero whole-day burn; a held
 * iterator burns only the new whole days of its actual cumulative receipt. */
export interface AnArtUseInterval { previousElapsed: number; cumulativeElapsed: number }
export function effectiveArtCooldownDays(cumulativeElapsed:number,previousElapsed=0):number {
 return Math.floor(cumulativeElapsed)-Math.floor(previousElapsed);
}
export function artUseReadiness(art:{qiCost:number},cooldownRemaining:number,qi:number):
 {reason:'on_cooldown';remaining:number}|{reason:'insufficient_qi';required:number;held:number}|null {
 if(cooldownRemaining>0)return {reason:'on_cooldown',remaining:cooldownRemaining};
 if(qi<art.qiCost)return {reason:'insufficient_qi',required:art.qiCost,held:qi};
 return null;
}
