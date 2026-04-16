/**
 * Typed config parsing for AI Hub provider defaults.
 * Validates and narrows the opaque assistantConfig to typed fields.
 */
import type { AiHubProviderDefaults } from '../types';

// Re-export so consumers can import the type from either location
export type { AiHubProviderDefaults } from '../types';

/** Default AI Hub API endpoint. */
export const AIHUB_DEFAULT_BASE_URL = 'https://adesso-ai-hub.3asabc.de';

/** Default model when none specified. */
export const AIHUB_DEFAULT_MODEL = 'claude-sonnet-4-6';

/**
 * Parse raw assistantConfig into typed AI Hub defaults.
 * Defensive: invalid fields are silently dropped (not thrown).
 */
export function parseAiHubConfig(raw: Record<string, unknown>): AiHubProviderDefaults {
  const result: AiHubProviderDefaults = {};

  if (typeof raw.model === 'string') {
    result.model = raw.model;
  }

  if (typeof raw.apiKey === 'string') {
    result.apiKey = raw.apiKey;
  }

  if (typeof raw.sovereignApiKey === 'string') {
    result.sovereignApiKey = raw.sovereignApiKey;
  }

  if (typeof raw.baseUrl === 'string') {
    result.baseUrl = raw.baseUrl;
  }

  if (Array.isArray(raw.settingSources)) {
    const valid = raw.settingSources.filter(
      (s): s is 'project' | 'user' => s === 'project' || s === 'user'
    );
    if (valid.length > 0) {
      result.settingSources = valid;
    }
  }

  if (typeof raw.claudeBinaryPath === 'string') {
    result.claudeBinaryPath = raw.claudeBinaryPath;
  }

  return result;
}
