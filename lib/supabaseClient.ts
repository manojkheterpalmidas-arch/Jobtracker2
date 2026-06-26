type SupabaseConfig = {
  url: string;
  key: string;
};

export function getBrowserSupabaseConfig(): SupabaseConfig | undefined {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) return undefined;

  return {
    url: url.replace(/\/+$/, ""),
    key
  };
}

export function getServerSupabaseConfig(): SupabaseConfig | undefined {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) return undefined;

  return {
    url: url.replace(/\/+$/, ""),
    key
  };
}

export async function supabaseAdminFetch(path: string, init: RequestInit = {}) {
  const config = getServerSupabaseConfig();

  if (!config) {
    throw new Error("Supabase is not configured.");
  }

  return fetch(`${config.url}/rest/v1/${path.replace(/^\/+/, "")}`, {
    ...init,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      ...init.headers
    },
    cache: "no-store"
  });
}

function constantTimeEquals(a: string, b: string) {
  // Avoid leaking length/content via early-exit comparison. Folded onto a fixed
  // width so mismatched lengths still run the full loop.
  const length = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;

  for (let i = 0; i < length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}

export function isAdminPasscodeValid(passcode?: string | null) {
  const configured = process.env.ADMIN_PASSCODE?.trim();

  if (!configured) {
    // Fail OPEN only in local/dev so you are not locked out while iterating.
    // In production an unset ADMIN_PASSCODE must deny access rather than expose
    // the admin database and write routes. Set ADMIN_PASSCODE (or, better, real
    // auth) before deploying.
    return process.env.NODE_ENV !== "production";
  }

  return Boolean(passcode) && constantTimeEquals(passcode as string, configured);
}
