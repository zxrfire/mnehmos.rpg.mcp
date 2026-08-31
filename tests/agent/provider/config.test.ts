import {
    resolveRuntimeProviderConfig,
    normalizeProviderName,
    isProviderName,
    describeProviderConfiguration,
    loadRuntimeConfigFile,
    PROVIDER_NAMES,
    PROVIDER_DEFAULT_MODEL,
    DEFAULT_PROVIDER,
    RUNTIME_CONFIG_PATH_ENV
} from '../../../src/agent/provider/config.js';

/** Every resolution test injects its own env - never the process environment. */
const EMPTY_ENV: Record<string, string | undefined> = {};

function resolve(input: Parameters<typeof resolveRuntimeProviderConfig>[0] = {}) {
    // configFile: null keeps the resolver off the filesystem unless a test
    // explicitly exercises the config-file layer.
    return resolveRuntimeProviderConfig({ env: EMPTY_ENV, configFile: null, ...input });
}

describe('normalizeProviderName', () => {
    it('accepts every canonical name', () => {
        for (const name of PROVIDER_NAMES) {
            expect(normalizeProviderName(name)).toBe(name);
        }
    });

    it('treats "claude" as an alias for anthropic', () => {
        expect(normalizeProviderName('claude')).toBe('anthropic');
        expect(normalizeProviderName('Claude')).toBe('anthropic');
        expect(normalizeProviderName('  CLAUDE  ')).toBe('anthropic');
    });

    it('tolerates dash/underscore/case spellings', () => {
        expect(normalizeProviderName('OpenRouter')).toBe('openrouter');
        expect(normalizeProviderName('open-router')).toBe('openrouter');
        expect(normalizeProviderName('OPEN_ROUTER')).toBe('openrouter');
    });

    it('returns null for unknown or non-string input', () => {
        expect(normalizeProviderName('gemini')).toBeNull();
        expect(normalizeProviderName('')).toBeNull();
        expect(normalizeProviderName(null)).toBeNull();
        expect(normalizeProviderName(undefined)).toBeNull();
    });
});

describe('isProviderName', () => {
    it('accepts canonical names only - not aliases', () => {
        expect(isProviderName('anthropic')).toBe(true);
        expect(isProviderName('ollama')).toBe(true);
        expect(isProviderName('claude')).toBe(false);
        expect(isProviderName(42)).toBe(false);
    });
});

describe('resolveRuntimeProviderConfig - precedence', () => {
    it('defaults to anthropic with its default model', () => {
        const resolved = resolve();
        expect(resolved.provider).toBe('anthropic');
        expect(resolved.provider).toBe(DEFAULT_PROVIDER);
        expect(resolved.model).toBe(PROVIDER_DEFAULT_MODEL.anthropic);
        expect(resolved.providerSource).toBe('default');
        expect(resolved.modelSource).toBe('default');
    });

    it('reads RUNTIME_PROVIDER from the environment', () => {
        const resolved = resolve({ env: { RUNTIME_PROVIDER: 'ollama' } });
        expect(resolved.provider).toBe('ollama');
        expect(resolved.providerSource).toBe('environment');
        expect(resolved.model).toBe(PROVIDER_DEFAULT_MODEL.ollama);
    });

    it('falls back to RPG_RUNTIME_PROVIDER when RUNTIME_PROVIDER is absent', () => {
        const resolved = resolve({ env: { RPG_RUNTIME_PROVIDER: 'openrouter' } });
        expect(resolved.provider).toBe('openrouter');
        expect(resolved.providerSource).toBe('environment');
    });

    it('prefers RUNTIME_PROVIDER over RPG_RUNTIME_PROVIDER', () => {
        const resolved = resolve({
            env: { RUNTIME_PROVIDER: 'ollama', RPG_RUNTIME_PROVIDER: 'openai' }
        });
        expect(resolved.provider).toBe('ollama');
    });

    it('accepts the claude alias from the environment', () => {
        const resolved = resolve({ env: { RUNTIME_PROVIDER: 'claude' } });
        expect(resolved.provider).toBe('anthropic');
        expect(resolved.providerSource).toBe('environment');
    });

    it('lets an explicit argument beat the environment', () => {
        const resolved = resolve({ provider: 'claude', env: { RUNTIME_PROVIDER: 'ollama' } });
        expect(resolved.provider).toBe('anthropic');
        expect(resolved.providerSource).toBe('argument');
    });

    it('reads the config file when neither argument nor env sets a provider', () => {
        const resolved = resolve({ configFile: { runtime_provider: 'claude' } });
        expect(resolved.provider).toBe('anthropic');
        expect(resolved.providerSource).toBe('config_file');
    });

    it('lets the environment beat the config file', () => {
        const resolved = resolve({
            env: { RUNTIME_PROVIDER: 'ollama' },
            configFile: { runtime_provider: 'openai' }
        });
        expect(resolved.provider).toBe('ollama');
        expect(resolved.providerSource).toBe('environment');
    });

    it('applies the full ladder: argument > env > file > default', () => {
        const env = { RUNTIME_PROVIDER: 'openai' };
        const configFile = { runtime_provider: 'openrouter' };

        expect(resolve({ provider: 'ollama', env, configFile }).provider).toBe('ollama');
        expect(resolve({ env, configFile }).provider).toBe('openai');
        expect(resolve({ configFile }).provider).toBe('openrouter');
        expect(resolve({}).provider).toBe('anthropic');
    });

    it('ignores blank/whitespace-only configuration values', () => {
        const resolved = resolve({ provider: '   ', env: { RUNTIME_PROVIDER: '  ' } });
        expect(resolved.provider).toBe('anthropic');
        expect(resolved.providerSource).toBe('default');
    });

    it('throws a listing error on an unknown provider name', () => {
        expect(() => resolve({ env: { RUNTIME_PROVIDER: 'gemini' } }))
            .toThrow(/Unknown runtime provider 'gemini'[\s\S]*RUNTIME_PROVIDER/);
        expect(() => resolve({ provider: 'gpt' })).toThrow(/anthropic, ollama, openai, openrouter/);
    });
});

