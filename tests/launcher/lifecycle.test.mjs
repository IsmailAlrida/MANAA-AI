import { after, before, test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

let directory, launcher
before(async () => {
  directory = await mkdtemp(join(tmpdir(), "manaa-launcher-"))
  process.env.MANAA_STATE_DIR = directory
  launcher = await import(`${pathToFileURL(join(process.cwd(), "scripts/launcher.mjs")).href}?test=${Date.now()}`)
})
after(async () => {
  try {
    const record = JSON.parse(await readFile(join(directory, "processes/fixture.pid"), "utf8"))
    process.kill(-record.pid, "SIGTERM")
  } catch {}
  await rm(directory, { recursive: true, force: true })
  delete process.env.MANAA_STATE_DIR
})

test("supervisor keeps a process running, reuses it, and stops its process group", async () => {
  const code = "setInterval(() => {}, 1000)"
  await launcher.startManaged("fixture", process.execPath, ["-e", code])
  const pidFile = join(directory, "processes/fixture.pid")
  const pid1 = JSON.parse(await readFile(pidFile, "utf8")).pid
  await launcher.startManaged("fixture", process.execPath, ["-e", code])
  const pid2 = JSON.parse(await readFile(pidFile, "utf8")).pid
  assert.equal(pid2, pid1, "a live process should be reused")
  assert.ok((await stat(join(directory, "processes/fixture.log"))).isFile())
  process.kill(-pid1, "SIGTERM")
  await new Promise((resolve) => setTimeout(resolve, 150))
  assert.throws(() => process.kill(pid1, 0), { code: "ESRCH" })
})

test("startup lock serializes active starts and recovers only a dead owner", async () => {
  await launcher.withStartupLock(async () => {
    await assert.rejects(launcher.withStartupLock(async () => {}), /startup already in progress/)
  })
  await writeFile(join(directory, "startup.lock"), JSON.stringify({ pid: 2147483000 }) + "\n")
  let entered = false
  await launcher.withStartupLock(async () => { entered = true })
  assert.equal(entered, true)
  await assert.rejects(stat(join(directory, "startup.lock")), { code: "ENOENT" })
})
