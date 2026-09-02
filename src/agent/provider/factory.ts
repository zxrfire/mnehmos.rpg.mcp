/**
 * Provider factory.
 *
 * Reads credentials from environment variables, instantiates providers,
 * and selects by name. Single source of truth for provider configuration.
 */

import { LLMProvider } from './types.js';
import { OpenAIProvider } from './openai.js';
import { OpenRouterProvider } from './openrouter.js';
import { AnthropicProvider } from './anthropic.js';
import { OllamaProvider } from './ollama.js';
import {
    ProviderName,
    describeProviderConfiguration,
    normalizeProviderName,
    RUNTIME_PROVIDER_ENV_VARS
} from './config.js';

// The canonical provider-name union lives in ./config.ts - the single place
// allowed to interpret a provider name. Re-exported here so existing importers
// of ProviderName keep working.
export type { ProviderName } from './config.js';

/**
 * An env var read as a boolean, or undefined when it was never set.
 *
 * Undefined is meaningful here rather than falsy: an absent `OLLAMA_THINK`
 * must leave the flag off the request body entirely, and only an explicit
 * value is passed on.
 */
function envFlag(raw: string | undefined): boolean | undefined {
    if (raw === undefined) return undefined;
    const v = raw.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'no') return false;
    return undefined;
}

export interface ProviderFactoryConfig {
    /** Anthropic API key. Read from ANTHROPIC_API_KEY if omitted. */
    anthropicApiKey?: string;
    anthropicBaseUrl?: string;
    /** Default Claude model. Read from ANTHROPIC_MODEL if omitted. */
    anthropicModel?: string;
    /** Ollama server base URL. Read from OLLAMA_BASE_URL if omitted. */
    ollamaBaseUrl?: string;
    /** Default local model. Read from OLLAMA_MODEL if omitted. */
    ollamaModel?: string;
    /**
     * Whether the local model reasons before answering. Read from OLLAMA_THINK
     * if omitted; unset means the flag is not sent at all. Set OLLAMA_THINK to
     * "false" on a thinking-tuned model, or its reasoning eats the completion
     * budget and the narration comes back empty. See `OllamaProviderConfig`.
     */
    ollamaThink?: boolean;
    /**
     * Force Ollama on/off. Ollama has no API key to gate on, so absent an
     * explicit value it is enabled whenever the operator has configured it -
     * see shouldEnableOllama().
     */
    ollamaEnabled?: boolean;
    /** OpenAI API key. Read from OPENAI_API_KEY if omitted. */
    openaiApiKey?: string;
    openaiBaseUrl?: string;
    openaiOrganization?: string;
    /** OpenRouter API key. Read from OPENROUTER_API_KEY if omitted. */
    openrouterApiKey?: string;
    openrouterBaseUrl?: string;
    /** Site URL OpenRouter uses for attribution. Read from OPENROUTER_REFERER if omitted. */
    openrouterReferer?: string;
    /** App title OpenRouter uses for attribution. Read from OPENROUTER_TITLE if omitted. */
    openrouterTitle?: string;
    /** Allow tests to inject a fetch impl into every provider. */
    fetchImpl?: typeof fetch;
}

export class ProviderFactory {
    private readonly providers: Map<ProviderName, LLMProvider> = new Map();
    private readonly config: ProviderFactoryConfig;

    constructor(config: ProviderFactoryConfig = {}) {
        this.config = config;
    }

