#!/usr/bin/env tsx
/**
 * DocuMind API Type Generator
 * ============================================================
 * Turns the backend's live OpenAPI spec into TypeScript types. Runs
 * automatically before `npm run dev` and `npm run build` via npm lifecycle
 * hooks (predev / prebuild, in --safe mode).
 *
 * This is intentionally *types-only*. The spec is the single source of truth
 * for the SHAPE of the API; the typed REST client (lib/api-client.ts), the SSE
 * helpers (lib/api.ts), and the React Query hooks (hooks/*.ts) are written once
 * by hand on top of these types — because streaming, multipart upload progress,
 * status polling, and bespoke cache keys are things a generator can't express
 * well. When the API changes, the types regenerate and `tsc` points you at the
 * one hand-written call site that needs updating.
 *
 * Strategy (in order):
 *   1. Try fetching the live spec from --url (default: localhost:8000)
 *   2. Fall back to the saved lib/generated/openapi.json snapshot if present
 *   3. If neither is available, write a placeholder and exit 0 (non-blocking)
 *
 * Usage:
 *   npm run generate-api                       # auto (backend at localhost:8000)
 *   npm run generate-api -- --url http://...   # specific URL
 *   npm run generate-api -- --file ./spec.json # specific file
 *   npm run generate-api -- --safe             # never fail (used by predev)
 *
 * Output (the only two files written):
 *   lib/generated/schema.ts      all TypeScript types, derived from the spec
 *   lib/generated/openapi.json   spec snapshot (offline fallback + drift check)
 *
 * Output is deterministic — no timestamps — so the committed files only change
 * when the API genuinely changes, not on every dev start.
 * ============================================================
 */

/* eslint-disable @typescript-eslint/no-explicit-any --
 * This is a build-time script that walks an untyped OpenAPI JSON document. Every
 * spec node is dynamically shaped, so `any` is the pragmatic type here rather
 * than threading a partial OpenAPI type model through a throwaway generator. */
import fs from "fs";
import path from "path";
import http from "http";
import https from "https";

// ─── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag: string) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};
const SAFE_MODE = args.includes("--safe");
const API_URL = getArg("--url") ?? "http://localhost:8000";
const LOCAL_FILE = getArg("--file");

// ─── Paths ────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..");
const GENERATED_LIB = path.join(ROOT, "lib", "generated");
const SCHEMA_PATH = path.join(GENERATED_LIB, "schema.ts");
const SNAPSHOT_PATH = path.join(GENERATED_LIB, "openapi.json");

// ─── Utilities ────────────────────────────────────────────────────────────────

function mkdirp(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function write(filePath: string, content: string) {
  fs.writeFileSync(filePath, content, "utf-8");
  console.log(`  ✅  ${path.relative(ROOT, filePath)}`);
}

function fetchJson(url: string, timeoutMs = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} from ${url}`));
        return;
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("Invalid JSON in response"));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timeout fetching ${url}`));
    });
  });
}

// ─── Schema → TypeScript ──────────────────────────────────────────────────────

function schemaToTs(schema: any, depth = 0): string {
  if (!schema) return "unknown";
  if (schema.$ref) {
    // "#/components/schemas/Foo" → "Foo"
    return schema.$ref.split("/").pop()!;
  }
  // FastAPI/Pydantic v2 emit OpenAPI 3.1, where a nullable field is modelled as
  // anyOf: [ {real type}, {type: "null"} ]. Mapping each branch (and handling
  // the "null" type below) is what turns that into a clean `T | null` instead
  // of the lossy `T | unknown` an unrecognised branch would produce.
  if (schema.anyOf || schema.oneOf) {
    const parts = (schema.anyOf ?? schema.oneOf).map((s: any) =>
      schemaToTs(s, depth)
    );
    // De-dupe so anyOf:[string, null, null] doesn't become "string | null | null".
    return Array.from(new Set(parts)).join(" | ");
  }
  switch (schema.type) {
    case "null":
      return "null";
    case "string":
      // date-time, uuid, etc. all serialise as strings over the wire.
      return "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return `Array<${schemaToTs(schema.items, depth)}>`;
    case "object": {
      if (!schema.properties) return "Record<string, unknown>";
      const pad = "  ".repeat(depth + 1);
      const fields = Object.entries<any>(schema.properties).map(([k, v]) => {
        const opt = schema.required?.includes(k) ? "" : "?";
        const nullable = v.nullable ? " | null" : ""; // OpenAPI 3.0 fallback
        return `${pad}${k}${opt}: ${schemaToTs(v, depth + 1)}${nullable};`;
      });
      return `{\n${fields.join("\n")}\n${"  ".repeat(depth)}}`;
    }
    default:
      // enums show up as type:string with an `enum` array; handled by the
      // string case above for inline use, and by generateSchemaTs at top level.
      if (schema.enum) {
        return schema.enum.map((e: string) => `"${e}"`).join(" | ");
      }
      return "unknown";
  }
}

