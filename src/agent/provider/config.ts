/**
 * Runtime provider configuration.
 *
 * ARCHITECTURAL CONTRACT (context.md — "Provider abstraction"):
 * This module is the ONLY place in the codebase that is allowed to interpret a
 * provider *name string*. Everything else — the engine, the MCP tools, the agent
 * runtime — takes an already-resolved `ProviderName` or asks this module for a
 * neutral fact about a provider (which env var configures it, what its default
 * model is). That is what keeps "no provider-specific logic in the game engine"
 * true as providers are added.
 *
 * Provider selection is CONFIGURATION, never code:
 *
 *     runtime_provider = claude
 *     runtime_provider = ollama
 *     ollama_model     = <model>
 *
 * Resolution precedence (highest wins):
 *   1. explicit argument (a caller that already knows, e.g. a stored agent row)
 *   2. environment       (RUNTIME_PROVIDER, then RPG_RUNTIME_PROVIDER)
 *   3. config file       (config/runtime.json — same `runtime_provider` keys)
 *   4. default           ('anthropic')
 *
 * The environment layer is where `.env` lands: src/server/index.ts loads the
 * project-root `.env` through dotenv before anything reads process.env, so an
 * operator setting `RUNTIME_PROVIDER=ollama` in `.env` is picked up here with
 * no extra plumbing.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

/** Every provider the runtime can construct. Canonical, lowercase, stable. */
export const PROVIDER_NAMES = ['anthropic', 'ollama', 'openai', 'openrouter'] as const;
export type ProviderName = typeof PROVIDER_NAMES[number];

/** The default when nothing is configured — Claude is the primary runtime agent. */
export const DEFAULT_PROVIDER: ProviderName = 'anthropic';

/**
 * Friendly aliases. `claude` is the name the design docs and players use; the
 * wire/vendor name is `anthropic`. Accepting both here means no other module
 * ever has to know they are the same thing.
 */
const PROVIDER_ALIASES: Readonly<Record<string, ProviderName>> = {
    anthropic: 'anthropic',
    claude: 'anthropic',
    ollama: 'ollama',
    openai: 'openai',
    openrouter: 'openrouter'
};

/**
 * The env var that configures each provider — used verbatim in "not configured"
 * errors so the operator is told exactly what to set. Ollama needs no secret, so
 * its configuration knob is its base URL rather than a key.
 */
export const PROVIDER_CONFIG_ENV: Readonly<Record<ProviderName, string>> = {
    anthropic: 'ANTHROPIC_API_KEY',
    ollama: 'OLLAMA_BASE_URL',
    openai: 'OPENAI_API_KEY',
    openrouter: 'OPENROUTER_API_KEY'
};

/** The ProviderFactory config field that overrides the env var above. */
export const PROVIDER_CONFIG_OPTION: Readonly<Record<ProviderName, string>> = {
    anthropic: 'anthropicApiKey',
    ollama: 'ollamaBaseUrl',
    openai: 'openaiApiKey',
    openrouter: 'openrouterApiKey'
};

/**
 * Whether the provider requires a secret before it can be used at all.
 * Ollama is self-hosted local inference: it is available as soon as it is
 * enabled, which is why initialize() must not gate it on a key.
 */
export const PROVIDER_REQUIRES_API_KEY: Readonly<Record<ProviderName, boolean>> = {
    anthropic: true,
    ollama: false,
    openai: true,
    openrouter: true
};

/** Env var carrying the model default for each provider. */
export const PROVIDER_MODEL_ENV: Readonly<Record<ProviderName, string>> = {
    anthropic: 'ANTHROPIC_MODEL',
    ollama: 'OLLAMA_MODEL',
    openai: 'OPENAI_MODEL',
    openrouter: 'OPENROUTER_MODEL'
};

/**
 * Model used when neither the caller, the env, nor the config file names one.
 * These are defaults, not policy — every one is overridable per agent row and
 * by the env vars above.
 */
export const PROVIDER_DEFAULT_MODEL: Readonly<Record<ProviderName, string>> = {
    anthropic: 'claude-opus-5',
    ollama: 'llama3.1',
    openai: 'gpt-4o-mini',
    openrouter: 'openai/gpt-4o-mini'
};

/** Env vars consulted for the active provider, in precedence order. */
export const RUNTIME_PROVIDER_ENV_VARS = ['RUNTIME_PROVIDER', 'RPG_RUNTIME_PROVIDER'] as const;

/** Where the optional config file lives, relative to the process working dir. */
export const RUNTIME_CONFIG_FILE = 'config/runtime.json';

/** Env var that relocates the config file (mirrors RPG_DATA_DIR's spirit). */
export const RUNTIME_CONFIG_PATH_ENV = 'RPG_RUNTIME_CONFIG';

/**
 * Shape of config/runtime.json. Keys deliberately use the snake_case spelling
 * from context.md so the file reads like the spec it implements.
 */
export interface RuntimeConfigFile {
    runtime_provider?: string;
    anthropic_model?: string;
    ollama_model?: string;
    openai_model?: string;
    openrouter_model?: string;
}

export type ConfigSource = 'argument' | 'environment' | 'config_file' | 'default';

export interface ResolvedRuntimeProviderConfig {
    /** The provider the runtime agent should use. Already validated. */
    provider: ProviderName;
    /** The model to use with that provider. Never empty. */
    model: string;
    /** Where `provider` came from — surfaced in diagnostics, never branched on. */
    providerSource: ConfigSource;
    /** Where `model` came from. */
    modelSource: ConfigSource;
    /** Env var an operator must set to configure this provider. */
    configEnvVar: string;
    /** False for local providers (Ollama) that need no secret. */
    requiresApiKey: boolean;
}

