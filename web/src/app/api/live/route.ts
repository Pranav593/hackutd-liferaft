import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const execute = promisify(execFile);
const headers = { "Cache-Control": "no-store" };
const loopback = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

async function python(args: string[], extra: Record<string, boolean> = {}) {
  const cwd = process.cwd();
  const root = existsSync(join(cwd, "pyproject.toml")) ? cwd : dirname(cwd);
  const venv =
    process.platform === "win32"
      ? ".venv/Scripts/python.exe"
      : ".venv/bin/python";
  const executable = process.env.LIFERAFT_COCKPIT_PYTHON ?? join(root, venv);
  const options = {
    cwd: root,
    timeout: 22000,
    maxBuffer: 2 * 1024 * 1024,
    encoding: "utf8" as const,
  };
  try {
    const { stdout } = await execute(
      executable,
      ["-m", "liferaft.live_cockpit", ...args],
      options,
    );
    return Response.json({ ...JSON.parse(stdout), ...extra }, { headers });
  } catch (failure) {
    if (
      failure &&
      typeof failure === "object" &&
      "stdout" in failure &&
      typeof failure.stdout === "string"
    ) {
      try {
        const result = JSON.parse(failure.stdout);
        if (typeof result.error === "string")
          return Response.json(
            { error: result.error },
            { status: 503, headers },
          );
      } catch {}
    }
    return Response.json(
      {
        error:
          "Live command did not complete. Check the Mac Python environment and coordinator connectivity.",
      },
      { status: 503, headers },
    );
  }
}

export async function GET(request: Request) {
  if (!loopback.test(request.headers.get("host") ?? "")) {
    return Response.json(
      { error: "Live controls are available on the local cockpit." },
      { status: 403, headers },
    );
  }
  const job = new URL(request.url).searchParams.get("job");
  if (job !== null && !/^pi-(?:mvp|live|edge)-[A-Za-z0-9_-]{1,70}$/.test(job)) {
    return Response.json(
      { error: "Enter a Pi demo job ID, for example pi-mvp-03." },
      { status: 400, headers },
    );
  }
  return python(job ? ["snapshot", "--job", job] : ["snapshot"], {
    controlsEnabled: process.env.LIFERAFT_LIVE_OPERATOR === "1",
  });
}

export async function POST(request: Request) {
  const host = request.headers.get("host") ?? "";
  if (
    !loopback.test(host) ||
    request.headers.get("origin") !== `http://${host}` ||
    request.headers.get("sec-fetch-site") !== "same-origin"
  ) {
    return Response.json(
      { error: "Start Training requires the local cockpit." },
      { status: 403, headers },
    );
  }
  if (process.env.LIFERAFT_LIVE_OPERATOR !== "1") {
    return Response.json(
      {
        error:
          "Start the cockpit with LIFERAFT_LIVE_OPERATOR=1 to enable training controls.",
      },
      { status: 403, headers },
    );
  }
  if ((await request.text()) !== "") {
    return Response.json(
      { error: "Start Training does not accept parameters." },
      { status: 400, headers },
    );
  }
  return python(["start"]);
}
