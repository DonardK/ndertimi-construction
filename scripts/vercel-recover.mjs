#!/usr/bin/env node
/**
 * Vercel deployment source recovery.
 *
 * Usage:
 *   $env:VERCEL_TOKEN="xxx"; $env:VERCEL_TEAM_ID="team_xxx";   # team optional
 *   node scripts/vercel-recover.mjs <deploymentId> [outDir]
 *
 * Example:
 *   node scripts/vercel-recover.mjs 2K6b37HEZ vercel-recovery/2K6b37HEZ
 *
 * Token: https://vercel.com/account/tokens
 * Team ID (if project is in a team): vercel.com → team Settings → General
 */

import fs from "node:fs/promises";
import path from "node:path";

const API = "https://api.vercel.com";
const TOKEN = process.env.VERCEL_TOKEN;
const TEAM = process.env.VERCEL_TEAM_ID || process.env.VERCEL_TEAM_SLUG;

if (!TOKEN) {
  console.error("Missing VERCEL_TOKEN. Create one at https://vercel.com/account/tokens");
  process.exit(1);
}

const depId = process.argv[2];
if (!depId) {
  console.error("Usage: node scripts/vercel-recover.mjs <deploymentId> [outDir]");
  process.exit(1);
}
const outDir = path.resolve(process.argv[3] || `vercel-recovery/${depId}`);

const qs = TEAM ? `?${TEAM.startsWith("team_") ? "teamId" : "slug"}=${encodeURIComponent(TEAM)}` : "";

async function vfetch(url) {
  const res = await fetch(`${API}${url}${url.includes("?") ? "&" : "?"}${qs.slice(1)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${res.statusText} on ${url}\n${txt.slice(0, 500)}`);
  }
  return res;
}

async function getJSON(url) {
  const res = await vfetch(url);
  return res.json();
}

async function getFileContents(deploymentId, fileId) {
  const res = await vfetch(`/v7/deployments/${deploymentId}/files/${fileId}`);
  const data = await res.json();
  // API returns { data: "<base64 or text>" } per docs; handle both shapes
  if (typeof data === "string") return Buffer.from(data, "utf8");
  if (data?.data) return Buffer.from(data.data, "base64");
  return Buffer.from(JSON.stringify(data));
}

/**
 * Walk file tree.
 * Each node: { name, type: 'file'|'directory', uid?, children? }
 */
async function walk(deploymentId, nodes, parent, relPath = "") {
  for (const node of nodes) {
    const rel = path.posix.join(relPath, node.name);
    if (node.type === "directory") {
      await fs.mkdir(path.join(outDir, rel), { recursive: true });
      const children = node.children ?? [];
      await walk(deploymentId, children, parent, rel);
    } else {
      try {
        const buf = await getFileContents(deploymentId, node.uid);
        await fs.mkdir(path.dirname(path.join(outDir, rel)), { recursive: true });
        await fs.writeFile(path.join(outDir, rel), buf);
        console.log(`  saved ${rel}`);
      } catch (e) {
        console.warn(`  skipped ${rel}: ${e.message}`);
      }
    }
  }
}

(async () => {
  await fs.mkdir(outDir, { recursive: true });
  console.log(`Fetching tree for ${depId}…`);

  // v6/v7 returns top-level array of tree nodes
  const tree = await getJSON(`/v6/deployments/${depId}/files`);
  if (!Array.isArray(tree)) {
    console.error("Unexpected response shape:");
    console.error(JSON.stringify(tree, null, 2).slice(0, 800));
    process.exit(2);
  }

  console.log(`Recovering ${depId} → ${outDir}`);
  await walk(depId, tree, null, "");
  console.log("Done.");
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
