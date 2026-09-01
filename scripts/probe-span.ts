/** How much ladder does one manual actually cover? */
import { TECHNIQUES } from '../src/data/cultivation/techniques.js';
const roads = (TECHNIQUES as any[])
    .filter(t => t.class === 'cultivation' && t.cap != null)
    .map(t => ({ name: t.name, need: Number(t.requiredOrdinal ?? 0), cap: Number(t.cap), grade: t.grade }))
    .sort((a, b) => (a.cap - a.need) - (b.cap - b.need));
console.log('span  from  to   grade      manual');
for (const r of roads) {
    console.log(String(r.cap - r.need).padStart(4) + String(r.need).padStart(6)
        + String(r.cap).padStart(5) + '   ' + String(r.grade).padEnd(9) + '  ' + r.name);
}
const spans = roads.map(r => r.cap - r.need);
console.log(`\n${roads.length} cultivation manuals in the catalog`);
console.log(`span: min ${Math.min(...spans)}, max ${Math.max(...spans)}, `
    + `distinct spans ${new Set(spans).size}`);
const byGrade = new Map<string, number[]>();
for (const r of roads) {
    const g = String(r.grade);
    if (!byGrade.has(g)) byGrade.set(g, []);
    byGrade.get(g)!.push(r.cap - r.need);
}
for (const [g, s] of byGrade) {
    console.log(`  ${g.padEnd(9)} n=${String(s.length).padStart(2)}  spans ${s.sort((a,b)=>a-b).join(', ')}`);
}
