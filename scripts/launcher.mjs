#!/usr/bin/env node
import { spawn } from "node:child_process"
import { closeSync, openSync } from "node:fs"
import { mkdir, open, readFile, rm, stat, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
try {
  process.loadEnvFile(join(ROOT, ".env"))
} catch (error) {
  if (error.code !== "ENOENT") throw error
}
const STATE = resolve(process.env.MANAA_STATE_DIR || process.env.MANAA_SERVICE_ROOT || join(process.env.XDG_STATE_HOME || join(process.env.HOME || ".", ".local/state"), "manaa"))
const LOCK = join(STATE, "startup.lock")
const PROCS = join(STATE, "processes")
const PINNED_OPENCODE = "1.1.38"
const PINNED_NODE = "18"
const exec = (cmd, args = [], opts = {}) => new Promise((ok, fail) => {
  const child = spawn(cmd, args, { cwd: ROOT, stdio: "inherit", env: process.env, ...opts })
  child.once("error", fail)
  child.once("exit", (code, signal) => code === 0 ? ok() : fail(new Error(`${cmd} exited ${code ?? signal}`)))
})

function message(value) { console.log(`[manaa] ${value}`) }
function fail(value) { throw new Error(value) }

async function checkedRead(path, label) {
  try { return await readFile(path, "utf8") }
  catch { fail(`${label} is missing: ${path}`) }
}

export async function doctor() {
  const errors = []
  const required = ["node", "npm", "git", "bash", "curl"]
  for (const cmd of required) {
    try { await exec("bash", ["-lc", `command -v ${cmd} >/dev/null`]) }
    catch { errors.push(`required command not found: ${cmd}`) }
  }
  const nodeMajor = Number(process.versions.node.split(".")[0])
  if (nodeMajor < 20) errors.push(`Node.js >=20 is required (found ${process.versions.node})`)
  const provider = process.env.MANAA_VM_PROVIDER || "libvirt"
  if (!new Set(["libvirt", "virtualbox"]).has(provider)) errors.push("MANAA_VM_PROVIDER must be libvirt or virtualbox")
  try {
    const lock = await checkedRead(join(ROOT, "infra/runtime.lock"), "runtime lock")
    if (!lock.includes(`opencode_ai=${PINNED_OPENCODE}`) || !lock.includes(`node_major=${PINNED_NODE}`)) errors.push("infra/runtime.lock differs from the reviewed runtime pins")
    const gitlink = (await checkedRead(join(ROOT, ".gitmodules"), ".gitmodules"))
    if (!gitlink.includes("path = engine")) errors.push("engine submodule declaration is missing")
    const treeEntry = (await git(["ls-tree", "HEAD", "engine"])).trim().split(/\s+/)
    const expected = treeEntry[2]
    const actual = (await git(["-C", "engine", "rev-parse", "HEAD"])).trim()
    if (!expected || expected !== actual) errors.push(`engine submodule checkout ${actual || "missing"} does not match gitlink ${expected || "missing"}`)
    // Dirty engine work is intentional user work. Report it, never reset or clean it.
    const dirty = (await git(["-C", "engine", "status", "--porcelain"])).trim()
    if (dirty) message("engine has local changes; preserving them")
  } catch (e) { errors.push(e.message) }
  if (provider === "libvirt") {
    for (const cmd of ["virsh", "qemu-img", "cloud-localds", "rsync", "ssh-keygen"]) {
      try { await exec("bash", ["-lc", `command -v ${cmd} >/dev/null`]) }
      catch { errors.push(`required for libvirt provider: ${cmd}`) }
    }
  }
  const hostSetup = join(ROOT, "infra/host/setup-ubuntu24.sh")
  try { await stat(hostSetup) } catch { errors.push(`host setup script missing: ${hostSetup}`) }
  if (errors.length) fail(`doctor found ${errors.length} problem(s):\n${errors.map((e) => `  - ${e}`).join("\n")}`)
  message(`doctor passed (provider=${provider}, engine pin=${(await git(["-C", "engine", "rev-parse", "--short", "HEAD"])).trim()})`)
}

async function git(args) {
  const out = await capture("git", args)
  return out
}
function capture(cmd, args, opts = {}) {
  return new Promise((ok, fail) => {
    const child = spawn(cmd, args, { cwd: ROOT, env: process.env, ...opts, stdio: ["ignore", "pipe", "pipe"] })
    let stdout = "", stderr = ""
    child.stdout.on("data", (b) => stdout += b)
    child.stderr.on("data", (b) => stderr += b)
    child.once("error", fail)
    child.once("exit", (code) => code === 0 ? ok(stdout) : fail(new Error(stderr || `${cmd} exited ${code}`)))
  })
}

export async function withStartupLock(fn) {
  await mkdir(STATE, { recursive: true, mode: 0o700 })
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await open(LOCK, "wx", 0o600)
      try {
        await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }) + "\n")
        return await fn()
      } finally {
        await handle.close()
        await rm(LOCK, { force: true })
      }
    } catch (e) {
      if (e.code !== "EEXIST") throw e
      let owner
      try { owner = JSON.parse(await readFile(LOCK, "utf8")) }
      catch { fail("startup lock exists but is unreadable; inspect and remove it manually") }
      if (!Number.isInteger(owner.pid) || owner.pid <= 1) fail("startup lock has invalid owner; inspect and remove it manually")
      try { process.kill(owner.pid, 0); fail(`startup already in progress (pid ${owner.pid})`) }
      catch (probe) { if (probe.message?.includes("startup already")) throw probe; if (probe.code !== "ESRCH") fail(`cannot verify startup lock owner ${owner.pid}; refusing recovery`) }
      // A lock is stale only when the kernel confirms its owner no longer exists.
      await rm(LOCK)
    }
  }
  fail("could not acquire startup lock")
}

