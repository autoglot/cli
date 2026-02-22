export { Config } from "./config.js";
export { JobStatus } from "./api.js";
import { resolveConfig } from "./config.js";
import { createJob, pollUntilDone, downloadFiles, JobStatus } from "./api.js";

export interface TranslateOptions {
  files: Array<{ filename: string; content: string }>;
  targetLanguages: string[];
  sourceLanguage: string;
  apiKey: string;
  apiUrl?: string;
  skipCache?: boolean;
  project?: string;
  onProgress?: (status: JobStatus) => void;
}

export async function translate(
  opts: TranslateOptions
): Promise<Array<{ filename: string; content: string }>> {
  const config = resolveConfig({ apiKey: opts.apiKey, apiUrl: opts.apiUrl });

  const { job_id: jobId } = await createJob(config, {
    files: opts.files,
    targetLanguages: opts.targetLanguages,
    sourceLanguage: opts.sourceLanguage,
    skipCache: opts.skipCache ?? false,
    project: opts.project,
  });

  await pollUntilDone(config, jobId, opts.onProgress ?? (() => {}));

  const result = await downloadFiles(config, jobId);
  return result.files;
}
