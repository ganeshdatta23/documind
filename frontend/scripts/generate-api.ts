#!/usr/bin/env tsx
/**
 * DocuMind API Code Generator
 * ============================================================
 * Fetches /api/openapi.json from the backend and generates:
 *
 *   lib/generated/
 *     schema.ts          ← All TypeScript types (via openapi-typescript)
 *     client.ts          ← Typed fetch API client (one function per operation)
 *
 *   hooks/generated/
 *     use{Tag}.ts        ← React Query hooks per OpenAPI tag
 *     index.ts           ← Barrel re-export
 *
 * Usage:
 *   npm run generate-api                   (backend at localhost:8000)
 *   npm run generate-api -- --url http://staging.api.com
 *   npm run generate-api -- --file ./openapi.json
 *
 * ============================================================
 */

import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

// ─── CLI Arguments ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag: string) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};
const API_URL = getArg("--url") ?? "http://localhost:8000";
const LOCAL_FILE = getArg("--file");

// ─── Output Paths ─────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, "..");
const GENERATED_LIB = path.join(ROOT, "lib", "generated");
const GENERATED_HOOKS = path.join(ROOT, "hooks", "generated");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mkdirp(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function write(filePath: string, content: string) {
  fs.writeFileSync(filePath, content, "utf-8");
  console.log(`  ✅ ${path.relative(ROOT, filePath)}`);
}

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error(`Failed to parse JSON from ${url}`)); }
        });
      })
      .on("error", reject);
  });
}

