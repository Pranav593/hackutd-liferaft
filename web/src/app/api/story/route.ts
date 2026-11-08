import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const execute = promisify(execFile);
const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  if (
    !/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(
      request.headers.get("host") ?? "",
    )
  ) {
    return Response.json(
      { error: "Local rehearsal only." },
      { status: 403, headers },
    );
  }
  const scenario =
    new URL(request.url).searchParams.get("scenario") ?? "cooling";
  if (!["cooling", "crash", "corrupt", "zombie"].includes(scenario)) {
    return Response.json(
      { error: "Unknown scenario." },
      { status: 400, headers },
    );
  }
  const cwd = process.cwd();
  const root = existsSync(join(cwd, "pyproject.toml")) ? cwd : dirname(cwd);
  const python =
    process.env.LIFERAFT_COCKPIT_PYTHON ??
    join(
      root,
      process.platform === "win32"
        ? ".venv/Scripts/python.exe"
        : ".venv/bin/python",
    );
  try {
    const { stdout } = await execute(
      python,
      ["-m", "liferaft.rehearsal", "--project", "--scenario", scenario],
      {
        cwd: root,
        timeout: 5000,
        maxBuffer: 2 * 1024 * 1024,
        encoding: "utf8",
      },
    );
    return Response.json(JSON.parse(stdout), { headers });
  } catch {
    return Response.json(
      {
        error:
          "Verified rehearsal unavailable. Run npm run demo to prepare the evidence.",
      },
      { status: 422, headers },
    );
  }
}
