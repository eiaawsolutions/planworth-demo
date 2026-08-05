import "server-only";

/**
 * Infisical secret resolver (Node/Next.js port of the EIAAW Laravel pattern).
 *
 * EIAAW house rule: the ONLY raw secrets in env are the Infisical bootstrap creds
 * (INFISICAL_APP_CLIENT_ID / INFISICAL_APP_CLIENT_SECRET / INFISICAL_PROJECT_ID).
 * Every other secret is a `secret://project/env/path/NAME` handle resolved here at
 * runtime via Infisical universal-auth.
 *
 * When INFISICAL_RESOLVER_ENABLED !== "true", resolve() returns the raw env value
 * unchanged — so local dev can keep a plain ANTHROPIC_API_KEY in the shell without
 * standing up Infisical.
 *
 * Copied from the sibling caci-demo rather than reinvented; keep the two in sync.
 */

const SITE_URL = process.env.INFISICAL_SITE_URL ?? "https://app.infisical.com";
const ENABLED = process.env.INFISICAL_RESOLVER_ENABLED === "true";
const CACHE_TTL_MS = Number(process.env.INFISICAL_CACHE_TTL ?? 300) * 1000;
const TIMEOUT_MS = Number(process.env.INFISICAL_REQUEST_TIMEOUT ?? 5) * 1000;

// A secret handle is `secret://<project>/<env>/[<path>/]<NAME>`.
// The path segment is OPTIONAL — a secret at the workspace root is
// `secret://project/env/NAME` (3 parts). Anything starting with `secret://`
// that does not parse is a configuration error and MUST fail loudly, never
// pass through as a literal API key.
const HANDLE_PREFIX = "secret://";

interface ParsedHandle {
  project: string;
  environment: string;
  secretPath: string; // "/" when no explicit path
  secretName: string;
}

function parseHandle(raw: string): ParsedHandle | null {
  if (!raw.startsWith(HANDLE_PREFIX)) return null;
  const parts = raw.slice(HANDLE_PREFIX.length).split("/").filter(Boolean);
  if (parts.length < 3) {
    throw new Error(
      `Malformed secret handle "${raw}": expected secret://project/env/[path/]NAME.`,
    );
  }
  const [project, environment, ...rest] = parts;
  const secretName = rest.pop()!;
  const secretPath = rest.length ? "/" + rest.join("/") : "/";
  return { project, environment, secretPath, secretName };
}

interface CacheEntry {
  value: string;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

let tokenPromise: Promise<string> | null = null;
let tokenExpiresAt = 0;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Universal-auth login → short-lived access token (cached until near expiry). */
async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenPromise && now < tokenExpiresAt) return tokenPromise;

  tokenPromise = (async () => {
    const clientId = process.env.INFISICAL_APP_CLIENT_ID;
    const clientSecret = process.env.INFISICAL_APP_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error(
        "Infisical bootstrap creds missing (INFISICAL_APP_CLIENT_ID / _SECRET).",
      );
    }
    const res = await fetchWithTimeout(
      `${SITE_URL}/api/v1/auth/universal-auth/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, clientSecret }),
      },
    );
    if (!res.ok) throw new Error(`Infisical login failed: ${res.status}`);
    const json = (await res.json()) as { accessToken: string; expiresIn?: number };
    // Refresh 60s before the token actually expires.
    tokenExpiresAt = Date.now() + ((json.expiresIn ?? 600) - 60) * 1000;
    return json.accessToken;
  })();

  try {
    return await tokenPromise;
  } catch (err) {
    tokenPromise = null;
    throw err;
  }
}

/** Fetch a single secret value from Infisical. */
async function fetchSecret(params: {
  environment: string;
  secretPath: string;
  secretName: string;
}): Promise<string> {
  const token = await getAccessToken();
  const projectId = process.env.INFISICAL_PROJECT_ID ?? "";
  const secretPath = params.secretPath.startsWith("/")
    ? params.secretPath
    : `/${params.secretPath}`;
  // Send both projectId (current API) and workspaceId (legacy alias) — Infisical
  // ignores the one it doesn't use, so this works across API versions.
  const qs = new URLSearchParams({
    projectId,
    workspaceId: projectId,
    environment: params.environment,
    secretPath,
    viewSecretValue: "true",
  });
  const url = `${SITE_URL}/api/v3/secrets/raw/${encodeURIComponent(params.secretName)}?${qs}`;
  const res = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Infisical secret read failed for ${params.secretName}: ${res.status} ${body.slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as { secret?: { secretValue?: string } };
  const value = json.secret?.secretValue;
  if (value == null) {
    throw new Error(`Infisical returned no value for ${params.secretName}`);
  }
  return value;
}

/**
 * Resolve a value that may be a `secret://` handle. Non-handles (or resolver
 * disabled) are returned unchanged. Results are cached for INFISICAL_CACHE_TTL.
 */
export async function resolveSecret(
  raw: string | undefined,
): Promise<string | undefined> {
  if (!raw) return raw;

  // parseHandle throws on a malformed `secret://` string (fail loud, never
  // pass a handle through as a literal value), and returns null for plain values.
  const handle = parseHandle(raw);
  if (!handle) return raw; // plain value

  if (!ENABLED) {
    throw new Error(
      `Secret handle "${raw}" requires the Infisical resolver, but INFISICAL_RESOLVER_ENABLED is not "true".`,
    );
  }

  const cached = cache.get(raw);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const value = await fetchSecret({
    environment: handle.environment,
    secretPath: handle.secretPath,
    secretName: handle.secretName,
  });
  cache.set(raw, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}