function generateSchemaTs(spec: any): string {
  const schemas = spec.components?.schemas ?? {};
  const lines: string[] = [
    "// AUTO-GENERATED by scripts/generate-api.ts — do not edit manually.",
    `// Source: ${spec.info?.title ?? "API"} v${spec.info?.version ?? "?"}`,
    "// These are the single source of truth for API shapes; lib/types.ts aliases",
    "// them and the hand-written client/hooks build on top.",
    "",
  ];

  for (const [name, schema] of Object.entries<any>(schemas)) {
    if (schema.enum) {
      lines.push(
        `export type ${name} = ${schema.enum
          .map((e: string) => `"${e}"`)
          .join(" | ")};`
      );
      lines.push("");
      continue;
    }
    if (schema.allOf) {
      const refs = schema.allOf
        .filter((s: any) => s.$ref)
        .map((s: any) => s.$ref.split("/").pop());
      const inline = schema.allOf.find((s: any) => s.properties);
      if (refs.length > 0 && !inline) {
        lines.push(`export type ${name} = ${refs.join(" & ")};`);
      } else {
        lines.push(`export interface ${name} extends ${refs.join(", ")} {`);
        if (inline?.properties) {
          for (const [k, v] of Object.entries<any>(inline.properties)) {
            const opt = inline.required?.includes(k) ? "" : "?";
            lines.push(`  ${k}${opt}: ${schemaToTs(v)};`);
          }
        }
        lines.push("}");
      }
      lines.push("");
      continue;
    }
    if (schema.type === "object" || schema.properties) {
      const props = schema.properties ?? {};
      const required: string[] = schema.required ?? [];
      lines.push(`export interface ${name} {`);
      for (const [k, v] of Object.entries<any>(props)) {
        const opt = required.includes(k) ? "" : "?";
        const nullable = v.nullable ? " | null" : ""; // OpenAPI 3.0 fallback
        lines.push(`  ${k}${opt}: ${schemaToTs(v)}${nullable};`);
      }
      lines.push("}");
      lines.push("");
    }
  }
  return lines.join("\n");
}

// ─── Placeholder (when the backend is unavailable on a fresh checkout) ─────────

function generatePlaceholder() {
  mkdirp(GENERATED_LIB);
  // Only write a placeholder if there's nothing there yet — never clobber a
  // real, previously-generated schema.
  if (fs.existsSync(SCHEMA_PATH)) return;
  write(
    SCHEMA_PATH,
    [
      "// AUTO-GENERATED placeholder — run `npm run generate-api` with the backend running.",
      "// This file will be replaced once the backend's OpenAPI spec is reachable.",
      "",
      "export interface Placeholder { _placeholder: true }",
    ].join("\n")
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🚀  DocuMind API Type Codegen");
  console.log("─".repeat(50));

  mkdirp(GENERATED_LIB);

  // 1. Load the OpenAPI spec.
  let spec: any = null;

  if (LOCAL_FILE) {
    console.log(`📂  Reading spec from: ${LOCAL_FILE}`);
    try {
      spec = JSON.parse(fs.readFileSync(LOCAL_FILE, "utf-8"));
    } catch (err: any) {
      console.error(`❌  Cannot read file: ${err.message}`);
    }
  } else {
    const specUrl = `${API_URL}/api/openapi.json`;
    console.log(`🌐  Fetching spec from: ${specUrl}`);
    try {
      spec = await fetchJson(specUrl);
      console.log(`✔   Connected to backend`);
    } catch (err: any) {
      console.warn(`⚠   Backend unavailable: ${err.message}`);
      // Fall back to the committed snapshot so offline builds still type-check.
      if (fs.existsSync(SNAPSHOT_PATH)) {
        console.log(`📦  Using cached snapshot: ${SNAPSHOT_PATH}`);
        try {
          spec = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf-8"));
        } catch {
          spec = null;
        }
      }
    }
  }

  // 2. Graceful fallback when there's no spec at all.
  if (!spec) {
    if (SAFE_MODE) {
      console.warn(
        "\n⚠   No spec available — writing a placeholder.\n" +
          "    Start the backend and run: npm run generate-api\n"
      );
      generatePlaceholder();
      process.exit(0);
    } else {
      console.error("\n❌  No spec available. Use --safe to skip gracefully.");
      process.exit(1);
    }
  }

  const schemaCount = Object.keys(spec.components?.schemas ?? {}).length;
  const pathCount = Object.keys(spec.paths ?? {}).length;
  console.log(`✔   Loaded: ${spec.info?.title} v${spec.info?.version}`);
  console.log(`    Paths: ${pathCount}  |  Schemas: ${schemaCount}`);
  console.log("");

  // 3. Generate the types.
  console.log("📝  Generating schema types…");
  write(SCHEMA_PATH, generateSchemaTs(spec));

  // 4. Save a pretty-printed snapshot (offline fallback + drift check baseline).
  write(SNAPSHOT_PATH, JSON.stringify(spec, null, 2) + "\n");

  console.log("");
  console.log(`✅  Codegen complete!  ${schemaCount} types written.`);
  console.log("");
}

main().catch((err) => {
  if (SAFE_MODE) {
    console.warn(`\n⚠   Codegen failed (safe mode): ${err.message}\n`);
    generatePlaceholder();
    process.exit(0);
  } else {
    console.error(`\n❌  Codegen failed: ${err.message}`);
    process.exit(1);
  }
});
