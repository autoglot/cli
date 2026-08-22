#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const config_js_1 = require("./config.js");
const api_js_1 = require("./api.js");
const progress_js_1 = require("./progress.js");
function printUsage() {
    console.log(`
Usage: autoglot <file> --lang <codes> [options]

Arguments:
  file                  Source file to translate (en.po, en.json, en.yaml, etc.)

Options:
  --lang, -l            Comma-separated target languages (required)
  --source, -s          Source language (default: auto-detect from filename, fallback "en")
  --output, -o          Output directory (default: same directory as input file)
  --api-key, -k         API key (default: AUTOGLOT_API_KEY env var)
  --project, -p         Project to use for glossary/style guide (owner/repo format)
  --api-url             API base URL (default: https://api.autoglot.app)
  --timeout             Maximum translation wait in seconds, then use the project's cached artifact
  --no-cache            Skip translation cache
  --help, -h            Show this help message
  --version, -v         Show version
`);
}
function detectSourceLanguage(filename) {
    const name = (0, node_path_1.basename)(filename, (0, node_path_1.extname)(filename));
    if (/^[a-z]{2}(-[A-Z]{2})?$/.test(name)) {
        return name.split("-")[0];
    }
    return "en";
}
function parseArgs(argv) {
    const args = argv.slice(2);
    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
        printUsage();
        process.exit(0);
    }
    if (args.includes("--version") || args.includes("-v")) {
        try {
            const pkgPath = (0, node_path_1.resolve)(__dirname, "..", "package.json");
            const pkg = JSON.parse((0, node_fs_1.readFileSync)(pkgPath, "utf-8"));
            console.log(pkg.version);
        }
        catch {
            console.log("unknown");
        }
        process.exit(0);
    }
    let file = "";
    let lang = [];
    let source = "";
    let output = "";
    let apiKey;
    let apiUrl;
    let project;
    let timeoutSeconds;
    let noCache = false;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case "--lang":
            case "-l":
                lang = (args[++i] || "").split(",").filter(Boolean);
                break;
            case "--source":
            case "-s":
                source = args[++i] || "";
                break;
            case "--output":
            case "-o":
                output = args[++i] || "";
                break;
            case "--api-key":
            case "-k":
                apiKey = args[++i];
                break;
            case "--api-url":
                apiUrl = args[++i];
                break;
            case "--project":
            case "-p":
                project = args[++i];
                break;
            case "--timeout": {
                const value = Number(args[++i]);
                if (!Number.isFinite(value) || value <= 0) {
                    console.error("Error: --timeout must be a positive number of seconds");
                    process.exit(1);
                }
                timeoutSeconds = value;
                break;
            }
            case "--no-cache":
                noCache = true;
                break;
            default:
                if (arg.startsWith("-")) {
                    console.error(`Unknown option: ${arg}`);
                    process.exit(1);
                }
                file = arg;
        }
    }
    if (!file) {
        console.error("Error: source file is required");
        process.exit(1);
    }
    if (lang.length === 0) {
        console.error("Error: --lang is required");
        process.exit(1);
    }
    if (timeoutSeconds !== undefined && !project) {
        console.error("Error: --project is required with --timeout so cached translations cannot cross projects");
        process.exit(1);
    }
    const resolvedFile = (0, node_path_1.resolve)(file);
    if (!source) {
        source = detectSourceLanguage((0, node_path_1.basename)(resolvedFile));
    }
    if (!output) {
        output = (0, node_path_1.dirname)(resolvedFile);
    }
    return {
        file: resolvedFile,
        lang,
        source,
        output: (0, node_path_1.resolve)(output),
        apiKey,
        apiUrl,
        project,
        timeoutSeconds,
        noCache,
    };
}
async function main() {
    const args = parseArgs(process.argv);
    let config;
    try {
        config = (0, config_js_1.resolveConfig)({ apiKey: args.apiKey, apiUrl: args.apiUrl });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${msg}`);
        process.exit(1);
    }
    // Read source file
    let content;
    try {
        content = (0, node_fs_1.readFileSync)(args.file, "utf-8");
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error reading file: ${msg}`);
        process.exit(1);
    }
    const filename = (0, node_path_1.basename)(args.file);
    // Try to parse as JSON for structured formats, otherwise send as string
    let fileContent;
    try {
        fileContent = JSON.parse(content);
    }
    catch {
        fileContent = content;
    }
    const spinner = new progress_js_1.Spinner();
    // Upload
    spinner.start(`Uploading ${filename}...`);
    let jobId;
    try {
        const result = await (0, api_js_1.createJob)(config, {
            files: [{ filename, content: fileContent }],
            targetLanguages: args.lang,
            sourceLanguage: args.source,
            skipCache: args.noCache,
            project: args.project,
        });
        jobId = result.job_id;
        spinner.stop(`Uploaded ${filename} (job: ${jobId})`);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        spinner.stop();
        console.error(`Error: ${msg}`);
        process.exit(1);
    }
    // Poll
    spinner.start("Translating...");
    let outputFiles;
    let usedFallback = false;
    try {
        await (0, api_js_1.pollUntilDone)(config, jobId, (status) => {
            if (status.total_strings > 0) {
                spinner.update(`Translating... ${status.completed_strings}/${status.total_strings} strings (${status.progress}%)`);
            }
        }, { timeoutSeconds: args.timeoutSeconds });
        spinner.stop("Translation complete");
    }
    catch (err) {
        const fallbackEligible = err instanceof api_js_1.TranslationTimeoutError ||
            err instanceof api_js_1.TranslationJobFailedError;
        if (args.timeoutSeconds !== undefined && fallbackEligible) {
            const reason = err instanceof api_js_1.TranslationTimeoutError ? "timed out" : "failed";
            spinner.stop(`Translation ${reason}; loading the latest compatible cached translations...`);
            try {
                const fallback = await (0, api_js_1.requestFallback)(config, jobId);
                outputFiles = fallback.files;
                usedFallback = fallback.fallback_used;
            }
            catch (fallbackError) {
                const msg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
                console.error(`Error: ${msg}`);
                process.exit(1);
            }
        }
        else {
            const msg = err instanceof Error ? err.message : String(err);
            spinner.stop();
            console.error(`Error: ${msg}`);
            process.exit(1);
        }
    }
    // Download
    if (!outputFiles) {
        spinner.start("Downloading translated files...");
        try {
            const result = await (0, api_js_1.downloadFiles)(config, jobId);
            outputFiles = result.files;
            spinner.stop(`Downloaded ${outputFiles.length} file(s)`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            spinner.stop();
            console.error(`Error: ${msg}`);
            process.exit(1);
        }
    }
    // Write files
    (0, node_fs_1.mkdirSync)(args.output, { recursive: true });
    for (const file of outputFiles) {
        const outPath = (0, node_path_1.resolve)(args.output, file.filename);
        (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(outPath), { recursive: true });
        const outContent = typeof file.content === "string"
            ? file.content
            : JSON.stringify(file.content, null, 2);
        (0, node_fs_1.writeFileSync)(outPath, outContent, "utf-8");
        console.log(`  ${file.filename}`);
    }
    console.log(`\n${usedFallback ? "Used cached translations for" : "Translated"} ${filename} into ${args.lang.join(", ")} (${outputFiles.length} file(s))`);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
