# @clearrun/sdk

## Get an API key

A signed-in free account with a verified email can create one developer key at [https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys). The full key is shown once and starts with `crun_`. It calls evaluate, score, and chat, and it returns the free verdict: score, grade, risk, and a summary of 16 words or fewer. `componentSignals` is limited to Evidence support and Reasoning integrity. `confidenceInterval` and `scoringVersion` are omitted. Calls spend the free plan's 30 monthly credits. The default cap is 2 requests a second, 6 a minute, 30 an hour, and 40 a day. Evaluate, score, and chat share that cap. Over the cap, the API returns 429 and `Retry-After`. Signed-in chat and Paste Check on api.clearrun.net do not use the key. Chain verification and audit export need a Pro plan or higher. An unverified account cannot create a key. A free account can hold one active developer key. Revoke it before creating another. A key that is not a free developer key is refused on a free account with 403 and code `API_ACCESS_REQUIRED`. On Pro, Business, and Enterprise, API access is a saved setting. Turning it off returns 403 and code `API_ACCESS_DISABLED`. That switch does not turn a free developer key on or off.

ClearRun does not use your content to train third-party or generation models. Whether your evaluations may help improve ClearRun's own scoring is an account setting: free plans start opted in, paid plans start opted out, and Enterprise stays off.

1. Open [https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys). Sign in on that page if you need an account. That page is where you create a key.
2. Save the key:

```bash
npx @clearrun/cli login
```

Or set `CLEARRUN_API_KEY`. Do not commit a real key.

`createKernelClient()` checks an explicit `hosted.apiKey`, then `CLEARRUN_API_KEY`, then `~/.config/clearrun/config.json` from `clearrun login`. Constructing the client does not throw when no key is found. The first `score`, `evaluate`, or `chat` throws `MissingApiKeyError`. The message includes the keys page, `npx @clearrun/cli login`, and `CLEARRUN_API_KEY`. `verify` does not need a key. `{ forceMock: true }` or a `mock` options object still runs with no key.

