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
    files: Array<{
        filename: string;
        content: string;
    }>;
}
export interface FallbackResponse extends DownloadResponse {
    job_id: string;
    status: string;
    fallback_used: boolean;
}
export declare class TranslationTimeoutError extends Error {
    readonly jobId: string;
    readonly timeoutSeconds: number;
    constructor(jobId: string, timeoutSeconds: number);
}
export declare class TranslationJobFailedError extends Error {
    readonly jobId: string;
    constructor(jobId: string, message: string);
}
export declare function createJob(config: Config, opts: {
    files: Array<{
        filename: string;
        content: string;
    }>;
    targetLanguages: string[];
    sourceLanguage: string;
    skipCache: boolean;
    project?: string;
}): Promise<TranslateResponse>;
export declare function getJobStatus(config: Config, jobId: string, signal?: AbortSignal): Promise<JobStatus>;
export declare function downloadFiles(config: Config, jobId: string): Promise<DownloadResponse>;
export declare function requestFallback(config: Config, jobId: string): Promise<FallbackResponse>;
export declare function pollUntilDone(config: Config, jobId: string, onProgress: (status: JobStatus) => void, options?: {
    timeoutSeconds?: number;
    pollIntervalMs?: number;
}): Promise<JobStatus>;
export {};
