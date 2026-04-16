/**
 * AI Hub Provider — routes Claude models through adesso's AI Hub (LiteLLM proxy).
 *
 * Composition pattern: wraps ClaudeProvider and injects the required env vars
 * (ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY, CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS)
 * into every sendQuery call so the Claude Code CLI connects to AI Hub instead of
 * the Anthropic API directly.
 */
import type {
  IAgentProvider,
  MessageChunk,
  ProviderCapabilities,
  SendQueryOptions,
} from '../types';
import { ClaudeProvider } from '../claude/provider';
import { AIHUB_CAPABILITIES } from './capabilities';
import { parseAiHubConfig, AIHUB_DEFAULT_BASE_URL } from './config';
import { createLogger } from '@archon/paths';

/** Lazy-initialized logger */
let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('provider.aihub');
  return cachedLog;
}

/**
 * Resolve the API key for AI Hub.
 *
 * Priority:
 * 1. assistantConfig.apiKey (per-config explicit key)
 * 2. AIHUB_API_KEY env var (commercial)
 * 3. AIHUB_SOVEREIGN_KEY env var (sovereign / government)
 *
 * Returns undefined when no key is available (will be caught downstream).
 */
function resolveApiKey(assistantConfig?: Record<string, unknown>): string | undefined {
  const parsed = parseAiHubConfig(assistantConfig ?? {});
  return (
    parsed.apiKey ??
    process.env.AIHUB_API_KEY ??
    parsed.sovereignApiKey ??
    process.env.AIHUB_SOVEREIGN_KEY
  );
}

/**
 * Resolve the AI Hub base URL.
 * Config override > env var > default constant.
 */
function resolveBaseUrl(assistantConfig?: Record<string, unknown>): string {
  const parsed = parseAiHubConfig(assistantConfig ?? {});
  return parsed.baseUrl ?? process.env.AIHUB_BASE_URL ?? AIHUB_DEFAULT_BASE_URL;
}

export class AiHubProvider implements IAgentProvider {
  private readonly delegate: ClaudeProvider;

  constructor() {
    this.delegate = new ClaudeProvider();
  }

  getType(): string {
    return 'aihub';
  }

  getCapabilities(): ProviderCapabilities {
    return AIHUB_CAPABILITIES;
  }

  async *sendQuery(
    prompt: string,
    cwd: string,
    resumeSessionId?: string,
    requestOptions?: SendQueryOptions
  ): AsyncGenerator<MessageChunk> {
    const apiKey = resolveApiKey(requestOptions?.assistantConfig);
    if (!apiKey) {
      yield {
        type: 'result',
        isError: true,
        errorSubtype: 'auth',
        stopReason: 'error',
      };
      getLog().error('aihub.auth_failed — no API key. Set AIHUB_API_KEY or AIHUB_SOVEREIGN_KEY.');
      return;
    }

    const baseUrl = resolveBaseUrl(requestOptions?.assistantConfig);

    // Build the env overlay that redirects Claude Code CLI to AI Hub
    const aihubEnv: Record<string, string> = {
      ANTHROPIC_BASE_URL: baseUrl,
      ANTHROPIC_API_KEY: apiKey,
      // Disable experimental betas that AI Hub may not support yet
      CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1',
      // Force API key auth — global OAuth would bypass AI Hub and hit Anthropic directly
      CLAUDE_USE_GLOBAL_AUTH: 'false',
    };

    // Merge with any existing env from the request (aihub env takes precedence)
    const mergedEnv = {
      ...(requestOptions?.env ?? {}),
      ...aihubEnv,
    };

    // Delegate to ClaudeProvider with the injected env
    const delegatedOptions: SendQueryOptions = {
      ...requestOptions,
      env: mergedEnv,
    };

    getLog().debug({ baseUrl }, 'aihub.sendQuery_started');

    yield* this.delegate.sendQuery(prompt, cwd, resumeSessionId, delegatedOptions);
  }
}
