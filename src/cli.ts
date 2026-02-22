#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename, extname } from "node:path";
import { resolveConfig } from "./config.js";
import { createJob, pollUntilDone, downloadFiles } from "./api.js";
import { Spinner } from "./progress.js";

interface ParsedArgs {
  file: string;
  lang: string[];
  source: string;
  output: string;
  apiKey?: string;
  apiUrl?: string;
  noCache: boolean;
}

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
  --api-url             API base URL (default: https://api.autoglot.app)
  --no-cache            Skip translation cache
  --help, -h            Show this help message
  --version, -v         Show version
`);
}

function detectSourceLanguage(filename: string): string {
  const name = basename(filename, extname(filename));
  if (/^[a-z]{2}(-[A-Z]{2})?$/.test(name)) {
    return name.split("-")[0];
  }
  return "en";
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    try {
      const pkgPath = resolve(__dirname, "..", "package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      console.log(pkg.version);
    } catch {
      console.log("unknown");
    }
    process.exit(0);
  }

  let file = "";
  let lang: string[] = [];
  let source = "";
  let output = "";
  let apiKey: string | undefined;
  let apiUrl: string | undefined;
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

  const resolvedFile = resolve(file);
  if (!source) {
    source = detectSourceLanguage(basename(resolvedFile));
  }
  if (!output) {
    output = dirname(resolvedFile);
  }

  return {
    file: resolvedFile,
    lang,
    source,
    output: resolve(output),
    apiKey,
    apiUrl,
    noCache,
  };
}

async function main() {
  const args = parseArgs(process.argv);

  let config;
  try {
    config = resolveConfig({ apiKey: args.apiKey, apiUrl: args.apiUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    process.exit(1);
  }

  // Read source file
  let content: string;
  try {
    content = readFileSync(args.file, "utf-8");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error reading file: ${msg}`);
    process.exit(1);
  }

  const filename = basename(args.file);

  // Try to parse as JSON for structured formats, otherwise send as string
  let fileContent: unknown;
  try {
    fileContent = JSON.parse(content);
  } catch {
    fileContent = content;
  }

  const spinner = new Spinner();

  // Upload
  spinner.start(`Uploading ${filename}...`);
  let jobId: string;
  try {
    const result = await createJob(config, {
      files: [{ filename, content: fileContent as string }],
      targetLanguages: args.lang,
      sourceLanguage: args.source,
      skipCache: args.noCache,
    });
    jobId = result.job_id;
    spinner.stop(`Uploaded ${filename} (job: ${jobId})`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    spinner.stop();
    console.error(`Error: ${msg}`);
    process.exit(1);
  }

  // Poll
  spinner.start("Translating...");
  try {
    await pollUntilDone(config, jobId, (status) => {
      if (status.total_strings > 0) {
        spinner.update(
          `Translating... ${status.completed_strings}/${status.total_strings} strings (${status.progress}%)`
        );
      }
    });
    spinner.stop("Translation complete");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    spinner.stop();
    console.error(`Error: ${msg}`);
    process.exit(1);
  }

  // Download
  spinner.start("Downloading translated files...");
  let outputFiles: Array<{ filename: string; content: string }>;
  try {
    const result = await downloadFiles(config, jobId);
    outputFiles = result.files;
    spinner.stop(`Downloaded ${outputFiles.length} file(s)`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    spinner.stop();
    console.error(`Error: ${msg}`);
    process.exit(1);
  }

  // Write files
  mkdirSync(args.output, { recursive: true });
  for (const file of outputFiles) {
    const outPath = resolve(args.output, file.filename);
    mkdirSync(dirname(outPath), { recursive: true });
    const outContent =
      typeof file.content === "string"
        ? file.content
        : JSON.stringify(file.content, null, 2);
    writeFileSync(outPath, outContent, "utf-8");
    console.log(`  ${file.filename}`);
  }

  console.log(
    `\nTranslated ${filename} into ${args.lang.join(", ")} (${outputFiles.length} file(s))`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
