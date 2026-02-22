const DEFAULT_API_URL = "https://api.autoglot.app";

export interface Config {
  apiKey: string;
  apiUrl: string;
}

export function resolveConfig(opts: {
  apiKey?: string;
  apiUrl?: string;
}): Config {
  const apiKey =
    opts.apiKey || process.env.AUTOGLOT_API_KEY || "";

  if (!apiKey) {
    throw new Error(
      "API key is required. Provide --api-key or set AUTOGLOT_API_KEY."
    );
  }

  return {
    apiKey,
    apiUrl: opts.apiUrl || process.env.AUTOGLOT_API_URL || DEFAULT_API_URL,
  };
}