/** Convert an OpenAPI path like /api/v1/documents/{id} → camelCase operationId */
function pathToOperationName(method: string, path: string): string {
  const parts = path
    .replace(/^\/api\/v\d+\//, "")
    .split("/")
    .map((p) =>
      p.startsWith("{")
        ? "By" + p.slice(1, -1).charAt(0).toUpperCase() + p.slice(2, -1)
        : p.charAt(0).toUpperCase() + p.slice(1)
    );
  return method.toLowerCase() + parts.join("");
}

/** Derive a resource tag from a path segment */
function getResourceFromPath(p: string): string {
  const seg = p.replace(/^\/api\/v\d+\//, "").split("/")[0];
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

/** Map OpenAPI schema to TypeScript type string (simplified) */
function schemaToTs(schema: any, indent = 0): string {
  if (!schema) return "unknown";
  const pad = "  ".repeat(indent);

  if (schema.$ref) {
    const parts = schema.$ref.split("/");
    return parts[parts.length - 1];
  }
  switch (schema.type) {
    case "string":
      return schema.enum
        ? schema.enum.map((e: string) => `"${e}"`).join(" | ")
        : "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return `Array<${schemaToTs(schema.items, indent)}>`;
    case "object":
      if (!schema.properties) return "Record<string, unknown>";
      const props = Object.entries(schema.properties)
        .map(([k, v]: [string, any]) => {
          const required = schema.required?.includes(k) ? "" : "?";
          const nullable = v.nullable ? " | null" : "";
          return `${pad}  ${k}${required}: ${schemaToTs(v, indent + 1)}${nullable};`;
        })
        .join("\n");
      return `{\n${props}\n${pad}}`;
    default:
      if (schema.anyOf || schema.oneOf) {
        const variants = (schema.anyOf ?? schema.oneOf).map((s: any) =>
          schemaToTs(s, indent)
        );
        return variants.join(" | ");
      }
      return "unknown";
  }
}

// ─── Type Generator ──────────────────────────────────────────────────────────

function generateSchemaTs(spec: any): string {
  const schemas = spec.components?.schemas ?? {};
  const lines: string[] = [
    "// AUTO-GENERATED — do not edit manually",
    "// Run: npm run generate-api",
    "",
  ];

  for (const [name, schema] of Object.entries<any>(schemas)) {
    if (schema.enum) {
      lines.push(`export type ${name} = ${schema.enum.map((e: string) => `"${e}"`).join(" | ")};`);
      continue;
    }
    if (schema.type === "object" || schema.allOf || schema.properties) {
      const props = schema.properties ?? {};
      const required: string[] = schema.required ?? [];
      const fields = Object.entries<any>(props).map(([k, v]) => {
        const opt = required.includes(k) ? "" : "?";
        const nullable = v.nullable ? " | null" : "";
        return `  ${k}${opt}: ${schemaToTs(v)}${nullable};`;
      });
      lines.push(`export interface ${name} {`);
      lines.push(...fields);
      lines.push("}");
      lines.push("");
    }
  }
  return lines.join("\n");
}

// ─── Client Generator ────────────────────────────────────────────────────────

interface OperationInfo {
  operationId: string;
  method: string;
  path: string;
  tag: string;
  summary: string;
  hasBody: boolean;
  hasPathParams: boolean;
  hasQueryParams: boolean;
  requestBodySchema?: string;
  responseSchema?: string;
  pathParams: string[];
  queryParams: Array<{ name: string; required: boolean; type: string }>;
}

function extractOperations(spec: any): OperationInfo[] {
  const ops: OperationInfo[] = [];
  for (const [rawPath, pathItem] of Object.entries<any>(spec.paths ?? {})) {
    for (const method of ["get", "post", "patch", "put", "delete"]) {
      const op = pathItem[method];
      if (!op) continue;

      const tag = op.tags?.[0] ?? getResourceFromPath(rawPath);
      const operationId =
        op.operationId ?? pathToOperationName(method, rawPath);

      // Path params
      const pathParams = (rawPath.match(/\{([^}]+)\}/g) ?? []).map((p: string) =>
        p.slice(1, -1)
      );

      // Query params
      const queryParams = (op.parameters ?? [])
        .filter((p: any) => p.in === "query")
        .map((p: any) => ({
          name: p.name,
          required: !!p.required,
          type: schemaToTs(p.schema),
        }));

      // Body schema
      const bodyContent = op.requestBody?.content?.["application/json"]?.schema;
      const bodyRef = bodyContent?.$ref?.split("/").pop() ?? null;
      const bodyInline = bodyContent && !bodyRef ? schemaToTs(bodyContent) : null;

      // Response schema
      const resp200 =
        op.responses?.["200"]?.content?.["application/json"]?.schema ??
        op.responses?.["201"]?.content?.["application/json"]?.schema;
      const respRef = resp200?.$ref?.split("/").pop() ?? null;

      ops.push({
        operationId: operationId.replace(/-/g, "_"),
        method,
        path: rawPath,
        tag,
        summary: op.summary ?? "",
        hasBody: !!op.requestBody,
        hasPathParams: pathParams.length > 0,
        hasQueryParams: queryParams.length > 0,
        requestBodySchema: bodyRef ?? (bodyInline ? "unknown" : undefined),
        responseSchema: respRef ?? undefined,
        pathParams,
        queryParams,
      });
    }
  }
  return ops;
}

function generateClientTs(spec: any, ops: OperationInfo[]): string {
  const lines: string[] = [
    "// AUTO-GENERATED — do not edit manually",
    "// Run: npm run generate-api",
    "",
    'import type * as Schema from "./schema";',
    'import { apiRequest } from "../http-client";',
    "",
  ];

  // Group by tag
  const byTag: Record<string, OperationInfo[]> = {};
  for (const op of ops) {
    byTag[op.tag] = byTag[op.tag] ?? [];
    byTag[op.tag].push(op);
  }

  for (const [tag, tagOps] of Object.entries(byTag)) {
    lines.push(`// ─── ${tag} ───────────────────────────────────────────────`);
    for (const op of tagOps) {
      const returnType = op.responseSchema
        ? `Schema.${op.responseSchema}`
        : "unknown";

      // Build parameter list
      const params: string[] = [];
      if (op.hasPathParams) {
        params.push(`pathParams: { ${op.pathParams.map((p) => `${p}: string`).join("; ")} }`);
      }
      if (op.hasBody) {
        const bodyType = op.requestBodySchema ? `Schema.${op.requestBodySchema}` : "unknown";
        params.push(`body: ${bodyType}`);
      }
      if (op.hasQueryParams) {
        const qpType = op.queryParams
          .map((q) => `${q.name}${q.required ? "" : "?"}:${q.type}`)
          .join("; ");
        params.push(`query?: { ${qpType} }`);
      }

      // Build URL
      let urlExpr = `\`${op.path.replace(/{([^}]+)}/g, "${pathParams.$1}")}\``;
      if (!op.hasPathParams) {
        urlExpr = `"${op.path}"`;
      }

      lines.push(`/** ${op.summary} */`);
      lines.push(
        `export async function ${op.operationId}(${params.join(", ")}): Promise<${returnType}> {`
      );
      lines.push(
        `  return apiRequest<${returnType}>({`
      );
      lines.push(`    method: "${op.method.toUpperCase()}",`);
      lines.push(`    url: ${urlExpr},`);
      if (op.hasBody) lines.push("    body,");
      if (op.hasQueryParams) lines.push("    params: query,");
      lines.push("  });");
      lines.push("}");
      lines.push("");
    }
  }
  return lines.join("\n");
}

// ─── Hook Generator ───────────────────────────────────────────────────────────

const QUERY_METHODS = new Set(["get"]);

function generateHookFile(tag: string, ops: OperationInfo[]): string {
  const lines: string[] = [
    "// AUTO-GENERATED — do not edit manually",
    "// Run: npm run generate-api",
    "",
    '"use client";',
    "",
    'import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";',
    `import * as api from "@/lib/generated/client";`,
    `import type * as Schema from "@/lib/generated/schema";`,
    "",
    `export const ${tag.toLowerCase()}Keys = {`,
    `  all: ["${tag.toLowerCase()}"] as const,`,
  ];

  // Emit query keys for GET operations
  for (const op of ops.filter((o) => QUERY_METHODS.has(o.method))) {
    if (op.hasPathParams) {
      const pList = op.pathParams.map((p) => `${p}: string`).join(", ");
      lines.push(`  ${op.operationId}: (${pList}) => [...${tag.toLowerCase()}Keys.all, "${op.operationId}", ${op.pathParams.join(", ")}] as const,`);
    } else {
      lines.push(`  ${op.operationId}: (params?: object) => [...${tag.toLowerCase()}Keys.all, "${op.operationId}", params] as const,`);
    }
  }
  lines.push("} as const;", "");

  // Emit hooks
  for (const op of ops) {
    const hookName =
      "use" +
      op.operationId.charAt(0).toUpperCase() +
      op.operationId.slice(1);

    if (QUERY_METHODS.has(op.method)) {
      // useQuery hook
      const pList = op.hasPathParams
        ? op.pathParams.map((p) => `${p}: string`).join(", ")
        : "";
      const qpList = op.hasQueryParams
        ? `params?: { ${op.queryParams.map((q) => `${q.name}${q.required ? "" : "?"}: ${q.type}`).join("; ")} }`
        : "";
      const argList = [pList, qpList].filter(Boolean).join(", ");
      const keyCall = op.hasPathParams
        ? `${tag.toLowerCase()}Keys.${op.operationId}(${op.pathParams.join(", ")})`
        : `${tag.toLowerCase()}Keys.${op.operationId}(${op.hasQueryParams ? "params" : ""})`;
      const apiFnArgs: string[] = [];
      if (op.hasPathParams) apiFnArgs.push(`{ ${op.pathParams.map((p) => `${p}`).join(", ")} }`);
      if (op.hasQueryParams) apiFnArgs.push("params");
      const enabledGuard = op.hasPathParams
        ? `enabled: ${op.pathParams.map((p) => `!!${p}`).join(" && ")},`
        : "";

      lines.push(`/** ${op.summary} */`);
      lines.push(`export function ${hookName}(${argList}) {`);
      lines.push(`  return useQuery({`);
      lines.push(`    queryKey: ${keyCall},`);
      lines.push(`    queryFn: () => api.${op.operationId}(${apiFnArgs.join(", ")}),`);
      if (enabledGuard) lines.push(`    ${enabledGuard}`);
      lines.push("    staleTime: 30_000,");
      lines.push("  });");
      lines.push("}");
      lines.push("");
    } else {
      // useMutation hook
      lines.push(`/** ${op.summary} */`);
      lines.push(`export function ${hookName}() {`);
      lines.push(`  const qc = useQueryClient();`);
      lines.push(`  return useMutation({`);
      lines.push(`    mutationFn: api.${op.operationId},`);
      lines.push(`    onSuccess: () => {`);
      lines.push(`      qc.invalidateQueries({ queryKey: ${tag.toLowerCase()}Keys.all });`);
      lines.push(`    },`);
      lines.push("  });");
      lines.push("}");
      lines.push("");
    }
  }
  return lines.join("\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🚀 DocuMind API Codegen");
  console.log("─".repeat(50));

  // 1. Load spec
  let spec: any;
  if (LOCAL_FILE) {
    console.log(`📂 Reading spec from ${LOCAL_FILE}`);
    spec = JSON.parse(fs.readFileSync(LOCAL_FILE, "utf-8"));
  } else {
    const specUrl = `${API_URL}/api/openapi.json`;
    console.log(`🌐 Fetching spec from ${specUrl}`);
    spec = await fetchJson(specUrl);
  }

  console.log(`✔  Loaded spec: ${spec.info?.title} v${spec.info?.version}`);
  console.log(`   Paths: ${Object.keys(spec.paths ?? {}).length}`);
  console.log(`   Schemas: ${Object.keys(spec.components?.schemas ?? {}).length}`);
  console.log("");

  // 2. Setup output dirs
  mkdirp(GENERATED_LIB);
  mkdirp(GENERATED_HOOKS);

  // 3. Extract operations
  const ops = extractOperations(spec);
  console.log(`📋 Found ${ops.length} operations`);
  console.log("");

  // 4. Generate schema types
  console.log("📝 Generating types...");
  write(path.join(GENERATED_LIB, "schema.ts"), generateSchemaTs(spec));

  // 5. Generate typed API client
  console.log("🔌 Generating API client...");
  write(path.join(GENERATED_LIB, "client.ts"), generateClientTs(spec, ops));

  // 6. Group by tag, generate hooks
  console.log("🪝 Generating React Query hooks...");
  const byTag: Record<string, OperationInfo[]> = {};
  for (const op of ops) {
    const tag = op.tag.replace(/\s+/g, "");
    byTag[tag] = byTag[tag] ?? [];
    byTag[tag].push(op);
  }

  const hookFiles: string[] = [];
  for (const [tag, tagOps] of Object.entries(byTag)) {
    const fileName = `use${tag}.ts`;
    const outPath = path.join(GENERATED_HOOKS, fileName);
    write(outPath, generateHookFile(tag, tagOps));
    hookFiles.push(tag);
  }

  // 7. Barrel export
  const barrel = [
    "// AUTO-GENERATED — do not edit manually",
    "// Run: npm run generate-api",
    "",
    ...hookFiles.map((tag) => `export * from "./use${tag}";`),
  ].join("\n");
  write(path.join(GENERATED_HOOKS, "index.ts"), barrel);

  // 8. Save a copy of the spec for offline use
  write(
    path.join(GENERATED_LIB, "openapi.json"),
    JSON.stringify(spec, null, 2)
  );

  console.log("");
  console.log("✅ Codegen complete!");
  console.log(`   Tags generated: ${hookFiles.join(", ")}`);
  console.log("");
}

main().catch((err) => {
  console.error("❌ Codegen failed:", err.message);
  process.exit(1);
});