TypeScript client for [ClearRun](https://clearrun.net). Version 1.2.0. It depends only on `@clearrun/core-types` 1.2.0.

`createVerifyClient()` looks up a verdict id with no API key. This package does not export a function that scores text under the name `verify`. Scoring methods are `score`, `evaluate`, and `chat`. npm `@clearrun/sdk@0.2.0` (published 2026-10-29) does not export `createVerifyClient()`.

ClearRun scores the honesty of an AI answer: whether the confidence it expresses is backed by its reasoning. **It is not a fact-checker.** A high score means the confidence matches the justification. It does not mean the answer is true.

`createKernelClient` returns an `HonestyKernelClient`. With an API key it uses `HostedApiClient` against `https://api.clearrun.net`. The scoring engine stays in the hosted service. This package does not contain scoring logic, weights, or formulas.

## Why use it

Call ClearRun from your own app, test suite, or service. `score` and `evaluate` judge text you already have. `chat` asks the hosted API to write an answer and score it. `verify` looks up a verdict id later. You get a score, a grade, component signals, and a signed verdict when the API sends one.

## Access

See **Get an API key** above. `createKernelClient()` does not throw when no key is configured, and it does not silently return a mock score. The first `score`, `evaluate`, or `chat` throws `MissingApiKeyError`.

For local development only, pass `{ forceMock: true }` (or a `mock` options object). The mock returns schema-valid verdicts for local development.

## Install

```bash
npm install @clearrun/sdk
```

That also installs `@clearrun/core-types`. Node.js 18 or newer is required (`fetch` is built in). This package and `@clearrun/core-types` are 1.2.0. `npm install @clearrun/sdk` installs 1.2.0. 0.2.0 has `score`, `evaluate`, `chat`, and `client.verify`. It does not export `createVerifyClient()`.

A secret API key belongs on a server or a backend proxy. The hosted API sends no CORS headers, so do not put that key in a browser page.

## Quickstart

```ts
import { createKernelClient } from '@clearrun/sdk';

const client = createKernelClient({
  hosted: { apiKey: process.env.CLEARRUN_API_KEY },
});

const scored = await client.score({
  responseText: 'The Eiffel Tower is in Berlin.',
});

console.log(scored.verdict.score, scored.verdict.grade, scored.verdict.verdictId);
```

`CLEARRUN_API_KEY` is read when `hosted.apiKey` is omitted:

```ts
const client = createKernelClient();
```

## Methods

Optional `baseUrl` overrides `https://api.clearrun.net`. Optional `timeoutMs` aborts a slow request. `score`, `evaluate`, and `chat` send `Authorization: Bearer <apiKey>`. `verify` does not.

### score

Score text that was already written. `POST /api/score`.

```ts
const { verdict, receipt } = await client.score({
  responseText: 'The Eiffel Tower is in Berlin.',
  modelId: 'gpt-4o', // optional
});
```

`receipt` is set when the API sends one.

### evaluate

Score an existing answer, and send the prompt that produced it when you have it. `POST /api/evaluate`.

```ts
const { verdict, receipt } = await client.evaluate({
  prompt: 'Where is the Eiffel Tower?',
  responseText: 'The Eiffel Tower is in Berlin.',
  modelId: 'gpt-4o', // optional
  sessionId: 'session-1', // optional
});
```

`receipt` is present when the API stores one. The same field is on `score`.

### chat

Ask the hosted API to generate an answer and score it. `POST /api/chat`. The client always returns `responseText`.

```ts
const chat = await client.chat({
  message: 'What is the capital of France?',
  modelId: 'gpt-4o', // optional
  sessionId: 'session-1', // optional
  context: [{ role: 'user', content: 'Earlier turn.' }], // optional
});

console.log(chat.responseText, chat.verdict.score);
```

### verify

Look up a verdict id. `GET /api/verify/{verdictId}`.

```ts
const check = await client.verify({ verdictId: scored.verdict.verdictId });
console.log(check.verified, check.verdict?.score);
```

The HTTP call does not send the API key. Constructing `createKernelClient()` does not require a key. Scoring calls do, unless you opted into the mock. To look up an id with no key, use `createVerifyClient()`:

```ts
import { createVerifyClient } from '@clearrun/sdk';

const check = await createVerifyClient().verify({ verdictId: 'VERDICT_ID' });
console.log(check.verified, check.verdict?.score);
```

`score`, `evaluate`, and `chat` on a client with no key throw `MissingApiKeyError` and do not call the API. You can also open the URL with no client at all. See below.

Errors from the API throw `HostedApiError` with `status`, `message`, and optional `code` and `details`. On 429, `retryAfter` is the wait in seconds, from the body or the `Retry-After` header. On 402, `creditsNeeded` and `currentBalance` come from the body. A blocked call uses code `CONTENT_BLOCKED` and message `Content blocked`. `code` is an open string.

## Credits

Credits are metered per call. On the public pricing page, evaluate and score cost at least 3 credits. Chat costs at most 4 credits per turn. `verify` spends no credits. Current costs and plans: [https://api.clearrun.net/pricing](https://api.clearrun.net/pricing).

## Verify a verdict

```bash
curl https://api.clearrun.net/api/verify/VERDICT_ID
```

No API key is required for that public request. The lookup confirms the stored verdict. It does not fact-check the original answer.

A verdict includes `score` (0 to 100, or null when the API cannot score), `grade`, `risk`, `summary`, `verdictId`, and `componentSignals`. Paid plans receive four signals: Evidence support, Reasoning integrity, Confidence calibration, and Ambiguity handling. Free use, developer API access, and public lookups receive Evidence support and Reasoning integrity. `scoringVersion`, `confidenceInterval`, `failureCategories`, `issues`, and `signalsSalt` are present only when the API sends them. A missing field is not an error. Field meanings are locked in [docs/CONTRACT.md](https://github.com/Adepoco/ClearRun/blob/main/docs/CONTRACT.md). The formula is not part of this package.

## Links

- npm: [https://www.npmjs.com/package/@clearrun/sdk](https://www.npmjs.com/package/@clearrun/sdk)
- GitHub: [https://github.com/Adepoco/ClearRun](https://github.com/Adepoco/ClearRun)
- Site: [https://clearrun.net](https://clearrun.net)
- Pricing: [https://api.clearrun.net/pricing](https://api.clearrun.net/pricing)
- API keys: [https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys)
- CLI: [https://www.npmjs.com/package/@clearrun/cli](https://www.npmjs.com/package/@clearrun/cli)
- MCP: [https://www.npmjs.com/package/@clearrun/mcp](https://www.npmjs.com/package/@clearrun/mcp)
- Developer guide: [docs/developers.md](https://github.com/Adepoco/ClearRun/blob/main/docs/developers.md)

ClearRun is made by Adepoco, a California corporation. Contact: [contact@adepoco.com](mailto:contact@adepoco.com).

## License

MIT. The hosted scoring service is licensed separately.
