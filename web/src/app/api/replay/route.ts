import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { promisify } from "node:util"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const execute = promisify(execFile)
const headers = { "Cache-Control": "no-store" }

export async function GET(request: Request) {
  const host = request.headers.get("host") ?? ""
  if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) {
    return Response.json({ error: "Replay is available on the local cockpit." }, { status: 403, headers })
  }

  const job = process.env.LIFERAFT_COCKPIT_JOB
  if (!job) return Response.json({ replay: null }, { headers })

  const cwd = process.cwd()
  const root = existsSync(join(cwd, "pyproject.toml")) ? cwd : dirname(cwd)
  const venv = process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python"
  const python = process.env.LIFERAFT_COCKPIT_PYTHON ?? join(root, venv)
  const args = ["-m", "liferaft", "cockpit-data", "--job", job]
  for (const [flag, path] of [
    ["--local-run", process.env.LIFERAFT_COCKPIT_LOCAL_RUN],
    ["--events", process.env.LIFERAFT_COCKPIT_EVENTS],
    ["--investigation", process.env.LIFERAFT_COCKPIT_INVESTIGATION],
  ] as const) {
    if (path) args.push(flag, resolve(root, path))
  }

  try {
    const { stdout } = await execute(python, args, { cwd: root, encoding: "utf8", timeout: 5000, maxBuffer: 8 * 1024 * 1024 })
    if (typeof stdout !== "string") throw new Error("Replay projection produced no JSON")
    return Response.json({ replay: JSON.parse(stdout) }, { headers })
  } catch {
    return Response.json({ error: "Saved evidence is unavailable or failed verification." }, { status: 422, headers })
  }
}
