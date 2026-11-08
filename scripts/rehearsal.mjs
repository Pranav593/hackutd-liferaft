import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const python =
  process.env.LIFERAFT_COCKPIT_PYTHON ??
  resolve(
    process.platform === "win32"
      ? ".venv/Scripts/python.exe"
      : ".venv/bin/python",
  );
if (!existsSync(python))
  throw new Error(
    "Set up the project Python environment first; see README.md.",
  );
const reuse = process.argv.includes("--reuse");
const port = process.env.LIFERAFT_DEMO_PORT ?? "3120";
if (!/^\d{4,5}$/.test(port) || Number(port) > 65535)
  throw new Error("Invalid demo port");

function run(command, args) {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false });
    const stop = () => child.kill("SIGTERM");
    process.once("SIGINT", stop);
    child.once("error", reject);
    child.once("exit", (code) => {
      process.removeListener("SIGINT", stop);
      code === 0
        ? accept()
        : reject(new Error(`Rehearsal stopped (exit ${code}).`));
    });
  });
}

try {
  console.log(
    reuse
      ? "Reusing saved local evidence. Each API load re-verifies it."
      : "Preparing four genuine CPU recovery drills. No provider calls or hardware actions. Allow about two minutes.",
  );
  if (!reuse) await run(python, ["-m", "liferaft.rehearsal", "--all"]);
  const pointer = resolve(
    process.env.LIFERAFT_STATE_DIR ?? ".liferaft",
    "rehearsal/cooling.json",
  );
  const { directory } = JSON.parse(readFileSync(pointer, "utf8"));
  process.env.LIFERAFT_COCKPIT_JOB = "local-job";
  process.env.LIFERAFT_COCKPIT_LOCAL_RUN = directory;
  delete process.env.LIFERAFT_COCKPIT_EVENTS;
  delete process.env.LIFERAFT_COCKPIT_INVESTIGATION;
  console.log(
    `\nOpen http://127.0.0.1:${port}/story and press Run the story.\n`,
  );
  await run(process.execPath, [
    require.resolve("next/dist/bin/next"),
    "dev",
    "web",
    "--hostname",
    "127.0.0.1",
    "--port",
    port,
  ]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
