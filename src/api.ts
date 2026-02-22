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

async function request<T>(
  config: Config,
  method: string,
  path: string,
  body?: unknown
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
  }
): Promise<TranslateResponse> {
  return request<TranslateResponse>(config, "POST", "translate", {
    files: opts.files,
    target_languages: opts.targetLanguages,
    source_language: opts.sourceLanguage,
    output_mode: "local",
    skip_cache: opts.skipCache,
  });
}

export async function getJobStatus(
  config: Config,
  jobId: string
): Promise<JobStatus> {
  return request<JobStatus>(config, "GET", `translate/${jobId}`);
}

export async function downloadFiles(
  config: Config,
  jobId: string
): Promise<DownloadResponse> {
  return request<DownloadResponse>(config, "GET", `translate/${jobId}/download`);
}

export async function pollUntilDone(
  config: Config,
  jobId: string,
  onProgress: (status: JobStatus) => void
): Promise<JobStatus> {
  const POLL_INTERVAL = 2000;

  while (true) {
    const status = await getJobStatus(config, jobId);
    onProgress(status);

    if (status.status === "completed") return status;
    if (status.status === "failed") {
      throw new Error(status.error_message || "Translation job failed");
    }
    if (status.status === "cancelled") {
      throw new Error("Translation job was cancelled");
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
}
