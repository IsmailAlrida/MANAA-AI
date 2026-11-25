# MANAA | مناعة

## Judges: run the demo first

From the repository root, run:

```sh
npm ci
npm run dev:demo
```

Open **[the dashboard](http://localhost:3000)** and click **Run scan**. The workspace starts empty and fills with four simulated fraud campaigns. Open a ticket, inspect its cited evidence, follow a relationship in the graph, and switch between English and Arabic. This walkthrough runs locally without VM setup or model credentials.

[Demo video placeholder](demo/video/manaa-demo.mp4) — replace this clearly labeled placeholder with a human-recorded walkthrough.

For a fresh run, keep the demo running and execute this in a second terminal:

```sh
curl -X POST http://127.0.0.1:4787/api/v1/demo/reset
```

Refresh the dashboard and click **Run scan** again.

MANAA is designed to help UAE police investigators uncover fraud campaigns in days instead of weeks. An investigator presses **Run**, opens a campaign ticket, and follows its evidence from a suspicious website to related ads, accounts, businesses, or people. The graph shows how those entities are connected. The dossier gives the investigator the sources to check before taking action.

**The dashboard is a report reader.** The AI agent fabric publishes campaign tickets and graph updates through a common API. Agents can vary the length, ordering, and content of a Markdown report and compose supported evidence blocks for screenshots, side-by-side comparisons, plots, and citations. A new campaign can use the existing dashboard without a bespoke case page. A genuinely new visual block needs a renderer. English and Arabic reports share evidence IDs and preserve source-recorded names.

The four-case demo shows that operator journey with synthetic evidence. The engine roadmap extends it to continuous public-source discovery, followed by a one-way handoff to an isolated police AI Agent Orchestra for authorized enrichment. [Dashboard contract](docs/FRONTEND-BACKEND-CONTRACT.md) · [Implementation roadmap](#implementation-roadmap)

## Quick start

From the repository root on Ubuntu 24.04, configure the private model endpoints described below, then run:

```sh
npm ci
npm start
```

`npm start` runs the full managed startup: host setup, dedicated database and transfer services, provisioning of both guests, then the dashboard and API. It requires administrator access for host setup. Initialize the pinned `engine` submodule before running `npm ci` if it is absent (`git submodule update --init engine`). Open the URL printed after readiness and select **Run scan** to run the controlled case. The police worker uses OpenCode with bounded synthetic evidence and the configured inference endpoint. Full two-VM startup has not yet been verified on a supported host.

Libvirt is the default. Set `MANAA_VM_PROVIDER=virtualbox` for the alternative recipe. Configure environment variables in the root `.env` file or export them before startup.

## What runs where

| Component | Location | Purpose |
| --- | --- | --- |
| Web dashboard | Host, `127.0.0.1:3000` | English/Arabic ticket and relationship views. |
| App API | Host, `127.0.0.1:4787` | REST/SSE workspace API; stores dashboard state in a local SQLite file. |
| PostgreSQL | Host, private state under `${MANAA_SERVICE_ROOT:-${XDG_STATE_HOME:-$HOME/.local/state}/manaa}` | Dedicated `manaa_transfer` database on port 55432; separate writer, reader, and results login roles. It does not use or modify a system PostgreSQL cluster. |
| Writer | Host `10.77.10.1:8081` | OSINT-side finding and binary evidence ingestion. |
| Reader | Host `10.77.20.1:8082` | Police-side read-only access to transferred evidence. |
| Results | Host `10.77.20.1:8083` | Controlled worker result submission and dashboard retrieval. A bearer token is stored in the private service state and injected into the police guest. |
| OSINT VM | `10.77.10.10` | Creates the controlled synthetic finding and sends it to the writer. |
| Police VM | `10.77.20.10` | Reads the finding, runs the controlled review, and posts its result. |

The two VM networks are isolated from each other and use fixed host/guest addresses. The PostgreSQL listener is local to the host. The transfer HTTP listeners bind only to their respective private bridge addresses; they do not provide encryption or replace network policy.

## Host and guest requirements

- Host setup supports Ubuntu 24.04. `infra/host/setup-ubuntu24.sh` installs VM and service dependencies, libvirt/QEMU, PostgreSQL server/client, Python venv support, and supporting tools. It requires root through `sudo` and makes host package/service changes during full startup or standalone host setup.
- Node.js 22.18 or newer and npm are required for the workspace apps and launcher. Use the npm version recorded in `package.json`'s `packageManager` field.
- Each VM is provisioned from a checksum-verified Ubuntu 24.04 cloud image. The current recipes allocate 4 vCPUs, 8 GiB RAM, and a 40 GiB disk per VM. The pinned OpenCode and Python runtimes are in `infra/runtime.lock`.
- For the VM runtime, provide an OpenAI-compatible API at the private host bridge address reachable from each VM (default port `11434`, model name `local-model`). Configure `MANAA_OSINT_MODEL_HOST`, `MANAA_OSINT_MODEL_PORT`, `MANAA_OSINT_MODEL_NAME` and `MANAA_OSINT_MODEL_API_KEY`, plus matching `MANAA_POLICE_*` variables, in the root `.env` or exported environment. The OSINT and police endpoint hosts must be `10.77.10.1` and `10.77.20.1` respectively; guest loopback cannot reach the host. Keys are written to guest config during provisioning and must not be committed.

## Provider support

| Provider | Implementation | Verification status |
| --- | --- | --- |
| libvirt/QEMU | Default recipe; isolated bridges, temporary install network, then installer NIC detachment. | The provisioning path is implemented. A full VM boot/provision was not exercised in this environment. |
| VirtualBox | Optional host-only networks and Ubuntu cloud-image import. Set `MANAA_VM_PROVIDER=virtualbox`. | The provisioning path is implemented. A full VM boot/provision was not exercised in this environment. |

The host PostgreSQL recipe uses `initdb`, `pg_ctl`, `psql`, and `pg_isready` from the explicit host setup. Service-role API checks passed against a disposable PostgreSQL 16 container. The native host-cluster bootstrap still needs verification on a host with those packages installed; `npm start` performs the login/health checks before the app is launched.

## Operations

```sh
npm run doctor                     # inspect launcher and provider prerequisites
npm run host:setup                 # install host dependencies (requires administrator access)
npm run db:up                      # create/start the dedicated database and provision roles
npm run transfer:start             # start writer, reader, and results listeners
npm run vm:provision               # provision both guests without starting the app
npm run app:start                  # start only the API and dashboard
npm run status                     # service and VM status
npm run logs -- --service writer   # transfer listener logs
npm run logs -- --service postgres # database log
npm run stop                       # stop owned app, transfer, database, and VM processes
```

Run those commands in order after `npm ci`; `npm start` performs the full sequence automatically. `doctor` checks prerequisites and the pinned engine checkout, but does not initialize the submodule.

The lower-level scripts are in `infra/`. The launcher stores service state, credentials, logs, and PID records in the private state directory above. The credentials file is mode `0600`; do not copy it into the repository or share its contents.

For UI work without VM provisioning, run `npm run dev`. This starts the local dashboard and the separate fictional-fixture demo API. It does not start PostgreSQL, VMs, or the controlled OSINT/police handoff. The dashboard uses fixture mode unless started by the managed launcher.

## Engine and evidence scope

The `engine` submodule contains offline tools, controlled-case logic, and the transfer API. See [engine setup and scope](engine/README.md), [transfer API and database grants](engine/transfer/README.md), and the [agent-fabric architecture](docs/AGENT-FABRIC-ARCHITECTURE.md). The current VM workflow is a controlled synthetic handoff, not live discovery, and restricted internal-source integrations are not included.

Historical project notes retain the context in which they were written. See [the archived WhatsApp/location concept](docs/archive/README-whatsapp-concept.md), [the fictional casebook](docs/FICTIONAL-CASEBOOK.md), and dated research in `engine/research/`.

## Development checks

```sh
npm run build
npm run lint
npm run typecheck
npm test
npm run test:launcher
```

## Implementation roadmap

Checked milestones have a working implementation or recorded test. Each open milestone describes the evidence that will close it. The [technical review](engine/research/TECHNOLOGY-REVIEW-2026-11-24.md) records the tools, papers, source links, and access limits behind these choices.

### 1. Deliver a finding to an investigator

- [x] Replay four bilingual campaigns as incremental ticket and graph updates over REST/SSE. Let an officer inspect the evidence and close a ticket with a written disposition.
- [x] Give OpenCode specialists inspectable ICM stages, reusable Python tools and isolated run directories. Transfer cited findings and binary artifacts by content hash. Test PostgreSQL publication, concurrent cursors, replay, and exact source-name preservation.
- [ ] Boot the QEMU/KVM–libvirt two-VM recipe on a clean Ubuntu host and follow one controlled case from Run through private inference to a published ticket. Verify the VirtualBox recipe separately. Record restart, isolation and evidence-integrity results.

### 2. Find lookalikes and preserve the pages that explain them

- [x] Generate dnstwist candidates, match saved DNS observations, and record sampling limits. The first three-seed run checked 52 names, found six with addresses, and raised zero page-backed flags. [Run report](engine/tests/reports/dns-baseline.md)
- [ ] Start from a versioned catalogue of official properties, enforce exclusions at intake and on redirects, and discover an independently hosted test lookalike without supplying its address. Retain DNS, RDAP, certificate timestamps and provenance. Compare Certificate Transparency, DomainTools Domain Discovery, WhoisXML registration feeds and SecurityTrails historical DNS. Record actual ICANN CZDS and TDRA/.aeDA coverage and access rights.
- [ ] Benchmark Crawlee for Python with Playwright against Scrapling on the same controlled Arabic and English pages. Compare redirects, rendered screenshots, HTML, network traces, replay fidelity, unique successful captures, time and memory. Evaluate Scrapy for HTTP, Crawl4AI for extraction, Lacus/LacusCore for capture as a service and Browsertrix for WARC/WACZ archival. Adopt one primary collector after the benchmark.
- [x] Provide an explicit Google Web Risk Lookup adapter with mocked response tests.
- [ ] Verify Lookup access, cache expiry, shared quotas and evidence-retention terms for the deployment. Show a no-match result with its queried lists and time. [Agent tool review](engine/research/journal/README.md)
- [ ] Extend evidence discovery to search, ads and Maps. Compare Brave Search, Exa and SearXNG for search; exercise SerpApi Maps and Ads Transparency separately. Keep each raw result with its query, locale, location, observation time and provider event interval.

### 3. Verify UAE claims against the right authority

- [ ] Demonstrate one reproducible licence check, then extend issuer coverage: MoET Growth, Invest in Dubai/DUL, ADDED/TAMM, DMCC and Ajman DED. Verify the actual lookup available for Sharjah, Ras Al Khaimah, Umm Al Quwain and Fujairah. Save the identifier, returned record and access outcome for every check.
- [ ] Check corporate registration and regulated permissions separately using ADGM/FSRA, DIFC/DFSA, CBUAE and SCA. Verify VAT TRN claims separately through FTA. Use GLEIF and OpenCorporates as secondary corroboration with recorded coverage and terms.
- [ ] Validate professional claims against MoHAP, DHA, Abu Dhabi DoH and DLD. Document whether an MOJ lawyer-roll lookup is accessible. Distinguish a returned match, no match, authentication, interaction required, portal failure and unchecked sources.
- [ ] Exercise authorized enrichment in the isolated layer with simulated police and banking adapters. Preserve the access boundaries of UAE PASS consent, ICP presented-card checks, TDRA Hesabati self-service and protected beneficial-owner records. Each evidence card should say precisely which claim its source supports.

### 4. Explain each proposed flag

- [x] Parse saved HTML and HAR records; hash and compare supplied screenshots; attach original artifacts for inspection.
- [ ] Evaluate viewport-normalized OpenCV image hashes and Tesseract versus PaddleOCR on Arabic, English and mixed-script samples. Compare logo, layout, payee, destination and sign-in or payment intent against official references. Measure which signal improves precision on legitimate payment processors and shared templates.
- [ ] Reproduce a **Phishpedia** logo-localization comparison and a **PhishIntention** intent comparison on saved pages. Show the officer the matched reference and the exact region or page element supporting the conclusion.
- [ ] Compare **PhishLLM** and **PhishAgent** retrieval-assisted approaches with Laya text classification and multilingual E5-small evidence retrieval on the same cases. Require cited evidence, measure Arabic performance, abstention and inference cost, and keep only techniques that improve the baseline.
- [ ] Use **PhishDecloaker** to design a blocked-content evaluation and **PhishLumos** to evaluate campaign linkage across independently captured variants. Record contradictory captures and unresolved outcomes. Apply the large-scale field study’s robustness lesson by testing on unseen domains and later time periods.

### 5. Connect campaigns and publish reviewable dossiers

- [x] Trace directed multi-hop paths through supplied observations with NetworkX and retain evidence IDs on the edges.
- [ ] Adapt Graphify’s node-link interchange and community navigation. Compare Leiden and Louvain on a documented edge projection. Save graph snapshot, weights, hub filters and cluster lineage so an investigator can explain why communities split or merged.
- [ ] Distinguish observed relationships, inferred links, disputed identities and officer decisions. Demonstrate reversing an incorrect merge without losing source strings, timestamps or contradictory evidence. Verify Arabic retrieval using PostgreSQL text search.
- [ ] Export a bilingual evidence packet with original captures, hashes, timestamps and an operator disposition. Test that a new report layout using existing blocks renders without frontend changes.

### 6. Operate continuously and measure the result

- [ ] Run the same evidence operation through Python and a thin CLI/API adapter. Evaluate FastMCP and CrewAI adapters against that contract. Validate uv and Docker Compose packaging for reusable tools inside the VM boundary.
- [ ] Test interrupted and concurrent jobs. Compare Huey and Procrastinate if durable scheduling is needed; select one using measured restart, retry and duplicate-delivery behavior. Record attempts and terminal outcomes independently of model prose.
- [ ] Compare remaining platform gaps with Lookyloo, AIL, BBOT and SpiderFoot. Evaluate MISP interchange or Neo4j only against a measured requirement beyond the existing PostgreSQL and NetworkX implementation.
- [ ] Publish a held-out benchmark covering legitimate official sites, benign lookalikes, compromised genuine sites, shortened links, redirects and unavailable pages. Report precision, recall, false positives, time to flag, inspection coverage and abstentions by language.
- [ ] Validate a real suspected impersonator through human review, scale one layer at a time, then pilot at an authorized UAE police headquarters. Measure time from lead to verified disposition against the investigator’s existing workflow.
