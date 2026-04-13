#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import process from "node:process";
import { Client as MinioClient } from "minio";

const rootDir = path.resolve(process.cwd());
const mode = parseMode(process.argv.slice(2));
const runID = process.env.EAH_FULL_CLOSURE_RUN_ID ?? `fc-${Date.now()}`;
const artifactDir = path.resolve(process.env.EAH_FULL_CLOSURE_ARTIFACT_DIR ?? path.join("test-results", "full-closure", runID));
const logsDir = path.join(artifactDir, "logs");
mkdirSync(logsDir, { recursive: true });

const keepEnvironment = process.env.EAH_FULL_CLOSURE_KEEP_ENV === "true";
const apiPort = await findFreePort();
const uiPort = await findFreePort();
const pgPort = await findFreePort();
const redisPort = await findFreePort();
const minioPort = await findFreePort();
const minioConsolePort = await findFreePort();

const apiBaseURL = `http://127.0.0.1:${apiPort}`;
const uiBaseURL = `http://127.0.0.1:${uiPort}`;
const dockerNames = {
  postgres: `eah-fc-postgres-${runID}`,
  redis: `eah-fc-redis-${runID}`,
  minio: `eah-fc-minio-${runID}`,
};

writeJSON(path.join(artifactDir, "runtime.json"), {
  runID,
  apiBaseURL,
  uiBaseURL,
  ports: {
    api: apiPort,
    ui: uiPort,
    postgres: pgPort,
    redis: redisPort,
    minio: minioPort,
    minioConsole: minioConsolePort,
  },
  dockerNames,
});

const background = [];

try {
  ensureCommand("zip");
  ensureCommand("unzip");
  ensureCommand("docker");
  ensureCommand("npm");
  ensureCommand("cargo");

  runCapture("docker", ["info"]);

  await startContainer({
    name: dockerNames.postgres,
    image: "pgvector/pgvector:pg16",
    env: {
      POSTGRES_DB: "enterprise_agent_hub",
      POSTGRES_USER: "eah",
      POSTGRES_PASSWORD: "change-me",
    },
    ports: [`${pgPort}:5432`],
  });
  await startContainer({
    name: dockerNames.redis,
    image: "redis:7-alpine",
    ports: [`${redisPort}:6379`],
    command: ["redis-server", "--appendonly", "yes"],
  });
  await startContainer({
    name: dockerNames.minio,
    image: "minio/minio:latest",
    env: {
      MINIO_ROOT_USER: "minioadmin",
      MINIO_ROOT_PASSWORD: "change-me-minio-secret",
    },
    ports: [`${minioPort}:9000`, `${minioConsolePort}:9001`],
    command: ["server", "/data", "--console-address", ":9001"],
  });

  await waitFor(async () => {
    const result = runCapture("docker", [
      "exec",
      dockerNames.postgres,
      "pg_isready",
      "-U",
      "eah",
      "-d",
      "enterprise_agent_hub",
    ], { allowFailure: true });
    return result.status === 0;
  }, "postgres readiness");

  await waitFor(async () => {
    const result = runCapture("docker", ["exec", dockerNames.redis, "redis-cli", "ping"], {
      allowFailure: true,
    });
    return result.status === 0 && result.stdout.includes("PONG");
  }, "redis readiness");

  await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${minioPort}/minio/health/live`).catch(() => null);
    return response?.ok ?? false;
  }, "minio readiness");

  await ensureMinioBuckets({
    endPoint: "127.0.0.1",
    port: minioPort,
    accessKey: "minioadmin",
    secretKey: "change-me-minio-secret",
    buckets: ["skill-packages", "skill-assets"],
  });

  const runtimeEnv = {
    ...process.env,
    API_PORT: String(apiPort),
    DATABASE_URL: `postgresql://eah:change-me@127.0.0.1:${pgPort}/enterprise_agent_hub`,
    REDIS_URL: `redis://127.0.0.1:${redisPort}/0`,
    JWT_SECRET: "change-me-before-deploy",
    MINIO_ENDPOINT: "127.0.0.1",
    MINIO_PORT: String(minioPort),
    MINIO_USE_SSL: "false",
    MINIO_ACCESS_KEY: "minioadmin",
    MINIO_SECRET_KEY: "change-me-minio-secret",
    MINIO_ROOT_USER: "minioadmin",
    MINIO_ROOT_PASSWORD: "change-me-minio-secret",
    MINIO_SKILL_PACKAGE_BUCKET: "skill-packages",
    MINIO_SKILL_ASSET_BUCKET: "skill-assets",
    LOCAL_PACKAGE_STORAGE_DIR: path.join(artifactDir, "runtime-package-storage"),
  };

  runStreaming("npm", ["run", "migrate:dev", "--workspace", "@enterprise-agent-hub/api"], {
    env: runtimeEnv,
    logFile: path.join(logsDir, "migrate.log"),
  });
  runStreaming("npm", ["run", "seed:dev", "--workspace", "@enterprise-agent-hub/api"], {
    env: runtimeEnv,
    logFile: path.join(logsDir, "seed.log"),
  });

  background.push(startBackground("api", "npm", ["run", "start:dev", "--workspace", "@enterprise-agent-hub/api"], {
    env: runtimeEnv,
    logFile: path.join(logsDir, "api.log"),
  }));
  await waitFor(async () => {
    const response = await fetch(`${apiBaseURL}/health`).catch(() => null);
    if (!response?.ok) {
      return false;
    }
    const body = await response.json().catch(() => null);
    return body?.status === "ok";
  }, "api health status=ok");

  background.push(startBackground("desktop-web", "npm", [
    "run",
    "dev",
    "--workspace",
    "@enterprise-agent-hub/desktop",
    "--",
    "--port",
    String(uiPort),
  ], {
    env: {
      ...process.env,
      VITE_DESKTOP_API_BASE_URL: apiBaseURL,
    },
    logFile: path.join(logsDir, "desktop-web.log"),
  }));
  await waitFor(async () => {
    const response = await fetch(uiBaseURL).catch(() => null);
    return response?.ok ?? false;
  }, "desktop web availability");

  const harnessEnv = {
    ...process.env,
    EAH_FULL_CLOSURE_RUN_ID: runID,
    EAH_FULL_CLOSURE_ARTIFACT_DIR: artifactDir,
    EAH_FULL_CLOSURE_API_BASE_URL: apiBaseURL,
    EAH_FULL_CLOSURE_UI_BASE_URL: uiBaseURL,
  };

  const uiEnv = {
    ...harnessEnv,
    ...(mode === "native"
      ? { EAH_FULL_CLOSURE_PLAYWRIGHT_GREP: "happy path publishes same skill through review and exposes installable market artifact" }
      : {}),
  };

  runStreaming("node", ["scripts/full-closure/run-ui-smoke.mjs"], {
    env: uiEnv,
    logFile: path.join(logsDir, "ui-smoke.log"),
  });
  if (mode !== "ui") {
    runStreaming("node", ["scripts/full-closure/run-native-smoke.mjs"], {
      env: harnessEnv,
      logFile: path.join(logsDir, "native-smoke.log"),
    });
  }

  writeJSON(path.join(artifactDir, "summary.json"), {
    runID,
    status: "passed",
    mode,
    apiBaseURL,
    uiBaseURL,
    happyPathArtifact: path.join(artifactDir, "happy-path.json"),
  });
  console.log(`P1 ${mode} closure PASS (${artifactDir})`);
} finally {
  if (!keepEnvironment) {
    for (const processHandle of background.reverse()) {
      stopBackground(processHandle);
    }
    for (const name of Object.values(dockerNames)) {
      runCapture("docker", ["rm", "-f", name], { allowFailure: true });
    }
  } else {
    console.log(`P1 full closure kept environment at ${artifactDir}`);
  }
}

