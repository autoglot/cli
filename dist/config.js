"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveConfig = resolveConfig;
const DEFAULT_API_URL = "https://api.autoglot.app";
function resolveConfig(opts) {
    const apiKey = opts.apiKey || process.env.AUTOGLOT_API_KEY || "";
    if (!apiKey) {
        throw new Error("API key is required. Provide --api-key or set AUTOGLOT_API_KEY.");
    }
    return {
        apiKey,
        apiUrl: opts.apiUrl || process.env.AUTOGLOT_API_URL || DEFAULT_API_URL,
    };
}
