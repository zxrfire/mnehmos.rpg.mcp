/** The accepted clock prices a partial edge; later quotes cannot round it anew. */
import { continuationOfAdmittedRoad,type AdmittedRoadCourse } from './road-course.js';

export function admittedRoadWalkingPace(original:{walkingDays:number;departureDay:number;arrivalDay:number},
 current:{departureDay:number;arrivalDay:number;admittedRoad?:AdmittedRoadCourse},day:number):number|null {
 const walking=original.walkingDays;
 if(!walking||walking<=0)return null;
 const held=current.admittedRoad,total=current.arrivalDay-current.departureDay;
 const admitted=held?continuationOfAdmittedRoad(held):null;
 const pace=held&&admitted
  ? day-current.departureDay<held.initialTravelDays&&admitted.partialDays>0
   ? held.initialTravelDays/admitted.partialDays
   : (total-held.initialTravelDays)/(held.route.at(-1)?.days??0)
  : (original.arrivalDay-original.departureDay)/walking;
 return Number.isFinite(pace)&&pace>0?pace:null;
}
