import type { ProviderCapabilities } from '../types';

/**
 * AI Hub capabilities mirror Claude's — the provider delegates to the
 * Claude Code CLI subprocess, so all agentic features are available.
 */
export const AIHUB_CAPABILITIES: ProviderCapabilities = {
  sessionResume: true,
  mcp: true,
  hooks: true,
  skills: true,
  toolRestrictions: true,
  structuredOutput: true,
  envInjection: true,
  costControl: true,
  effortControl: true,
  thinkingControl: true,
  fallbackModel: true,
  sandbox: true,
};
