import {
    whatItWouldSpend,
    whetherTheVaultOpens,
    type HowTheWarGoes,
    type WhatItWouldBeFor
} from '../src/engine/world/what-a-house-opens-its-treasury-for.js';

const RANKS = 6;
const HOUSES = 2000;

function aHouse(n: number) {
    return [
        { id: `h${n}-head`, rankIndex: 5 },
        { id: `h${n}-elder-a`, rankIndex: 4 },
        { id: `h${n}-elder-b`, rankIndex: 4 },
        { id: `h${n}-elder-c`, rankIndex: 4 }
    ];
}

const hows: HowTheWarGoes[] = ['at_peace', 'at_war', 'about_to_lose'];
const whats: WhatItWouldBeFor[] = ['the_war', 'a_reward', 'arming_its_own'];

console.log('over ' + HOUSES + ' houses of four, a 1000-stone treasury\n');
for (const what of whats) {
    for (const how of hows) {
        let opened = 0;
        let spent = 0;
        let overruled = 0;
        for (let n = 0; n < HOUSES; n++) {
            const d = whetherTheVaultOpens({ what, how, roll: aHouse(n), rankCount: RANKS });
            if (d.opened) opened++;
            if (d.answer.settledBy !== 'the elders') overruled++;
            spent += whatItWouldSpend({ held: 1000, answer: d.answer });
        }
        console.log(
            what.padEnd(15),
            how.padEnd(14),
            'opens ' + (100 * opened / HOUSES).toFixed(1).padStart(5) + '%',
            ' mean spend ' + (spent / HOUSES).toFixed(0).padStart(4) + '/1000',
            ' not settled by the elders ' + (100 * overruled / HOUSES).toFixed(1) + '%'
        );
    }
    console.log('');
}
