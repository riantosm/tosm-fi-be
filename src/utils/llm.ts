// Minimal client for any OpenAI-compatible chat-completions endpoint
// (Gemini's /v1beta/openai, Groq, OpenRouter, ...), configured purely by env:
//   LLM_BASE_URL, LLM_API_KEY, LLM_MODEL            (required)
//   LLM_FALLBACK_MODELS   comma-separated, tried in order when the previous
//                         model is overloaded/rate-limited/times out
//   LLM_REASONING_EFFORT  default "low"; "default" omits the parameter
// Plain fetch instead of the openai SDK: no extra dependency and no Node
// version floor on Vercel (the current SDK requires Node >= 22).

export type LlmErrorKind = "config" | "quota" | "unavailable" | "invalid";

export class LlmError extends Error {
  kind: LlmErrorKind;
  status?: number;
  /** How long the provider asked us to wait (e.g. a daily free-tier quota). */
  retryAfterMs?: number;

  constructor(kind: LlmErrorKind, message: string, status?: number, retryAfterMs?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface JsonCompletionRequest {
  messages: LlmMessage[];
  schemaName: string;
  schema: Record<string, unknown>;
}

// Gemini's free tier can hang for a long time when a model is overloaded, so
// every attempt is capped, the whole call has a budget well under Vercel's
// function limit, and a slow model gets a "hedge": after HEDGE_AFTER_MS the
// next model is started too and whichever answers first wins. A healthy model
// answers well before the hedge, so normally only one request is made.
const ATTEMPT_TIMEOUT_MS = 20_000;
const TOTAL_BUDGET_MS = 45_000;
const MIN_ATTEMPT_MS = 4_000;
const HEDGE_AFTER_MS = 6_000;
const RETRY_PAUSE_MS = 1_000;

// A model that just failed (overloaded, rate-limited, timed out) moves to the
// back of the queue for a minute, so the next requests on this warm instance
// don't each wait out its timeout before reaching a fallback.
const COOLDOWN_MS = 60_000;
const cooldownUntil = new Map<string, number>();

function orderByCooldown(models: string[]): string[] {
  const now = Date.now();
  const ready = models.filter((model) => (cooldownUntil.get(model) ?? 0) <= now);
  const cooling = models.filter((model) => (cooldownUntil.get(model) ?? 0) > now);
  return [...ready, ...cooling];
}

function readConfig() {
  const baseUrl = process.env.LLM_BASE_URL?.trim();
  const apiKey = process.env.LLM_API_KEY?.trim();
  const models = [process.env.LLM_MODEL, ...(process.env.LLM_FALLBACK_MODELS ?? "").split(",")]
    .map((model) => model?.trim())
    .filter((model): model is string => Boolean(model));

  if (!baseUrl || !apiKey || models.length === 0) {
    throw new LlmError("config", "LLM_BASE_URL, LLM_API_KEY, dan LLM_MODEL belum diatur");
  }

  const effort = process.env.LLM_REASONING_EFFORT?.trim() || "low";
  return {
    endpoint: `${baseUrl.replace(/\/+$/, "")}/chat/completions`,
    apiKey,
    models: [...new Set(models)],
    reasoningEffort: effort === "default" ? undefined : effort,
  };
}

// Gemini's compatibility layer wraps errors in an array; OpenAI-style APIs don't.
function errorMessageOf(body: string): string {
  try {
    const parsed = JSON.parse(body);
    const error = Array.isArray(parsed) ? parsed[0]?.error : parsed?.error;
    if (typeof error?.message === "string") return error.message;
  } catch {
    // not JSON — fall through to the raw text
  }
  return body.slice(0, 200);
}

// Gemini's 429 says "Please retry in 9h11m3.5s" when a model's daily free
// quota is used up (gemini-3.8-flash allows only 20 requests a day).
const RETRY_IN_RE = /retry in\s*(?:(\d+)h)?\s*(?:(\d+)m(?!s))?\s*(?:([\d.]+)s)?/i;
const MAX_COOLDOWN_MS = 12 * 60 * 60_000;

function retryAfterOf(message: string, header: string | null): number | undefined {
  const seconds = Number(header);
  if (header && Number.isFinite(seconds)) return seconds * 1000;
  const match = message.match(RETRY_IN_RE);
  if (!match || !(match[1] || match[2] || match[3])) return undefined;
  const ms =
    (Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)) * 1000;
  return Math.min(ms, MAX_COOLDOWN_MS);
}

function kindForStatus(status: number): LlmErrorKind {
  if (status === 429) return "quota";
  if (status === 401 || status === 403) return "config";
  if (status >= 500 || status === 408) return "unavailable";
  return "invalid";
}

function parseJsonContent(content: string): unknown {
  const trimmed = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new LlmError("invalid", "LLM mengembalikan JSON yang tidak valid");
  }
}

