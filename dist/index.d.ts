export { Config } from "./config.js";
export { JobStatus } from "./api.js";
import { JobStatus } from "./api.js";
export { TranslationJobFailedError, TranslationTimeoutError } from "./api.js";
export interface TranslateOptions {
    files: Array<{
        filename: string;
        content: string;
    }>;
    targetLanguages: string[];
    sourceLanguage: string;
    apiKey: string;
    apiUrl?: string;
    skipCache?: boolean;
    project?: string;
    timeoutSeconds?: number;
    onProgress?: (status: JobStatus) => void;
}
export declare function translate(opts: TranslateOptions): Promise<Array<{
    filename: string;
    content: string;
}>>;
