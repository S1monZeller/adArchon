import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { createMockLogger } from '../test/mocks/logger';

const mockLogger = createMockLogger();
mock.module('@archon/paths', () => ({
  createLogger: mock(() => mockLogger),
}));

// Create mock query function
const mockQuery = mock(async function* () {
  yield {
    type: 'message',
    message: { role: 'assistant', content: [{ type: 'text', text: 'hello from aihub' }] },
  };
});

// Mock the claude-agent-sdk (AiHubProvider delegates to ClaudeProvider which uses this)
mock.module('@anthropic-ai/claude-agent-sdk', () => ({
  query: mockQuery,
}));

import { AiHubProvider } from './provider';
import { AIHUB_CAPABILITIES } from './capabilities';
import { parseAiHubConfig, AIHUB_DEFAULT_BASE_URL, AIHUB_DEFAULT_MODEL } from './config';

describe('AiHubProvider', () => {
  let provider: AiHubProvider;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    provider = new AiHubProvider();
    mockQuery.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();

    // Clean up env vars between tests
    delete process.env.AIHUB_API_KEY;
    delete process.env.AIHUB_SOVEREIGN_KEY;
    delete process.env.AIHUB_BASE_URL;
  });

  describe('getType', () => {
    test('returns aihub', () => {
      expect(provider.getType()).toBe('aihub');
    });
  });

  describe('getCapabilities', () => {
    test('returns AIHUB_CAPABILITIES', () => {
      expect(provider.getCapabilities()).toEqual(AIHUB_CAPABILITIES);
    });

    test('mirrors Claude capabilities (all true)', () => {
      const caps = provider.getCapabilities();
      expect(caps.mcp).toBe(true);
      expect(caps.hooks).toBe(true);
      expect(caps.skills).toBe(true);
      expect(caps.sessionResume).toBe(true);
      expect(caps.envInjection).toBe(true);
      expect(caps.structuredOutput).toBe(true);
    });
  });

  describe('sendQuery', () => {
    test('yields error when no API key is available', async () => {
      const gen = provider.sendQuery('hello', '/tmp');
      const result = await gen.next();

      expect(result.done).toBe(false);
      expect(result.value).toEqual({
        type: 'result',
        isError: true,
        errorSubtype: 'auth',
        stopReason: 'error',
      });

      // Should be done after error
      const next = await gen.next();
      expect(next.done).toBe(true);
    });

    test('uses AIHUB_API_KEY from env', async () => {
      process.env.AIHUB_API_KEY = 'test-commercial-key';

      const gen = provider.sendQuery('hello', '/tmp');
      // Consume the generator
      const chunks = [];
      for await (const chunk of gen) {
        chunks.push(chunk);
      }

      // Should have called the delegate (mockQuery was invoked)
      expect(mockQuery).toHaveBeenCalled();
    });

    test('uses AIHUB_SOVEREIGN_KEY from env as fallback', async () => {
      process.env.AIHUB_SOVEREIGN_KEY = 'test-sovereign-key';

      const gen = provider.sendQuery('hello', '/tmp');
      const chunks = [];
      for await (const chunk of gen) {
        chunks.push(chunk);
      }

      expect(mockQuery).toHaveBeenCalled();
    });

    test('prefers assistantConfig apiKey over env vars', async () => {
      process.env.AIHUB_API_KEY = 'env-key';

      const gen = provider.sendQuery('hello', '/tmp', undefined, {
        assistantConfig: { apiKey: 'config-key' },
      });
      const chunks = [];
      for await (const chunk of gen) {
        chunks.push(chunk);
      }

      expect(mockQuery).toHaveBeenCalled();
      // The first call's first arg should contain prompt
      const callArgs = mockQuery.mock.calls[0][0] as Record<string, unknown>;
      expect(callArgs.prompt).toBe('hello');
    });
  });
});

describe('parseAiHubConfig', () => {
  test('parses empty config', () => {
    expect(parseAiHubConfig({})).toEqual({});
  });

  test('parses model', () => {
    const result = parseAiHubConfig({ model: 'claude-opus-4' });
    expect(result.model).toBe('claude-opus-4');
  });

  test('parses apiKey', () => {
    const result = parseAiHubConfig({ apiKey: 'my-key' });
    expect(result.apiKey).toBe('my-key');
  });

  test('parses sovereignApiKey', () => {
    const result = parseAiHubConfig({ sovereignApiKey: 'sovereign-key' });
    expect(result.sovereignApiKey).toBe('sovereign-key');
  });

  test('parses baseUrl', () => {
    const result = parseAiHubConfig({ baseUrl: 'https://custom.endpoint.de' });
    expect(result.baseUrl).toBe('https://custom.endpoint.de');
  });

  test('parses settingSources', () => {
    const result = parseAiHubConfig({ settingSources: ['project', 'user'] });
    expect(result.settingSources).toEqual(['project', 'user']);
  });

  test('drops invalid settingSources entries', () => {
    const result = parseAiHubConfig({ settingSources: ['project', 'invalid', 'user'] });
    expect(result.settingSources).toEqual(['project', 'user']);
  });

  test('drops non-string fields', () => {
    const result = parseAiHubConfig({ model: 123, apiKey: true, baseUrl: null });
    expect(result).toEqual({});
  });
});

describe('constants', () => {
  test('AIHUB_DEFAULT_BASE_URL is correct', () => {
    expect(AIHUB_DEFAULT_BASE_URL).toBe('https://adesso-ai-hub.3asabc.de');
  });

  test('AIHUB_DEFAULT_MODEL is correct', () => {
    expect(AIHUB_DEFAULT_MODEL).toBe('claude-sonnet-4-6');
  });
});
