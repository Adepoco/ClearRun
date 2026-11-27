// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Adepoco / CogniVault / ClearRun
//
// Stdio MCP server. Every score comes from the hosted ClearRun API via
// @clearrun/sdk (createKernelClient / HostedApiClient). No key, no call.
// MockKernelClient is never selected.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createKernelClient,
  createVerifyClient,
  HostedApiError,
  resolveClearRunApiKey,
  type FetchLike,
  type HonestyKernelClient,
} from '@clearrun/sdk';
import {
  MISSING_KEY_MESSAGE,
  presentHostedCall,
  redactSecret,
  type HostedTool,
} from './present.js';

export const SERVER_NAME = 'clearrun';
export const SERVER_VERSION = '1.2.1';

export const HONESTY_NOTE =
  'ClearRun scores whether an answer\'s confidence is backed by its reasoning, from 0 to 100. It does not check facts. A high score does not mean the answer is true.';

/** Hosted score, evaluate, and chat calls spend credits and store a verdict. */
const HOSTED_CALL_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;

/** Public verdict lookup. Repeating an id reads the same stored result. */
const VERIFY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export const TOOL_NAMES = ['clearrun_score', 'clearrun_evaluate', 'clearrun_chat', 'clearrun_verify'] as const;

export interface ClearRunMcpOptions {
  /** Configured key. Used instead of CLEARRUN_API_KEY when set. */
  apiKey?: string;
  /** Hosted API base URL. Defaults to https://api.clearrun.net inside the SDK. */
  baseUrl?: string;
  /** Environment to read CLEARRUN_API_KEY and the CLI config path from. Defaults to process.env. */
  env?: NodeJS.ProcessEnv;
  /** Override the CLI config path (~/.config/clearrun/config.json). Used by tests. */
  configPath?: string;
  /** Injectable fetch for tests. Production uses the SDK default. */
  fetch?: FetchLike;
}

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

function resolveApiKey(options: ClearRunMcpOptions): string {
  const env = options.env ?? process.env;
  const resolved = resolveClearRunApiKey({
    apiKey: options.apiKey,
    env,
    configPath: options.configPath,
  });
  return resolved?.apiKey ?? '';
}

function toolError(message: string): ToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  };
}

function presentedResult(tool: HostedTool, data: unknown): ToolResult {
  const presented = presentHostedCall(tool, data);
  const result: ToolResult = {
    content: [{ type: 'text', text: presented.text }],
    structuredContent: presented.payload,
  };
  if (presented.isError) result.isError = true;
  return result;
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
  tool: HostedTool,
  call: (client: HonestyKernelClient) => Promise<unknown>
): Promise<ToolResult> {
  const apiKey = resolveApiKey(options);
  if (!apiKey) return toolError(MISSING_KEY_MESSAGE);
  try {
    const data = await call(clientFor(options, apiKey));
    return presentedResult(tool, data);
  } catch (err) {
    return toolError(formatFailure(err, apiKey));
  }
}

