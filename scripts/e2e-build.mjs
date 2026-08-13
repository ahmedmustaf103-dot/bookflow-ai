import { spawn } from "node:child_process";

import { applyE2eServerEnv, logE2eEnv } from "./e2e-env.mjs";

const env = applyE2eServerEnv();
logE2eEnv(env);

const child = spawn("npx", ["next", "build"], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 1));
