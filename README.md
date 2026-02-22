# @autoglot/cli

Translate i18n files from the command line. Supports JSON, YAML, PO/POT, and Xcode String Catalogs.

## Quick start

```bash
npx @autoglot/cli en.json --lang es,fr,de
```

## Setup

1. Sign up at [autoglot.app](https://autoglot.app)
2. Go to [dashboard / API keys](https://autoglot.app/dashboard/api-keys) and create a key
3. Export it:

```bash
export AUTOGLOT_API_KEY=your_key_here
```

## CLI usage

```
autoglot <file> --lang <codes> [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `file` | Source file to translate (e.g. `en.json`, `en.po`, `messages.yaml`) |

### Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--lang` | `-l` | (required) | Comma-separated target languages |
| `--source` | `-s` | Auto-detect from filename, fallback `en` | Source language code |
| `--output` | `-o` | Same directory as input file | Output directory for translated files |
| `--api-key` | `-k` | `AUTOGLOT_API_KEY` env var | API key |
| `--api-url` | | `https://api.autoglot.app` | API base URL |
| `--no-cache` | | `false` | Skip translation cache |
| `--help` | `-h` | | Show help |
| `--version` | `-v` | | Show version |

### Examples

Translate a JSON file into Spanish, French, and German:

```bash
npx @autoglot/cli src/locales/en.json --lang es,fr,de
```

Translate a PO file with explicit source language and output directory:

```bash
npx @autoglot/cli messages.po --lang ja,ko --source en --output ./translations
```

Skip cache to force re-translation:

```bash
npx @autoglot/cli en.yaml --lang pt-BR --no-cache
```

## Library usage

`@autoglot/cli` also exports a `translate()` function for use in Node.js scripts and other tools (like `@autoglot/next`).

```typescript
import { translate } from '@autoglot/cli';
import { readFileSync } from 'fs';

const files = await translate({
  files: [{ filename: 'en.json', content: readFileSync('en.json', 'utf-8') }],
  targetLanguages: ['es', 'fr', 'de'],
  sourceLanguage: 'en',
  apiKey: process.env.AUTOGLOT_API_KEY!,
  onProgress: (status) => {
    console.log(`${status.completed_strings}/${status.total_strings}`);
  },
});

for (const file of files) {
  console.log(file.filename, file.content.length);
}
```

### `translate(options)`

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `files` | `{ filename: string; content: string }[]` | Yes | | Files to translate |
| `targetLanguages` | `string[]` | Yes | | Target language codes |
| `sourceLanguage` | `string` | Yes | | Source language code |
| `apiKey` | `string` | Yes | | API key |
| `apiUrl` | `string` | No | `https://api.autoglot.app` | API base URL |
| `skipCache` | `boolean` | No | `false` | Skip translation cache |
| `onProgress` | `(status: JobStatus) => void` | No | | Progress callback |

Returns `Promise<{ filename: string; content: string }[]>` — the translated files.

### `JobStatus`

The object passed to `onProgress`:

| Field | Type | Description |
|-------|------|-------------|
| `job_id` | `string` | Job identifier |
| `status` | `string` | `processing`, `completed`, or `failed` |
| `progress` | `number` | Percentage (0–100) |
| `total_strings` | `number` | Total strings to translate |
| `completed_strings` | `number` | Strings translated so far |
| `error_message` | `string?` | Error details if failed |

## Supported file formats

| Format | Extension |
|--------|-----------|
| JSON | `.json` |
| YAML | `.yml`, `.yaml` |
| PO/POT | `.po`, `.pot` |
| Xcode String Catalog | `.xcstrings` |

## Supported languages

| Code | Language | Code | Language |
|------|----------|------|----------|
| `de` | German | `ja` | Japanese |
| `fr` | French | `ko` | Korean |
| `es` | Spanish | `zh-Hans` | Simplified Chinese |
| `it` | Italian | `zh-Hant` | Traditional Chinese |
| `pt` | Portuguese | `ar` | Arabic |
| `pt-BR` | Brazilian Portuguese | `he` | Hebrew |
| `nl` | Dutch | `hi` | Hindi |
| `pl` | Polish | `th` | Thai |
| `ru` | Russian | `vi` | Vietnamese |
| `uk` | Ukrainian | `id` | Indonesian |
| `tr` | Turkish | `ms` | Malay |
| `sv` | Swedish | `cs` | Czech |
| `da` | Danish | `hu` | Hungarian |
| `fi` | Finnish | `ro` | Romanian |
| `nb` | Norwegian | `sk` | Slovak |
| `el` | Greek | `bg` | Bulgarian |

## Links

- [autoglot dashboard](https://autoglot.app/dashboard)
- [Get API key](https://autoglot.app/dashboard/api-keys)
- [Report issues](https://github.com/autoglot/cli/issues)
