import { spawn } from "node:child_process";

import { applyE2eServerEnv, logE2eEnv } from "./e2e-env.mjs";

const ROOT = process.cwd();
const env = applyE2eServerEnv();
logE2eEnv(env);

const port = env.E2E_PORT ?? "3100";

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, env, stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
    });
  });
}

await run("node", ["scripts/test-db.mjs", "prepare"]);
await run("npx", ["tsx", "scripts/seed-demo.ts"]);

if (process.env.E2E_SKIP_BUILD !== "1") {
  await run("npx", ["next", "build"]);
}

const server = spawn("npx", ["next", "start", "-p", port], {
  cwd: ROOT,
  env,
  stdio: "inherit",
});

const shutdown = () => {
  server.kill("SIGTERM");
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
server.on("exit", (code) => process.exit(code ?? 1));