/** Public lookup. GET /api/verify sends no key, so a missing key is not a failure. */
async function runVerify(options: ClearRunMcpOptions, verdictId: string): Promise<ToolResult> {
  const apiKey = resolveApiKey(options);
  try {
    const client = createVerifyClient({
      baseUrl: options.baseUrl,
      deps: options.fetch ? { fetch: options.fetch } : undefined,
    });
    const data = await client.verify({ verdictId });
    return presentedResult('verify', data);
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
      title: 'Score text already written',
      description:
        'Score text that was already written. ' +
        'Use this when you have the answer and do not have the prompt. ' +
        'Use clearrun_evaluate when you also have the prompt. ' +
        'Use clearrun_chat when the hosted API should write the answer. ' +
        'Use clearrun_verify to look up a verdict id you already have. ' +
        'Do not use this to check whether the answer is true. ' +
        HONESTY_NOTE +
        ' Needs CLEARRUN_API_KEY. Calls POST https://api.clearrun.net/api/score, which spends credits and stores a verdict. ' +
        'Without a key, the tool returns an error and does not call the API. ' +
        'The tool is an error when the body has no verdict.',
      inputSchema: {
        responseText: z
          .string()
          .min(1)
          .describe(
            'The answer text to score. Required. Send the text itself, not a file path or a verdict id. ClearRun scores whether its confidence is backed by its reasoning, from 0 to 100. It does not check facts.'
          ),
        modelId: z
          .string()
          .min(1)
          .optional()
          .describe(
            'Optional id of the model that wrote the text, passed through to the API. Omit it when you do not know the model.'
          ),
      },
      annotations: HOSTED_CALL_ANNOTATIONS,
    },
    async ({ responseText, modelId }) =>
      runHosted(options, 'score', (client) => client.score({ responseText, modelId }))
  );

  server.registerTool(
    'clearrun_evaluate',
    {
      title: 'Score an answer with its prompt',
      description:
        'Score an existing answer together with the prompt that produced it. ' +
        'Use this when you have both the answer and the prompt. ' +
        'Use clearrun_score when you have only the answer. ' +
        'Use clearrun_chat when the hosted API should write the answer. ' +
        'Use clearrun_verify to look up a verdict id you already have. ' +
        'Do not use this to check whether the answer is true. ' +
        HONESTY_NOTE +
        ' Needs CLEARRUN_API_KEY. Calls POST https://api.clearrun.net/api/evaluate, which spends credits and stores a verdict. ' +
        'Without a key, the tool returns an error and does not call the API. ' +
        'The tool is an error when the body has no verdict.',
      inputSchema: {
        responseText: z
          .string()
          .min(1)
          .describe(
            'The existing answer to score. Required. Send the text itself, not a file path or a verdict id.'
          ),
        prompt: z
          .string()
          .min(1)
          .optional()
          .describe(
            'The prompt that produced the answer. Include it when you have it. Omit it only when the prompt is unknown. clearrun_score is the tool for an answer with no prompt.'
          ),
        modelId: z
          .string()
          .min(1)
          .optional()
          .describe(
            'Optional id of the model that wrote the answer, passed through to the API. Omit it when you do not know the model.'
          ),
        sessionId: z
          .string()
          .min(1)
          .optional()
          .describe('Optional session id to attach this call to an earlier hosted session. Omit it for a standalone score.'),
      },
      annotations: HOSTED_CALL_ANNOTATIONS,
    },
    async ({ responseText, prompt, modelId, sessionId }) =>
      runHosted(options, 'evaluate', (client) => client.evaluate({ responseText, prompt, modelId, sessionId }))
  );

  server.registerTool(
    'clearrun_chat',
    {
      title: 'Write an answer and score it',
      description:
        'Ask the hosted ClearRun API to write an answer and score it. ' +
        'Use this when you want a new answer, not a score of text you already have. ' +
        'Use clearrun_score or clearrun_evaluate for text that was already written. ' +
        'Use clearrun_verify to look up a verdict id you already have. ' +
        'Do not use this to check whether an existing answer is true. ' +
        HONESTY_NOTE +
        ' Needs CLEARRUN_API_KEY. Calls POST https://api.clearrun.net/api/chat, which spends credits, writes an answer, and stores a verdict. ' +
        'Without a key, the tool returns an error and does not call the API. ' +
        'The tool is an error when the body has no answer and no verdict.',
      inputSchema: {
        message: z
          .string()
          .min(1)
          .describe(
            'The user message for the hosted API to answer and then score. Required. This is a prompt, not text to score as-is. Use clearrun_score or clearrun_evaluate for text that was already written.'
          ),
        modelId: z
          .string()
          .min(1)
          .optional()
          .describe('Optional model id for the hosted API to use when writing the answer. Omit it to let the API choose.'),
        sessionId: z
          .string()
          .min(1)
          .optional()
          .describe('Optional session id to continue an earlier hosted chat. Omit it to start without a session.'),
      },
      annotations: HOSTED_CALL_ANNOTATIONS,
    },
    async ({ message, modelId, sessionId }) =>
      runHosted(options, 'chat', (client) => client.chat({ message, modelId, sessionId }))
  );

  server.registerTool(
    'clearrun_verify',
    {
      title: 'Look up a stored verdict',
      description:
        'Look up a stored ClearRun verdict by its id. ' +
        'Use this when you already have a verdict id. ' +
        'Use clearrun_score or clearrun_evaluate to score text you already have, and clearrun_chat when the hosted API should write an answer. ' +
        'Do not use this to score new text or to check facts. ' +
        'The stored score, when the API includes one, says whether an answer\'s confidence is backed by its reasoning, from 0 to 100. ' +
        'It does not check facts. A high score does not mean the answer is true. ' +
        'Sends no API key. Calls GET https://api.clearrun.net/api/verify/{verdictId}, which reads the stored verdict, spends no credits, and does not change it. ' +
        'The tool is an error when the body is not a verification result.',
      inputSchema: {
        verdictId: z
          .string()
          .min(1)
          .describe(
            'The verdict id to look up, as returned by an earlier clearrun_score, clearrun_evaluate, or clearrun_chat call. Required. This is an id, not the answer text.'
          ),
      },
      annotations: VERIFY_ANNOTATIONS,
    },
    async ({ verdictId }) => runVerify(options, verdictId)
  );

  return server;
}