function ensureCommand(command) {
  const result = runCapture("sh", ["-lc", `command -v ${command}`], { allowFailure: true });
  if (result.status !== 0) {
    throw new Error(`Required command not found: ${command}`);
  }
}

function parseMode(args) {
  const modeIndex = args.indexOf("--mode");
  const next = modeIndex >= 0 ? args[modeIndex + 1] : "full";
  if (!["full", "ui", "native"].includes(next)) {
    throw new Error(`Unsupported full-closure mode: ${next}`);
  }
  return next;
}

async function startContainer({ name, image, env = {}, ports = [], command = [] }) {
  runCapture("docker", ["rm", "-f", name], { allowFailure: true });
  const args = ["run", "-d", "--name", name];
  for (const [key, value] of Object.entries(env)) {
    args.push("-e", `${key}=${value}`);
  }
  for (const mapping of ports) {
    args.push("-p", mapping);
  }
  args.push(image, ...command);
  runCapture("docker", args);
}

async function ensureMinioBuckets({ endPoint, port, accessKey, secretKey, buckets }) {
  const client = new MinioClient({
    endPoint,
    port,
    useSSL: false,
    accessKey,
    secretKey,
  });
  for (const bucket of buckets) {
    const exists = await client.bucketExists(bucket).catch(() => false);
    if (!exists) {
      await client.makeBucket(bucket, "");
    }
  }
}

function startBackground(label, command, args, { env, logFile }) {
  writeFileSync(logFile, "");
  const output = createWriteStream(logFile, { flags: "a" });
  const child = spawn(command, args, {
    cwd: rootDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(output);
  child.stderr.pipe(output);
  child.on("exit", (code, signal) => {
    output.write(`\n[${label}] exited with code=${code ?? "null"} signal=${signal ?? "null"}\n`);
  });
  return { label, child, output };
}

function stopBackground(handle) {
  if (handle.child.exitCode === null && !handle.child.killed) {
    handle.child.kill("SIGTERM");
  }
  handle.output.end();
}

function runStreaming(command, args, { env, logFile }) {
  writeFileSync(logFile, "");
  const output = createWriteStream(logFile, { flags: "a" });
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
  });
  if (result.stdout) {
    output.write(result.stdout);
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    output.write(result.stderr);
    process.stderr.write(result.stderr);
  }
  output.end();
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
  }
}

function runCapture(command, args, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 8,
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stderr || result.stdout}`);
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

async function waitFor(check, label, timeoutMs = 120_000, intervalMs = 1_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await check()) {
      return;
    }
    await delay(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function findFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to allocate free port"));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
    server.on("error", reject);
  });
}

function writeJSON(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