describe('resolveRuntimeProviderConfig - model resolution', () => {
    it('resolves OLLAMA_MODEL for the ollama provider', () => {
        const resolved = resolve({ env: { RUNTIME_PROVIDER: 'ollama', OLLAMA_MODEL: 'qwen3:8b' } });
        expect(resolved.provider).toBe('ollama');
        expect(resolved.model).toBe('qwen3:8b');
        expect(resolved.modelSource).toBe('environment');
    });

    it('resolves ANTHROPIC_MODEL for the anthropic provider', () => {
        const resolved = resolve({ env: { ANTHROPIC_MODEL: 'claude-sonnet-5' } });
        expect(resolved.model).toBe('claude-sonnet-5');
        expect(resolved.modelSource).toBe('environment');
    });

    it('only honors the model env var of the ACTIVE provider', () => {
        // OLLAMA_MODEL must not leak into a Claude run.
        const resolved = resolve({ env: { RUNTIME_PROVIDER: 'claude', OLLAMA_MODEL: 'qwen3:8b' } });
        expect(resolved.provider).toBe('anthropic');
        expect(resolved.model).toBe(PROVIDER_DEFAULT_MODEL.anthropic);
    });

    it('reads ollama_model from the config file', () => {
        const resolved = resolve({
            configFile: { runtime_provider: 'ollama', ollama_model: 'mistral' }
        });
        expect(resolved.model).toBe('mistral');
        expect(resolved.modelSource).toBe('config_file');
    });

    it('lets an explicit model argument beat env and file', () => {
        const resolved = resolve({
            model: 'claude-opus-4-8',
            env: { ANTHROPIC_MODEL: 'claude-sonnet-5' },
            configFile: { anthropic_model: 'claude-haiku-4-5' }
        });
        expect(resolved.model).toBe('claude-opus-4-8');
        expect(resolved.modelSource).toBe('argument');
    });

    it('lets the env model beat the config-file model', () => {
        const resolved = resolve({
            env: { ANTHROPIC_MODEL: 'claude-sonnet-5' },
            configFile: { anthropic_model: 'claude-haiku-4-5' }
        });
        expect(resolved.model).toBe('claude-sonnet-5');
        expect(resolved.modelSource).toBe('environment');
    });
});

describe('resolveRuntimeProviderConfig - credential metadata', () => {
    it('names the env var and key requirement for hosted providers', () => {
        const resolved = resolve({ provider: 'claude' });
        expect(resolved.configEnvVar).toBe('ANTHROPIC_API_KEY');
        expect(resolved.requiresApiKey).toBe(true);
    });

    it('marks ollama as needing no API key', () => {
        const resolved = resolve({ provider: 'ollama' });
        expect(resolved.configEnvVar).toBe('OLLAMA_BASE_URL');
        expect(resolved.requiresApiKey).toBe(false);
    });
});

describe('describeProviderConfiguration', () => {
    it('tells the operator which env var to set', () => {
        expect(describeProviderConfiguration('anthropic')).toMatch(/ANTHROPIC_API_KEY/);
        expect(describeProviderConfiguration('openai')).toMatch(/OPENAI_API_KEY/);
        expect(describeProviderConfiguration('openrouter')).toMatch(/OPENROUTER_API_KEY/);
    });

    it('explains that ollama needs no key but does need a running server', () => {
        const message = describeProviderConfiguration('ollama');
        expect(message).toMatch(/no API key/);
        expect(message).toMatch(/OLLAMA_BASE_URL/);
        expect(message).toMatch(/server is running/);
    });
});

describe('loadRuntimeConfigFile', () => {
    it('returns null when the configured path does not exist', () => {
        expect(loadRuntimeConfigFile({ [RUNTIME_CONFIG_PATH_ENV]: 'no/such/runtime.json' })).toBeNull();
    });

    it('falls back to defaults when the config file is unreadable', () => {
        // A broken config file must never take the runtime down - it is the
        // lowest-priority source, so "unreadable" and "absent" mean the same thing.
        const resolved = resolveRuntimeProviderConfig({
            env: { [RUNTIME_CONFIG_PATH_ENV]: 'no/such/runtime.json' }
        });
        expect(resolved.provider).toBe('anthropic');
        expect(resolved.providerSource).toBe('default');
    });
});
