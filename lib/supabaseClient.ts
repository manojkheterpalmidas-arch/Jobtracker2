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

export function isAdminPasscodeValid(passcode?: string | null) {
  const configured = process.env.ADMIN_PASSCODE?.trim();

  // MVP/dev mode: leave ADMIN_PASSCODE empty locally to avoid locking yourself out.
  // Production should set ADMIN_PASSCODE or, better, replace this with real auth.
  if (!configured) return true;

  return Boolean(passcode && passcode === configured);
}
