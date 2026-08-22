"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationTimeoutError = exports.TranslationJobFailedError = void 0;
exports.translate = translate;
const config_js_1 = require("./config.js");
const api_js_1 = require("./api.js");
var api_js_2 = require("./api.js");
Object.defineProperty(exports, "TranslationJobFailedError", { enumerable: true, get: function () { return api_js_2.TranslationJobFailedError; } });
Object.defineProperty(exports, "TranslationTimeoutError", { enumerable: true, get: function () { return api_js_2.TranslationTimeoutError; } });
async function translate(opts) {
    const config = (0, config_js_1.resolveConfig)({ apiKey: opts.apiKey, apiUrl: opts.apiUrl });
    if (opts.timeoutSeconds !== undefined) {
        if (!Number.isFinite(opts.timeoutSeconds) || opts.timeoutSeconds <= 0) {
            throw new Error("timeoutSeconds must be a positive number");
        }
        if (!opts.project) {
            throw new Error("project is required when timeoutSeconds is set so cached translations cannot cross projects");
        }
    }
    const { job_id: jobId } = await (0, api_js_1.createJob)(config, {
        files: opts.files,
        targetLanguages: opts.targetLanguages,
        sourceLanguage: opts.sourceLanguage,
        skipCache: opts.skipCache ?? false,
        project: opts.project,
    });
    try {
        await (0, api_js_1.pollUntilDone)(config, jobId, opts.onProgress ?? (() => { }), { timeoutSeconds: opts.timeoutSeconds });
    }
    catch (error) {
        const fallbackEligible = error instanceof api_js_1.TranslationTimeoutError ||
            error instanceof api_js_1.TranslationJobFailedError;
        if (opts.timeoutSeconds === undefined || !fallbackEligible)
            throw error;
        const fallback = await (0, api_js_1.requestFallback)(config, jobId);
        return fallback.files;
    }
    const result = await (0, api_js_1.downloadFiles)(config, jobId);
    return result.files;
}