async function attempt(
  endpoint: string,
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs: number,
  cancel: AbortSignal,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onCancel = () => controller.abort();
  cancel.addEventListener("abort", onCancel);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      const message = errorMessageOf(text);
      throw new LlmError(
        kindForStatus(response.status),
        `LLM ${response.status}: ${message.split("\n")[0]}`,
        response.status,
        response.status === 429 ? retryAfterOf(message, response.headers.get("retry-after")) : undefined,
      );
    }

    const content = JSON.parse(text)?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new LlmError("invalid", "LLM tidak mengembalikan jawaban");
    }
    return parseJsonContent(content);
  } catch (error) {
    if (error instanceof LlmError) throw error;
    if (controller.signal.aborted) throw new LlmError("unavailable", "LLM timeout");
    throw new LlmError("unavailable", `LLM tidak bisa dihubungi: ${(error as Error).message}`);
  } finally {
    clearTimeout(timer);
    cancel.removeEventListener("abort", onCancel);
  }
}

/**
 * One chat completion constrained to `schema`, parsed. Walks the configured
 * models (recently failed ones last), hedging slow ones and moving on at once
 * after a quick failure. Models that failed with a quick 5xx ("high demand"
 * spikes are usually momentary) get one more try. A config error (missing
 * env, bad key) fails immediately.
 */
export function completeJson<T>(request: JsonCompletionRequest): Promise<T> {
  const config = readConfig();
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const queue = orderByCooldown(config.models);
  const retried = new Set<string>();
  const cancel = new AbortController();
  const hedges = new Set<ReturnType<typeof setTimeout>>();

  return new Promise<T>((resolve, reject) => {
    let next = 0;
    let inFlight = 0;
    let settled = false;
    let lastError: LlmError | null = null;

    const finish = (error: LlmError | null, result?: T) => {
      if (settled) return;
      settled = true;
      hedges.forEach(clearTimeout);
      cancel.abort();
      if (error) reject(error);
      else resolve(result as T);
    };

    const launch = () => {
      if (settled) return;
      const remaining = deadline - Date.now();
      if (next >= queue.length || remaining < MIN_ATTEMPT_MS) {
        if (inFlight === 0) finish(lastError ?? new LlmError("unavailable", "LLM timeout"));
        return;
      }

      const model = queue[next++];
      inFlight++;
      const hedge = setTimeout(launch, HEDGE_AFTER_MS);
      hedges.add(hedge);
      const body: Record<string, unknown> = {
        model,
        messages: request.messages,
        response_format: {
          type: "json_schema",
          json_schema: { name: request.schemaName, strict: true, schema: request.schema },
        },
        ...(config.reasoningEffort && { reasoning_effort: config.reasoningEffort }),
      };

      attempt(config.endpoint, config.apiKey, body, Math.min(ATTEMPT_TIMEOUT_MS, remaining), cancel.signal)
        .then((result) => {
          cooldownUntil.delete(model);
          finish(null, result as T);
        })
        .catch((error: LlmError) => {
          clearTimeout(hedge);
          hedges.delete(hedge);
          inFlight--;
          if (settled) return;
          if (error.kind === "config") return finish(error);

          console.warn(`[llm] ${model} failed: ${error.message}`);
          lastError = error;
          if (error.kind !== "invalid") {
            cooldownUntil.set(model, Date.now() + Math.max(COOLDOWN_MS, error.retryAfterMs ?? 0));
          }
          if ((error.status ?? 0) >= 500 && !retried.has(model)) {
            retried.add(model);
            queue.push(model);
          }
          // Only start another model if no hedge is already running.
          if (inFlight === 0) {
            const isRetry = next < queue.length && retried.has(queue[next]) && queue.indexOf(queue[next]) < next;
            hedges.add(setTimeout(launch, isRetry ? RETRY_PAUSE_MS : 0));
          }
        });
    };

    launch();
  });
}