export interface RuntimeProviderConfigInput {
    /** Explicit choice — beats every other source. Accepts aliases. */
    provider?: string | null;
    /** Explicit model — beats every other source. */
    model?: string | null;
    /** Environment to read. Defaults to process.env; injectable for tests. */
    env?: Record<string, string | undefined>;
    /**
     * Parsed config file contents. `undefined` loads config/runtime.json from
     * disk; `null` means "there is no config file" (the test/no-IO path).
     */
    configFile?: RuntimeConfigFile | null;
}

/**
 * Normalize a user-supplied provider string to a canonical ProviderName.
 * Returns null for anything unrecognized — callers decide whether that is an
 * error or a fallback. Tolerates case, surrounding whitespace, and the
 * dash/underscore spellings people type ("open-router", "OPEN_ROUTER").
 */
export function normalizeProviderName(raw: string | null | undefined): ProviderName | null {
    if (typeof raw !== 'string') return null;
    const key = raw.trim().toLowerCase().replace(/[\s_-]+/g, '');
    return PROVIDER_ALIASES[key] ?? null;
}

/** Type guard for values that are already canonical provider names. */
export function isProviderName(value: unknown): value is ProviderName {
    return typeof value === 'string' && (PROVIDER_NAMES as readonly string[]).includes(value);
}

/**
 * Neutral accessor: the sentence to show an operator when a provider is not
 * configured. Lives here so no caller has to map a name to an env var itself.
 */
export function describeProviderConfiguration(name: ProviderName): string {
    const envVar = PROVIDER_CONFIG_ENV[name];
    const option = PROVIDER_CONFIG_OPTION[name];
    return PROVIDER_REQUIRES_API_KEY[name]
        ? `Set ${envVar} in the environment (or pass ${option} to ProviderFactory).`
        : `${name} runs locally and needs no API key — set ${envVar} in the environment `
        + `(or pass ${option} to ProviderFactory) to enable it, and make sure the server is running.`;
}

/**
 * Load config/runtime.json if it exists. A missing or malformed file is not an
 * error: the config file is the *lowest*-priority source, so an operator who
 * never creates one must still get a working default.
 */
export function loadRuntimeConfigFile(env: Record<string, string | undefined> = process.env): RuntimeConfigFile | null {
    const path = env[RUNTIME_CONFIG_PATH_ENV] ?? resolve(process.cwd(), RUNTIME_CONFIG_FILE);
    try {
        const parsed: unknown = JSON.parse(readFileSync(path, 'utf-8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        return parsed as RuntimeConfigFile;
    } catch {
        // Missing file, unreadable file, or bad JSON — all mean "no config file".
        return null;
    }
}

function readEnvProvider(env: Record<string, string | undefined>): { raw: string; envVar: string } | null {
    for (const envVar of RUNTIME_PROVIDER_ENV_VARS) {
        const raw = env[envVar];
        if (typeof raw === 'string' && raw.trim() !== '') return { raw, envVar };
    }
    return null;
}

function coerceProvider(raw: string, origin: string): ProviderName {
    const name = normalizeProviderName(raw);
    if (!name) {
        throw new Error(
            `Unknown runtime provider '${raw}' (from ${origin}). `
            + `Valid values: ${PROVIDER_NAMES.join(', ')} (alias: 'claude' = 'anthropic').`
        );
    }
    return name;
}

function nonEmpty(value: unknown): string | null {
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Resolve the active runtime provider and its model.
 *
 * Throws on an explicitly-configured but unrecognized provider name — a typo in
 * `RUNTIME_PROVIDER` should fail loudly at startup, not silently fall back to a
 * different (possibly paid) provider than the operator asked for.
 */
export function resolveRuntimeProviderConfig(
    input: RuntimeProviderConfigInput = {}
): ResolvedRuntimeProviderConfig {
    const env = input.env ?? process.env;
    const configFile = input.configFile === undefined ? loadRuntimeConfigFile(env) : input.configFile;

    // ── provider ──────────────────────────────────────────────────────────
    let provider: ProviderName = DEFAULT_PROVIDER;
    let providerSource: ConfigSource = 'default';

    const argProvider = nonEmpty(input.provider);
    const envProvider = readEnvProvider(env);
    const fileProvider = nonEmpty(configFile?.runtime_provider);

    if (argProvider) {
        provider = coerceProvider(argProvider, 'explicit argument');
        providerSource = 'argument';
    } else if (envProvider) {
        provider = coerceProvider(envProvider.raw, envProvider.envVar);
        providerSource = 'environment';
    } else if (fileProvider) {
        provider = coerceProvider(fileProvider, RUNTIME_CONFIG_FILE);
        providerSource = 'config_file';
    }

    // ── model (per-provider, same precedence ladder) ──────────────────────
    let model = PROVIDER_DEFAULT_MODEL[provider];
    let modelSource: ConfigSource = 'default';

    const argModel = nonEmpty(input.model);
    const envModel = nonEmpty(env[PROVIDER_MODEL_ENV[provider]]);
    const fileModel = nonEmpty(configFile?.[`${provider}_model` as keyof RuntimeConfigFile]);

    if (argModel) {
        model = argModel;
        modelSource = 'argument';
    } else if (envModel) {
        model = envModel;
        modelSource = 'environment';
    } else if (fileModel) {
        model = fileModel;
        modelSource = 'config_file';
    }

    return {
        provider,
        model,
        providerSource,
        modelSource,
        configEnvVar: PROVIDER_CONFIG_ENV[provider],
        requiresApiKey: PROVIDER_REQUIRES_API_KEY[provider]
    };
}
