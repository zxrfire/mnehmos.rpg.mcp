/**
 * How far sound travels, off volume, biome and atmospherics. Older substrate:
 * deliberately not re-exported from `index.js`.
 */

import { BiomeType, Atmospheric } from '../../schema/spatial.js';

export type VolumeLevel = 'WHISPER' | 'TALK' | 'SHOUT';

export interface HearingRangeConfig {
    volume: VolumeLevel;
    biomeContext: BiomeType;
    atmospherics: Atmospheric[];
}

/** Base hearing ranges by biome, in feet. Noise shortens, open air carries. */
const BASE_HEARING_RANGES: Record<BiomeType, { WHISPER: number; TALK: number; SHOUT: number }> = {
    urban: {
        WHISPER: 5,    // Crowded tavern, market chatter
        TALK: 15,      // Need to speak up
        SHOUT: 40      // Cuts through noise
    },

    forest: {
        WHISPER: 10,   // Birds, wind, but mostly quiet
        TALK: 60,      // Sound carries well
        SHOUT: 300     // Echo through trees
    },
    mountain: {
        WHISPER: 15,   // Thin air, less interference
        TALK: 100,     // Wide open spaces
        SHOUT: 500     // Mountain echo
    },
    coastal: {
        WHISPER: 5,    // Crashing waves drown it out
        TALK: 30,      // Have to compete with ocean
        SHOUT: 150     // Carries over water
    },

    dungeon: {
        WHISPER: 10,   // Stone echoes whispers
        TALK: 40,      // Moderate echo
        SHOUT: 120     // Loud echo down corridors
    },
    cavern: {
        WHISPER: 15,   // Huge echo chamber
        TALK: 80,      // Sound bounces everywhere
        SHOUT: 400     // Massive echo
    },

    divine: {
        WHISPER: 10,   // Sacred silence
        TALK: 50,      // Reverent acoustics
        SHOUT: 200     // Booming temple voice
    },
    arcane: {
        WHISPER: 8,    // Magic dampens sound slightly
        TALK: 40,      // Unpredictable acoustics
        SHOUT: 180     // Magical amplification
    }
};

/** How far sound travels, in feet. */
export function calculateHearingRadius(config: HearingRangeConfig): number {
    let range = BASE_HEARING_RANGES[config.biomeContext][config.volume];

    if (config.atmospherics.includes('SILENCE')) {
        range = Math.floor(range * 0.5);
    }

    // DARKNESS, FOG, ANTIMAGIC and MAGICAL are deliberately left alone: none of
    // them touch natural hearing.

    return range;
}

export function canHearAtDistance(distance: number, hearingRadius: number): boolean {
    return distance <= hearingRadius;
}

/**
 * Feet ADDED to the real distance when a wall is in the way, not subtracted
 * from the radius. Whispers get a penalty large enough to never carry.
 */
export function getAdjacentRoomPenalty(volume: VolumeLevel): number {
    switch (volume) {
        case 'WHISPER':
            return 999; // Effectively blocks whispers
        case 'TALK':
            return 30;  // Adds 30ft effective distance
        case 'SHOUT':
            return 10;  // Shouts penetrate walls better
    }
}

/** Hearing quality as a word, for flavour text in conversation memories. */
export function getHearingQuality(distance: number, hearingRadius: number): string {
    const ratio = distance / hearingRadius;

    if (ratio <= 0.25) {
        return 'clearly';
    } else if (ratio <= 0.5) {
        return 'distinctly';
    } else if (ratio <= 0.75) {
        return 'faintly';
    } else {
        return 'barely';
    }
}