    /**
     * Eagerly instantiate every provider that has credentials available.
     * Returns the list of provider names that were successfully configured.
     * Providers without keys are silently skipped - they'll throw clearly
     * if anyone tries to use them later.
     */
    initialize(): ProviderName[] {
        const anthropicKey = this.config.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY;
        if (anthropicKey) {
            this.providers.set('anthropic', new AnthropicProvider({
                apiKey: anthropicKey,
                baseUrl: this.config.anthropicBaseUrl ?? process.env.ANTHROPIC_BASE_URL,
                defaultModel: this.config.anthropicModel ?? process.env.ANTHROPIC_MODEL,
                fetchImpl: this.config.fetchImpl
            }));
        }

        // Ollama is local: there is no secret to check, so "configured" is the
        // gate instead of "credentialed". Gating it on a key would make the
        // self-hosted path unreachable by construction.
        if (this.shouldEnableOllama()) {
            this.providers.set('ollama', new OllamaProvider({
                baseUrl: this.config.ollamaBaseUrl ?? process.env.OLLAMA_BASE_URL,
                defaultModel: this.config.ollamaModel ?? process.env.OLLAMA_MODEL,
                think: this.config.ollamaThink ?? envFlag(process.env.OLLAMA_THINK),
                fetchImpl: this.config.fetchImpl
            }));
        }

        const openaiKey = this.config.openaiApiKey ?? process.env.OPENAI_API_KEY;
        if (openaiKey) {
            this.providers.set('openai', new OpenAIProvider({
                apiKey: openaiKey,
                baseUrl: this.config.openaiBaseUrl,
                organization: this.config.openaiOrganization,
                fetchImpl: this.config.fetchImpl
            }));
        }

        const openrouterKey = this.config.openrouterApiKey ?? process.env.OPENROUTER_API_KEY;
        if (openrouterKey) {
            this.providers.set('openrouter', new OpenRouterProvider({
                apiKey: openrouterKey,
                baseUrl: this.config.openrouterBaseUrl,
                referer: this.config.openrouterReferer ?? process.env.OPENROUTER_REFERER,
                title: this.config.openrouterTitle ?? process.env.OPENROUTER_TITLE,
                fetchImpl: this.config.fetchImpl
            }));
        }

        return Array.from(this.providers.keys());
    }

    /**
     * Ollama counts as configured when the operator has done anything that says
     * they want it: flipped it on explicitly, pointed at a server, named a local
     * model, or selected it as the runtime provider. An explicit `false` always
     * wins so a deployment can hard-disable it.
     */
    private shouldEnableOllama(): boolean {
        if (this.config.ollamaEnabled !== undefined) return this.config.ollamaEnabled;
        if (this.config.ollamaBaseUrl || this.config.ollamaModel) return true;
        if (process.env.OLLAMA_BASE_URL || process.env.OLLAMA_MODEL) return true;
        for (const envVar of RUNTIME_PROVIDER_ENV_VARS) {
            if (normalizeProviderName(process.env[envVar]) === 'ollama') return true;
        }
        return false;
    }

    /**
     * Return the configured provider, throwing a clear error if it isn't available.
     * Use this at agent_manage.create time to fail fast.
     */
    get(name: ProviderName): LLMProvider {
        const provider = this.providers.get(name);
        if (!provider) {
            throw new Error(
                `Provider '${name}' is not configured. ${describeProviderConfiguration(name)}`
            );
        }
        return provider;
    }

    /** Non-throwing variant - useful for health checks / readiness probes. */
    tryGet(name: ProviderName): LLMProvider | null {
        return this.providers.get(name) ?? null;
    }

    available(): ProviderName[] {
        return Array.from(this.providers.keys());
    }

    /** Register a pre-built provider (test fixtures, custom implementations). */
    register(name: ProviderName, provider: LLMProvider): void {
        this.providers.set(name, provider);
    }
}

// ─────────────────────────────────────────────────────────────────────────
// MODULE-LEVEL DEFAULT (mirrors setCombatPubSub pattern)
// Wire-up happens once at server startup in src/server/index.ts
// ─────────────────────────────────────────────────────────────────────────

let defaultFactory: ProviderFactory | null = null;

export function setProviderFactory(factory: ProviderFactory): void {
    defaultFactory = factory;
}

export function getProviderFactory(): ProviderFactory | null {
    return defaultFactory;
}

/** Reset (test cleanup). */
export function clearProviderFactory(): void {
    defaultFactory = null;
}
