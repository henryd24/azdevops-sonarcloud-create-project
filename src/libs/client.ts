import * as tl from "azure-pipelines-task-lib";

export const DEFAULT_BASE_URL = "https://sonarcloud.io";

export type Params = Record<string, string | number | boolean | string[] | undefined>;

export interface ClientOptions {
    timeoutMs?: number;
    retries?: number;
    retryDelayMs?: number;
    /** Retries HTTP 404 responses, used right after creating a project while it propagates. */
    notFoundRetries?: number;
}

export class SonarApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly method: string,
        public readonly path: string,
        public readonly details: string
    ) {
        super(`${method} ${path} failed with HTTP ${status}${details ? `: ${details}` : ""}`);
        this.name = "SonarApiError";
    }
}

/**
 * Builds the query/body parameters. Arrays are sent as repeated parameters
 * (e.g. values=a&values=b), which is what the Sonar Web API expects for multi-value fields.
 */
export function toSearchParams(params: Params = {}): URLSearchParams {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
            value.forEach(v => search.append(key, v));
        } else {
            search.append(key, String(value));
        }
    }
    return search;
}

function isRetryable(status: number): boolean {
    return status === 429 || status >= 500;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class SonarClient {
    readonly baseUrl: string;
    private readonly authorization: string;
    private readonly timeoutMs: number;
    private readonly retries: number;
    private readonly retryDelayMs: number;
    private readonly notFoundRetries: number;

    constructor(baseUrl: string | undefined, private readonly token: string, private readonly options: ClientOptions = {}) {
        this.baseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
        this.authorization = "Basic " + Buffer.from(`${token}:`).toString("base64");
        this.timeoutMs = options.timeoutMs ?? 30000;
        this.retries = options.retries ?? 3;
        this.retryDelayMs = options.retryDelayMs ?? 1000;
        this.notFoundRetries = options.notFoundRetries ?? 0;
    }

    /**
     * SonarCloud needs a few seconds to propagate a new project to every service; until then
     * some endpoints answer 404 "Project doesn't exist". This client retries those responses.
     */
    withNotFoundRetries(retries = 4): SonarClient {
        return new SonarClient(this.baseUrl, this.token, { ...this.options, notFoundRetries: retries });
    }

    /**
     * Client for the Web API v2, served from the "api." subdomain
     * (https://sonarcloud.io -> https://api.sonarcloud.io, https://sonarqube.us -> https://api.sonarqube.us).
     */
    v2(): SonarClient {
        const url = new URL(this.baseUrl);
        if (!url.hostname.startsWith("api.")) url.hostname = `api.${url.hostname}`;
        return new SonarClient(url.origin, this.token, this.options);
    }

    async get<T = any>(path: string, params?: Params): Promise<T> {
        const query = toSearchParams(params).toString();
        const response = await this.request("GET", `${path}${query ? `?${query}` : ""}`);
        const text = await response.text();
        return (text ? JSON.parse(text) : {}) as T;
    }

    async post<T = any>(path: string, params?: Params): Promise<T | undefined> {
        const response = await this.request("POST", path, toSearchParams(params).toString(), "application/x-www-form-urlencoded");
        const text = await response.text();
        return text ? (JSON.parse(text) as T) : undefined;
    }

    async postJson<T = any>(path: string, body: unknown): Promise<T | undefined> {
        const response = await this.request("POST", path, JSON.stringify(body), "application/json");
        const text = await response.text();
        return text ? (JSON.parse(text) as T) : undefined;
    }

    private async request(method: "GET" | "POST", path: string, body?: string, contentType?: string): Promise<Response> {
        const url = `${this.baseUrl}${path}`;
        let attempt = 0;
        let notFoundAttempt = 0;
        for (;;) {
            attempt++;
            tl.debug(`${method} ${url} (attempt ${attempt})`);
            let response: Response;
            try {
                response = await fetch(url, {
                    method,
                    headers: {
                        "Authorization": this.authorization,
                        "Accept": "application/json",
                        ...(contentType ? { "Content-Type": contentType } : {})
                    },
                    body,
                    signal: AbortSignal.timeout(this.timeoutMs)
                });
            } catch (err) {
                if (attempt <= this.retries) {
                    tl.debug(`Network error on ${method} ${path}: ${err}. Retrying...`);
                    await sleep(this.retryDelayMs * 2 ** (attempt - 1));
                    continue;
                }
                throw new SonarApiError(0, method, path, (err as Error).message);
            }

            if (response.ok) return response;

            if (isRetryable(response.status) && attempt <= this.retries) {
                const retryAfter = Number(response.headers.get("retry-after"));
                const delay = retryAfter > 0 ? retryAfter * 1000 : this.retryDelayMs * 2 ** (attempt - 1);
                tl.debug(`HTTP ${response.status} on ${method} ${path}. Retrying in ${delay}ms...`);
                await sleep(delay);
                continue;
            }
            if (response.status === 404 && notFoundAttempt < this.notFoundRetries) {
                notFoundAttempt++;
                attempt--;
                const delay = this.retryDelayMs * 2 ** notFoundAttempt;
                tl.debug(`HTTP 404 on ${method} ${path}, the project may still be propagating. Retrying in ${delay}ms...`);
                await sleep(delay);
                continue;
            }
            throw new SonarApiError(response.status, method, path, await extractErrorDetails(response));
        }
    }
}

async function extractErrorDetails(response: Response): Promise<string> {
    const text = await response.text().catch(() => "");
    try {
        const json = JSON.parse(text);
        if (Array.isArray(json.errors)) {
            return json.errors.map((e: { msg?: string }) => e.msg?.replace(/\s+/g, " ").trim()).filter(Boolean).join("; ");
        }
        // Web API v2 error format.
        if (typeof json.message === "string") return json.message.replace(/\s+/g, " ").trim();
    } catch {
        // Not JSON, fall through to the raw text.
    }
    return text.slice(0, 500);
}

export function isAuthError(err: unknown): boolean {
    return err instanceof SonarApiError && (err.status === 401 || err.status === 403);
}
