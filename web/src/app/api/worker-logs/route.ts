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
      { error: "Worker logs are available only on the local dashboard." },
      { status: 403, headers },
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
    const { stdout } = await execute(python, ["-m", "liferaft.worker_logs"], {
      cwd: root,
      timeout: 11000,
      maxBuffer: 512 * 1024,
      encoding: "utf8",
    });
    return Response.json(JSON.parse(stdout), { headers });
  } catch {
    return Response.json(
      {
        error:
          "Worker logs could not be refreshed. Last received activity may be stale.",
      },
      { status: 503, headers },
    );
  }
}
