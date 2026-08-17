import { Config } from "./config.js";

export interface JobStatus {
  job_id: string;
  status: string;
  progress: number;
  total_strings: number;
  completed_strings: number;
  error_message?: string;
}

interface TranslateResponse {
  job_id: string;
  status: string;
  translator: string;
  output_mode: string;
  message: string;
}

interface DownloadResponse {
  files: Array<{ filename: string; content: string }>;
}

export interface FallbackResponse extends DownloadResponse {
  job_id: string;
  status: string;
  fallback_used: boolean;
}

export class TranslationTimeoutError extends Error {
  constructor(public readonly jobId: string, public readonly timeoutSeconds: number) {
    super(`Translation did not complete within ${timeoutSeconds} seconds`);
    this.name = "TranslationTimeoutError";
  }
}

export class TranslationJobFailedError extends Error {
  constructor(public readonly jobId: string, message: string) {
    super(message);
    this.name = "TranslationJobFailedError";
  }
}

async function request<T>(
  config: Config,
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  const url = `${config.apiUrl}/v1/${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const json = (await res.json()) as T & { error?: string };

  if (!res.ok) {
    const msg = json.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json;
}

export async function createJob(
  config: Config,
  opts: {
    files: Array<{ filename: string; content: string }>;
    targetLanguages: string[];
    sourceLanguage: string;
    skipCache: boolean;
    project?: string;
  }
): Promise<TranslateResponse> {
  const body: Record<string, unknown> = {
    files: opts.files,
    target_languages: opts.targetLanguages,
    source_language: opts.sourceLanguage,
    output_mode: "local",
    skip_cache: opts.skipCache,
  };
  if (opts.project) {
    body.project = opts.project;
  }
  return request<TranslateResponse>(config, "POST", "translate", body);
}

export async function getJobStatus(
  config: Config,
  jobId: string,
  signal?: AbortSignal
): Promise<JobStatus> {
  return request<JobStatus>(config, "GET", `translate/${jobId}`, undefined, signal);
}

export async function downloadFiles(
  config: Config,
  jobId: string
): Promise<DownloadResponse> {
  return request<DownloadResponse>(config, "GET", `translate/${jobId}/download`);
}

export async function requestFallback(
  config: Config,
  jobId: string
): Promise<FallbackResponse> {
  return request<FallbackResponse>(config, "POST", `translate/${jobId}/fallback`);
}

export async function pollUntilDone(
  config: Config,
  jobId: string,
  onProgress: (status: JobStatus) => void,
  options: { timeoutSeconds?: number; pollIntervalMs?: number } = {}
): Promise<JobStatus> {
  const pollInterval = options.pollIntervalMs ?? 2000;
  const timeoutSeconds = options.timeoutSeconds;
  const timeoutMs = timeoutSeconds === undefined ? undefined : timeoutSeconds * 1000;
  const deadline = timeoutMs ? Date.now() + timeoutMs : undefined;

  while (true) {
    const remaining = deadline ? deadline - Date.now() : undefined;
    if (remaining !== undefined && remaining <= 0) {
      throw new TranslationTimeoutError(jobId, timeoutSeconds!);
    }

    const controller = new AbortController();
    const timer = remaining === undefined
      ? undefined
      : setTimeout(() => controller.abort(), remaining);

    let status: JobStatus;
    try {
      status = await getJobStatus(config, jobId, controller.signal);
    } catch (error) {
      if (controller.signal.aborted && timeoutSeconds) {
        throw new TranslationTimeoutError(jobId, timeoutSeconds);
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
    onProgress(status);

    if (status.status === "completed") return status;
    if (status.status === "failed") {
      throw new TranslationJobFailedError(
        jobId,
        status.error_message || "Translation job failed"
      );
    }
    if (status.status === "cancelled") {
      throw new Error("Translation job was cancelled");
    }

    const waitMs = remaining === undefined
      ? pollInterval
      : Math.min(pollInterval, Math.max(0, deadline! - Date.now()));
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}
