import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { getStorePackageFileName } from "./store-release.mjs";

const rootDir = resolve(import.meta.dirname, "..");
const distDir = resolve(rootDir, "dist");
const releasesDir = resolve(rootDir, "releases");
const packageJsonPath = resolve(rootDir, "package.json");

async function readPackageVersion() {
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  if (!packageJson.version || typeof packageJson.version !== "string") {
    throw new Error("package.json is missing a valid version");
  }
  return packageJson.version;
}

async function ensureDistExists() {
  const distStat = await stat(distDir).catch(() => null);
  if (!distStat?.isDirectory()) {
    throw new Error("dist/ does not exist. Run `npm run build` first.");
  }
  const manifestStat = await stat(resolve(distDir, "manifest.json")).catch(() => null);
  if (!manifestStat?.isFile()) {
    throw new Error("dist/manifest.json is missing. Build output is not ready for packaging.");
  }
}

async function packStoreZip() {
  const version = await readPackageVersion();
  await ensureDistExists();
  await mkdir(releasesDir, { recursive: true });

  const zipName = getStorePackageFileName(version);
  const zipPath = resolve(releasesDir, zipName);
  await rm(zipPath, { force: true });

  execFileSync("zip", ["-qr", zipPath, ".", "-x", "*.map", "-x", ".DS_Store"], {
    cwd: distDir,
    stdio: "inherit"
  });
  console.log(`Created ${zipPath}`);
}

await packStoreZip();