async function runScript(path, args = []) {
  try { await stat(path) } catch { fail(`required script missing: ${path}`) }
  await exec("bash", [path, ...args])
}
async function hostSetup() {
  const path = join(ROOT, "infra/host/setup-ubuntu24.sh")
  try { await stat(path) } catch { fail(`required script missing: ${path}`) }
  const args = process.env.MANAA_VM_PROVIDER === "virtualbox" ? ["--with-virtualbox"] : []
  if (process.getuid?.() === 0) await exec("bash", [path, ...args])
  else await exec("sudo", ["bash", path, ...args])
}

async function services(action) { await runScript(join(ROOT, "infra/services.sh"), [action]) }
async function vm(action) { await runScript(join(ROOT, "infra/vm-control.sh"), [action]) }

export async function startApp() {
  await mkdir(PROCS, { recursive: true, mode: 0o700 })
  const definitions = [
    ["api", "npm", ["run", "start", "--workspace=api"], { API_HOST: "127.0.0.1", API_DEMO_RESET: "off", MANAA_MODE: "engine" }],
    ["web", "npm", ["run", "start", "--workspace=web"], { HOSTNAME: "127.0.0.1", PORT: "3000", MANAA_MODE: "engine" }],
  ]
  for (const [name, command, args, extra] of definitions) await startManaged(name, command, args, extra)
}

async function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 1) return false
  try { process.kill(pid, 0); return true } catch (e) { if (e.code === "ESRCH") return false; if (e.code === "EPERM") return true; throw e }
}
async function processStartTicks(pid) {
  try {
    const contents = await readFile(`/proc/${pid}/stat`, "utf8")
    const fields = contents.slice(contents.lastIndexOf(")") + 2).trim().split(/\s+/)
    return fields[19] // Linux stat field 22: process start time since boot.
  } catch (e) { if (e.code === "ENOENT") return null; throw e }
}
export async function startManaged(name, command, args, env = {}) {
  await mkdir(PROCS, { recursive: true, mode: 0o700 })
  const pidPath = join(PROCS, `${name}.pid`)
  const logPath = join(PROCS, `${name}.log`)
  try {
    const previous = JSON.parse(await readFile(pidPath, "utf8"))
    const pid = Number(previous.pid)
    const currentTicks = await processStartTicks(pid)
    if (currentTicks && currentTicks === previous.startTicks && await alive(pid)) { message(`${name} already running (pid ${pid})`); return }
    await rm(pidPath, { force: true })
  } catch (e) { if (e.code !== "ENOENT") throw e }
  const logFd = openSync(logPath, "a", 0o600)
  const child = spawn(command, args, { cwd: ROOT, detached: true, env: { ...process.env, ...env }, stdio: ["ignore", logFd, logFd] })
  try { await new Promise((ok, fail) => { child.once("spawn", ok); child.once("error", fail) }) }
  finally { closeSync(logFd) }
  await writeFile(pidPath, JSON.stringify({ pid: child.pid, startTicks: await processStartTicks(child.pid), command, args }) + "\n", { mode: 0o600 })
  child.unref()
  message(`started ${name} (pid ${child.pid}; log ${logPath})`)
}

