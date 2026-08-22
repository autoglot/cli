"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationJobFailedError = exports.TranslationTimeoutError = void 0;
exports.createJob = createJob;
exports.getJobStatus = getJobStatus;
exports.downloadFiles = downloadFiles;
exports.requestFallback = requestFallback;
exports.pollUntilDone = pollUntilDone;
class TranslationTimeoutError extends Error {
    jobId;
    timeoutSeconds;
    constructor(jobId, timeoutSeconds) {
        super(`Translation did not complete within ${timeoutSeconds} seconds`);
        this.jobId = jobId;
        this.timeoutSeconds = timeoutSeconds;
        this.name = "TranslationTimeoutError";
    }
}
exports.TranslationTimeoutError = TranslationTimeoutError;
class TranslationJobFailedError extends Error {
    jobId;
    constructor(jobId, message) {
        super(message);
        this.jobId = jobId;
        this.name = "TranslationJobFailedError";
    }
}
exports.TranslationJobFailedError = TranslationJobFailedError;
async function request(config, method, path, body, signal) {
    const url = `${config.apiUrl}/v1/${path}`;
    const headers = {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
    };
    const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal,
    });
    const json = (await res.json());
    if (!res.ok) {
        const msg = json.error || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return json;
}
async function createJob(config, opts) {
    const body = {
        files: opts.files,
        target_languages: opts.targetLanguages,
        source_language: opts.sourceLanguage,
        output_mode: "local",
        skip_cache: opts.skipCache,
    };
    if (opts.project) {
        body.project = opts.project;
    }
    return request(config, "POST", "translate", body);
}
async function getJobStatus(config, jobId, signal) {
    return request(config, "GET", `translate/${jobId}`, undefined, signal);
}
async function downloadFiles(config, jobId) {
    return request(config, "GET", `translate/${jobId}/download`);
}
async function requestFallback(config, jobId) {
    return request(config, "POST", `translate/${jobId}/fallback`);
}
async function pollUntilDone(config, jobId, onProgress, options = {}) {
    const pollInterval = options.pollIntervalMs ?? 2000;
    const timeoutSeconds = options.timeoutSeconds;
    const timeoutMs = timeoutSeconds === undefined ? undefined : timeoutSeconds * 1000;
    const deadline = timeoutMs ? Date.now() + timeoutMs : undefined;
    while (true) {
        const remaining = deadline ? deadline - Date.now() : undefined;
        if (remaining !== undefined && remaining <= 0) {
            throw new TranslationTimeoutError(jobId, timeoutSeconds);
        }
        const controller = new AbortController();
        const timer = remaining === undefined
            ? undefined
            : setTimeout(() => controller.abort(), remaining);
        let status;
        try {
            status = await getJobStatus(config, jobId, controller.signal);
        }
        catch (error) {
            if (controller.signal.aborted && timeoutSeconds) {
                throw new TranslationTimeoutError(jobId, timeoutSeconds);
            }
            throw error;
        }
        finally {
            if (timer)
                clearTimeout(timer);
        }
        onProgress(status);
        if (status.status === "completed")
            return status;
        if (status.status === "failed") {
            throw new TranslationJobFailedError(jobId, status.error_message || "Translation job failed");
        }
        if (status.status === "cancelled") {
            throw new Error("Translation job was cancelled");
        }
        const waitMs = remaining === undefined
            ? pollInterval
            : Math.min(pollInterval, Math.max(0, deadline - Date.now()));
        await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
}
