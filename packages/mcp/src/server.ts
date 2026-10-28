// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco / CogniVault / ClearRun
//
// Stdio MCP server. Every score comes from the hosted ClearRun API via
// @clearrun/sdk (createKernelClient / HostedApiClient). No key, no call.
// MockKernelClient is never selected.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createKernelClient, HostedApiError, type FetchLike, type HonestyKernelClient } from '@clearrun/sdk';
import { MISSING_KEY_MESSAGE, presentApiResult, redactSecret } from './present.js';

export const SERVER_NAME = 'clearrun';
export const SERVER_VERSION = '0.1.1';

export const HONESTY_NOTE =
  'ClearRun scores honesty, meaning whether an answer\'s confidence is backed by its reasoning. It is not a fact-checker. A high score does not mean the answer is true.';

export const TOOL_NAMES = ['clearrun_score', 'clearrun_evaluate', 'clearrun_chat', 'clearrun_verify'] as const;

export interface ClearRunMcpOptions {
  /** Configured key. Used instead of CLEARRUN_API_KEY when set. */
  apiKey?: string;
  /** Hosted API base URL. Defaults to https://api.clearrun.net inside the SDK. */
  baseUrl?: string;
  /** Environment to read CLEARRUN_API_KEY from. Defaults to process.env. */
  env?: NodeJS.ProcessEnv;
  /** Injectable fetch for tests. Production uses the SDK default. */
  fetch?: FetchLike;
}

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

function resolveApiKey(options: ClearRunMcpOptions): string {
  const configured = options.apiKey?.trim() ?? '';
  if (configured) return configured;
  const env = options.env ?? process.env;
  return (env.CLEARRUN_API_KEY ?? '').trim();
}

function toolError(message: string): ToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  };
}

function toolOk(payload: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

function formatFailure(err: unknown, apiKey: string): string {
  let text: string;
  if (err instanceof HostedApiError) {
    text = `ClearRun API returned ${err.status}: ${err.message}`;
  } else if (err instanceof Error) {
    text = err.message;
  } else {
    text = 'ClearRun API request failed';
  }
  return redactSecret(text, apiKey);
}

function clientFor(options: ClearRunMcpOptions, apiKey: string): HonestyKernelClient {
  return createKernelClient({
    hosted: {
      apiKey,
      baseUrl: options.baseUrl,
    },
    deps: options.fetch ? { fetch: options.fetch } : undefined,
  });
}

async function runHosted(
  options: ClearRunMcpOptions,
  call: (client: HonestyKernelClient) => Promise<unknown>
): Promise<ToolResult> {
  const apiKey = resolveApiKey(options);
  if (!apiKey) return toolError(MISSING_KEY_MESSAGE);
  try {
    const data = await call(clientFor(options, apiKey));
    return toolOk(presentApiResult(data));
  } catch (err) {
    return toolError(formatFailure(err, apiKey));
  }
}

export function createClearRunServer(options: ClearRunMcpOptions = {}): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  server.registerTool(
    'clearrun_score',
    {
      title: 'Score text for honesty',
      description:
        'Score text that was already written. ' +
        HONESTY_NOTE +
        ' Calls POST /api/score on the hosted ClearRun API. Returns the score, verdict, and scoring version when the API includes them. A receipt is included only when the API sends one.',
      inputSchema: {
        responseText: z.string().min(1).describe('The AI answer, or other text, to score for honesty.'),
        modelId: z.string().min(1).optional().describe('Optional model id to send with the text.'),
      },
    },
    async ({ responseText, modelId }) =>
      runHosted(options, (client) => client.score({ responseText, modelId }))
  );

  server.registerTool(
    'clearrun_evaluate',
    {
      title: 'Evaluate an existing answer',
      description:
        'Score an existing AI answer, including the prompt that produced it when you have it. ' +
        HONESTY_NOTE +
        ' Calls POST /api/evaluate on the hosted ClearRun API. Returns the score, verdict, and scoring version when the API includes them. A receipt is included only when the API sends one.',
      inputSchema: {
        responseText: z.string().min(1).describe('The AI answer to score for honesty.'),
        prompt: z.string().min(1).optional().describe('The prompt that produced the answer, when you have it.'),
        modelId: z.string().min(1).optional().describe('Optional model id to send with the answer.'),
        sessionId: z.string().min(1).optional().describe('Optional session id to send to the API.'),
      },
    },
    async ({ responseText, prompt, modelId, sessionId }) =>
      runHosted(options, (client) => client.evaluate({ responseText, prompt, modelId, sessionId }))
  );

  server.registerTool(
    'clearrun_chat',
    {
      title: 'Generate an answer and score it',
      description:
        'Send a message to the hosted ClearRun API, which generates an answer and scores it. ' +
        HONESTY_NOTE +
        ' Calls POST /api/chat. Returns the answer text plus the score, verdict, and scoring version when the API includes them. A receipt is included only when the API sends one.',
      inputSchema: {
        message: z.string().min(1).describe('The user message to send to the hosted API.'),
        modelId: z.string().min(1).optional().describe('Optional model id to send with the message.'),
        sessionId: z.string().min(1).optional().describe('Optional session id to send to the API.'),
      },
    },
    async ({ message, modelId, sessionId }) =>
      runHosted(options, (client) => client.chat({ message, modelId, sessionId }))
  );

  server.registerTool(
    'clearrun_verify',
    {
      title: 'Verify a verdict id',
      description:
        'Look up a ClearRun verdict id on the public verification endpoint (GET /api/verify/{verdictId}). ' +
        HONESTY_NOTE +
        ' Returns the verification result the API returns, including the verdict when the API includes one. A receipt is included only when the API sends one.',
      inputSchema: {
        verdictId: z.string().min(1).describe('The verdict id to look up.'),
      },
    },
    async ({ verdictId }) => runHosted(options, (client) => client.verify({ verdictId }))
  );

  return server;
}
