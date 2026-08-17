export { Config } from "./config.js";
export { JobStatus } from "./api.js";
import { resolveConfig } from "./config.js";
import {
  createJob,
  pollUntilDone,
  downloadFiles,
  requestFallback,
  JobStatus,
  TranslationJobFailedError,
  TranslationTimeoutError,
} from "./api.js";

export { TranslationJobFailedError, TranslationTimeoutError } from "./api.js";

export interface TranslateOptions {
  files: Array<{ filename: string; content: string }>;
  targetLanguages: string[];
  sourceLanguage: string;
  apiKey: string;
  apiUrl?: string;
  skipCache?: boolean;
  project?: string;
  timeoutSeconds?: number;
  onProgress?: (status: JobStatus) => void;
}

export async function translate(
  opts: TranslateOptions
): Promise<Array<{ filename: string; content: string }>> {
  const config = resolveConfig({ apiKey: opts.apiKey, apiUrl: opts.apiUrl });

  if (opts.timeoutSeconds !== undefined) {
    if (!Number.isFinite(opts.timeoutSeconds) || opts.timeoutSeconds <= 0) {
      throw new Error("timeoutSeconds must be a positive number");
    }
    if (!opts.project) {
      throw new Error("project is required when timeoutSeconds is set so cached translations cannot cross projects");
    }
  }

  const { job_id: jobId } = await createJob(config, {
    files: opts.files,
    targetLanguages: opts.targetLanguages,
    sourceLanguage: opts.sourceLanguage,
    skipCache: opts.skipCache ?? false,
    project: opts.project,
  });

  try {
    await pollUntilDone(
      config,
      jobId,
      opts.onProgress ?? (() => {}),
      { timeoutSeconds: opts.timeoutSeconds }
    );
  } catch (error) {
    const fallbackEligible = error instanceof TranslationTimeoutError ||
      error instanceof TranslationJobFailedError;
    if (opts.timeoutSeconds === undefined || !fallbackEligible) throw error;

    const fallback = await requestFallback(config, jobId);
    return fallback.files;
  }

  const result = await downloadFiles(config, jobId);
  return result.files;
}
