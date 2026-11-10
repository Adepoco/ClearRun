# @clearrun/sdk

## Get an API key

Hosted scoring needs a ClearRun account, API access, and an API key. API access is a saved setting on Pro and higher. Turning it off stops API keys from working. The free plan includes 30 monthly credits and does not include API access, so a free plan key is rejected. The API message is `API access requires a Pro plan or higher.`

ClearRun does not use your content to train third-party or generation models. Whether your evaluations may help improve ClearRun's own scoring is an account setting: free plans start opted in, paid plans start opted out, and Enterprise stays off.

1. Open [https://api.clearrun.net/account/keys](https://api.clearrun.net/account/keys). Sign in on that page if you need an account. That page is where you create a key.
2. Save the key:

```bash
npx @clearrun/cli login
```

Or set `CLEARRUN_API_KEY`. Do not commit a real key.

`createKernelClient()` checks an explicit `hosted.apiKey`, then `CLEARRUN_API_KEY`, then `~/.config/clearrun/config.json` from `clearrun login`. When no key is found it throws `MissingApiKeyError`. The message includes the keys page, `npx @clearrun/cli login`, and `CLEARRUN_API_KEY`.

TypeScript client for [ClearRun](https://clearrun.net). Version 0.3.0. It depends only on `@clearrun/core-types` 0.1.0.

`createVerifyClient()` looks up a verdict id with no API key. This package does not export a function that scores text under the name `verify`. Scoring methods are `score`, `evaluate`, and `chat`. npm `@clearrun/sdk@0.2.0` (published 2026-10-29) does not export `createVerifyClient()`.

ClearRun scores the honesty of an AI answer: whether the confidence it expresses is backed by its reasoning. **It is not a fact-checker.** A high score means the confidence matches the justification. It does not mean the answer is true.

`createKernelClient` returns an `HonestyKernelClient`. With an API key it uses `HostedApiClient` against `https://api.clearrun.net`. The scoring engine stays in the hosted service. This package does not contain scoring logic, weights, or formulas.

## Why use it

Call ClearRun from your own app, test suite, or service. `score` and `evaluate` judge text you already have. `chat` asks the hosted API to write an answer and score it. `verify` looks up a verdict id later. You get a score, a grade, named failure categories, and a signed verdict when the API sends one.

## Access

See **Get an API key** above. `createKernelClient()` throws `MissingApiKeyError` when no key is configured. It does not silently return a mock score.

For local development only, pass `{ forceMock: true }` (or a `mock` options object). The mock returns schema-valid verdicts for local development.

## Install

```bash
npm install @clearrun/sdk
```

That also installs `@clearrun/core-types`. Node.js 18 or newer is required (`fetch` is built in). This package is 0.3.0. `npm install @clearrun/sdk` still resolves to 0.2.0 until 0.3.0 is published. 0.2.0 has `score`, `evaluate`, `chat`, and `client.verify`. It does not export `createVerifyClient()`.

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
const { verdict } = await client.score({
  responseText: 'The Eiffel Tower is in Berlin.',
  modelId: 'gpt-4o', // optional
});
```

### evaluate

Score an existing answer, and send the prompt that produced it when you have it. `POST /api/evaluate`.

```ts
const { verdict } = await client.evaluate({
  prompt: 'Where is the Eiffel Tower?',
  responseText: 'The Eiffel Tower is in Berlin.',
  modelId: 'gpt-4o', // optional
  sessionId: 'session-1', // optional
});
```

### chat

Ask the hosted API to generate an answer and score it. `POST /api/chat`. The client always returns `responseText`.

```ts
const chat = await client.chat({
  message: 'What is the capital of France?',
  modelId: 'gpt-4o', // optional
  sessionId: 'session-1', // optional
});

console.log(chat.responseText, chat.verdict.score);
```

### verify

Look up a verdict id. `GET /api/verify/{verdictId}`.

```ts
const check = await client.verify({ verdictId: scored.verdict.verdictId });
console.log(check.verified, check.verdict?.score);
```

The HTTP call does not send the API key. Constructing `createKernelClient()` still requires a key, unless you opted into the mock. To look up an id with no key, use `createVerifyClient()`:

```ts
import { createVerifyClient } from '@clearrun/sdk';

const check = await createVerifyClient().verify({ verdictId: 'VERDICT_ID' });
console.log(check.verified, check.verdict?.score);
```

`score`, `evaluate`, and `chat` on a client with no key throw `MissingApiKeyError` and do not call the API. You can also open the URL with no client at all. See below.

Errors from the API throw `HostedApiError` with `status`, `message`, and optional `code`.

## Credits

Credits are metered per call. On the public pricing page, evaluate and score cost at least 3 credits. Chat costs at most 1 credit per turn. `verify` spends no credits. Current costs and plans: [https://api.clearrun.net/pricing](https://api.clearrun.net/pricing).

## Verify a verdict

```bash
curl https://api.clearrun.net/api/verify/VERDICT_ID
```

No API key is required for that public request. The lookup confirms the stored verdict. It does not fact-check the original answer.

A verdict includes `score` (0 to 100, or null when the API cannot score), `grade`, `risk`, `failureCategories`, `summary`, `verdictId`, and a signature when the API signs it. Field meanings are locked in [docs/CONTRACT.md](https://github.com/Adepoco/ClearRun/blob/main/docs/CONTRACT.md). The formula is not part of this package.

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