export async function stopApp() {
  let hadFailure = false
  for (const name of ["web", "api"]) {
    const pidPath = join(PROCS, `${name}.pid`)
    try {
      const record = JSON.parse(await readFile(pidPath, "utf8"))
      const pid = Number(record.pid)
      const currentTicks = await processStartTicks(pid)
      if (currentTicks !== record.startTicks) { message(`${name} pid record is stale; leaving unrelated process alone`); await rm(pidPath, { force: true }); continue }
      if (await alive(pid)) {
        // Processes are detached into their own session; stop the complete
        // npm/application process group instead of orphaning its Node child.
        try { process.kill(-pid, "SIGTERM") } catch (e) { if (e.code !== "ESRCH") throw e }
        const deadline = Date.now() + 10000
        while (Date.now() < deadline && await alive(pid)) await new Promise((r) => setTimeout(r, 200))
        if (await alive(pid)) { hadFailure = true; message(`${name} pid ${pid} did not stop; left running`) }
        else message(`stopped ${name}`)
      } else message(`${name} was already stopped`)
      if (!hadFailure) await rm(pidPath, { force: true })
    } catch (e) { if (e.code !== "ENOENT") throw e }
  }
  await services("stop").catch((e) => { if (!/script missing/.test(e.message)) throw e })
  await vm("stop").catch((e) => { if (!/script missing/.test(e.message)) throw e })
  if (hadFailure) fail("one or more app processes did not stop")
}

async function appStart() {
  await doctor()
  await startApp()
}
export async function preflight() {
  const errors = []
  for (const cmd of ["node", "npm", "git", "bash", "curl"]) {
    try { await exec("bash", ["-lc", `command -v ${cmd} >/dev/null`]) }
    catch { errors.push(`required command not found: ${cmd}`) }
  }
  if (Number(process.versions.node.split(".")[0]) < 20) errors.push(`Node.js >=20 is required (found ${process.versions.node})`)
  const provider = process.env.MANAA_VM_PROVIDER || "libvirt"
  if (!new Set(["libvirt", "virtualbox"]).has(provider)) errors.push("MANAA_VM_PROVIDER must be libvirt or virtualbox")
  try {
    const expected = (await git(["ls-tree", "HEAD", "engine"])).trim().split(/\s+/)[2]
    const actual = (await git(["-C", "engine", "rev-parse", "HEAD"])).trim()
    if (!expected || expected !== actual) errors.push(`engine checkout ${actual || "missing"} does not match pinned gitlink ${expected || "missing"}`)
  } catch (e) { errors.push(e.message) }
  if (errors.length) fail(`preflight found ${errors.length} problem(s):\n${errors.map((e) => `  - ${e}`).join("\n")}`)
  message(`preflight passed (provider=${provider})`)
}
async function fullStart() {
  await preflight()
  await withStartupLock(async () => {
    await hostSetup()
    await doctor()
    await vm("networks")
    await services("db:up")
    await services("transfer:start")
    await runScript(join(ROOT, "infra/provision.sh"), ["--provider", process.env.MANAA_VM_PROVIDER || "libvirt"])
    await vm("status")
    await startApp()
  })
}

export async function command(name) {
  switch (name) {
    case "doctor": case "doc": return doctor()
    case "host:setup": await preflight(); return hostSetup()
    case "vm:provision": case "node:provision":
      await preflight()
      return runScript(join(ROOT, "infra/provision.sh"), ["--provider", process.env.MANAA_VM_PROVIDER || "libvirt", ...process.argv.slice(3)])
    case "db:up": return services("db:up")
    case "transfer:start": return services("transfer:start")
    case "app:start": return appStart()
    case "status": await services("status").catch((e) => { if (!/script missing/.test(e.message)) throw e }); return vm("status").catch((e) => { if (!/script missing/.test(e.message)) throw e })
    case "logs": return runScript(join(ROOT, "infra/services.sh"), ["logs", ...process.argv.slice(3)])
    case "stop": return stopApp()
    case "start": return fullStart()
    default: fail(`unknown command '${name}'`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  command(process.argv[2] || "start").catch((error) => { console.error(`[manaa] ${error.message}`); process.exitCode = 1 })
}
