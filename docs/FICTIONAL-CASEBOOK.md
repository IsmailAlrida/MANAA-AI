# MANA'A Demo Fictional Casebook

**Status:** Scenario and evidence contract for the deterministic fixture generator in `demo/fixtures`.  
**Companion:** [Frozen product/API plan](WIZARD-OF-OZ-DEMO-PLAN.md) and [frontend/backend contract](FRONTEND-BACKEND-CONTRACT.md).  
**Scope:** Fictional static public-source captures plus one assumed-authorized police API mock record. All people and records are invented; the mock is inert fixture text, makes no API call, and contains no real identifiers or account data. These fixtures are not a production threat dataset and do not measure detector accuracy.

## Scenario

A proactive **Run scan** begins from an empty workspace and independently discovers four public leads through organic search, a public social post, a marketplace listing, and a Maps-style listing. The internal enrichment mock is static and pre-authored; no real API call, complaint, ad purchase, customer data, or manual upload is required. Every record is fictional and nonfunctional. All references use reserved `.test` names.

Initially, the four tickets look unrelated. The public evidence builds a connected path without asserting that a person or company committed fraud:

1. **TAMM typo-squat:** organic search result `EV-TAMM-001` → archived bilingual page `EV-TAMM-002` ↔ the same host/project reference in Cedar Spire's public portfolio archive `EV-TAMM-003`.
2. **Job post:** public LinkedIn-style post and static landing capture `EV-LI-001/002` → public advertiser disclosure naming Cedar Spire `EV-LI-003`.
3. **Marketplace seller:** public Cedar Select listing and trade-licence/activity mismatch `EV-MKT-001/002` → public marketplace terms naming Dune Fulfilment `EV-MKT-003` → independently published business directory linking Dune's fulfilment role with Cedar Spire's Cedar Select programme `EV-DIR-001`.
4. **Maps recovery:** public Maps-style listing `EV-MAPS-001` → archived service terms naming Dune Fulfilment `EV-MAPS-002` → the same independent directory `EV-DIR-001` → Cedar Spire.

The paths converge through cited public records. The directory relationship supports a public business connection only. It does not establish shared control, individual authorship, intent, a completed marketplace order, or fraudulent conduct. A licence mismatch, high salary, vague job duties, or fee language is a triage lead requiring review, not a verdict. The fixtures contain no real victim identities, complaint details, customer records, transactions, provider returns, or real private account data. One synthetic person appears only in a static internal-API mock with a cautious work-affiliation link; it is not an accusation and does not identify the job-post author.

## Fictional entities and stable IDs

All people, organizations, listings, disclosures, and records are invented. Source cards are short descriptive text captures; do not reproduce proprietary interfaces or use live links, forms, credentials, payment controls, redirects, contact details, or real identifiers.

| ID | Fixture entity | Meaning and limit |
| --- | --- | --- |
| `ENT-ORG-CSP-01` | Cedar Spire Services FZE | Fictional organization named in a public portfolio and advertiser disclosure. Association does not establish wrongdoing. |
| `ENT-ORG-DUNE-01` | Dune Fulfilment LLC | Fictional fulfilment company named in public marketplace/site terms and directory material. A named role does not prove performance or control. |
| `ENT-PERSON-MARIAM-01` | Mariam N. Sample / مريم ن. عينة | Entirely synthetic person name preserved exactly as written in the mock record. A possible work-affiliation edge does not connect this person to the job post, authorship, or wrongdoing. |
| `ENT-URL-TAMM-01` | TAMM typo-squat archive reference | Fictional organic search and archived bilingual fee-page captures. |
| `ENT-URL-LI-01` | High-pay vague-duty job capture | Fictional public post and static landing capture. Salary/duties are warning signals only. |
| `ENT-MARKET-LISTING-01` | Cedar Select marketplace listing | Fictional public seller/listing with a visible activity-category mismatch. |
| `ENT-URL-RECOVERY-01` | Maps recovery archive reference | Fictional public listing and archived service terms. |

### Relationship IDs and support

| Relationship | Evidence | Supported statement |
| --- | --- | --- |
| `REL-TAMM-SEARCH-ARCHIVE` | `EV-TAMM-001`, `EV-TAMM-002`, `EV-TAMM-003` | Organic result, archive, and portfolio reference connect at the organization/project level. |
| `REL-LI-ADVERTISER-CSP` | `EV-LI-001`, `EV-LI-002`, `EV-LI-003` | Public disclosure names Cedar Spire as advertiser for the captured post. No individual is identified. |
| `REL-LI-PERSON-AFFILIATION` | `EV-INT-001` | Weak possible work-affiliation link in the assumed-authorized mock only; it does not link a person to the captured post. |
| `REL-MKT-TERMS-DUNE` | `EV-MKT-001`, `EV-MKT-003` | Marketplace terms name Dune as a fulfilment operator for the seller programme. They do not prove an order was fulfilled. |
| `REL-DUNE-CSP-DIRECTORY` | `EV-MKT-002`, `EV-DIR-001` | Independent directory material connects Dune's stated role to Cedar Spire's Cedar Select programme. |
| `REL-MAPS-TERMS-DUNE` | `EV-MAPS-001`, `EV-MAPS-002` | Public listing leads to archived terms naming Dune as the service fulfilment company. |

Every graph relationship must cite one or more existing evidence IDs. Use support labels such as `observed` only for what the static source says; do not present an inference as a verified fact. Preserve uncertainty and competing benign explanations.

## Four campaign tickets

Risk scores are fixture-level triage examples, not calibrated probabilities or validated detector performance.

| Ticket | Discovery / finding | Score | Important limit |
| --- | --- | ---: | --- |
| `TKT-TAMM-001` | Organic search typo-squat result, bilingual archived page, public portfolio cross-reference | 90 / 100 | The portfolio link is an organization-level public association, not proof of individual operation or intent. No paid ad or loss record exists. |
| `TKT-LI-002` | Public job post: AED 20,000/month and vague duties; advertiser disclosure names Cedar Spire; one fictional internal API mock lists a possible work affiliation | 58 / 100 | High pay and vague duties are warning signals only. The mock does not establish post authorship, a real identity, victim, or completed application. |
| `TKT-MARKET-003` | Marketplace seller/licence mismatch, public fulfilment terms, independent directory link | 76 / 100 | The mismatch may have benign explanations. No private seller data, order history, or fulfilment event is present. |
| `TKT-MAPS-004` | Maps-style recovery listing and archived terms naming Dune Fulfilment | 72 / 100 | Listing ownership and service delivery are unknown. The public business link does not establish fraudulent activity. |

## Evidence register

The fixture generator is the source of truth for capture text, timestamps, source references, dossier fields, and ticket/evidence links. The synthetic person's mock residence/visa status is dated through 2027-06-30; this is an explicitly invented example, not a real status lookup. Public sources use `sourceClass: public_capture`; the one synthetic API mock uses `sourceClass: authorized_internal_mock`. Use these IDs consistently:

| Evidence IDs | Fixture evidence |
| --- | --- |
| `EV-TAMM-001`–`EV-TAMM-003` | Organic typo-squat search result; archived bilingual page; Cedar Spire portfolio archive referencing the same project host. |
| `EV-LI-001`–`EV-LI-003` | Public LinkedIn-style job post; static landing page; public advertiser transparency disclosure naming Cedar Spire. |
| `EV-INT-001` | Static fixture-only response from an assumed-authorized police internal API, naming a synthetic person and a possible work affiliation. No API call or real PII is present. |
| `EV-MKT-001`–`EV-MKT-003` | Marketplace seller/listing; public trade-licence directory; marketplace seller and fulfilment terms naming Dune. |
| `EV-DIR-001` | Independent public directory linking Dune's fulfilment role to Cedar Spire's Cedar Select programme. |
| `EV-MAPS-001`–`EV-MAPS-002` | Maps-style recovery listing; archived service terms naming Dune. |

Evidence items are static, fictional text records with descriptive source references on `.test` hosts. References are not network instructions and must never trigger external requests. Public-source labels in this fictional dataset do not assert that any real platform published these records.

## Discovery and reveal contract

1. A fresh workspace starts empty. **Run scan** emits the four public discoveries as tickets and cited evidence/graph upserts.
2. Surface the cases separately first: TAMM organic search, job post, marketplace seller mismatch, then Maps recovery.
3. Reveal the public cross-references: TAMM archive ↔ portfolio; job post ↔ advertiser disclosure ↔ Cedar Spire; marketplace listing ↔ marketplace terms ↔ Dune ↔ directory ↔ Cedar Spire; Maps listing ↔ archived terms ↔ Dune ↔ directory ↔ Cedar Spire.
4. Complete the run when all four tickets, cited source cards, entities, and relationships resolve, including the static assumed-authorized internal mock evidence on the job-post case. There is no manual upload/provider-request wait; the fixture does not call a real internal API.

The backend owns fixture event timing and sends normal ticket, evidence, entity, and relationship upserts. The frontend renders returned objects and must not hard-code scenario IDs. This is a demo narrative, not a claim of live scanning or integrations.

## Fixture-generator contract

The generator in `demo/fixtures/generate_fixtures.py` must:

- produce deterministic static outputs from standard-library Python without network calls;
- emit exactly the four tickets and the public plus internal-mock evidence paths described here;
- keep every bilingual report, evidence card, ticket reference, graph edge, and source hash consistent;
- preserve the synthetic person's English and Arabic name exactly as observed in the mock source;
- prove the four ticket subgraphs connect through observed, evidence-cited public records;
- classify public captures separately from the single `authorized_internal_mock` source; never represent the mock as a real API response or real person record;
- omit real identifiers, bank/account numbers, customer data, transactions, and complaints;
- retain uncertainty around attribution, ownership, intent, listing management, licensing explanations, and fulfilment;
- use only fictional `.test` references and noninteractive text artifacts;
- allow deterministic regeneration and `--check` to detect missing, stale, and unexpected generated files.

Generated fixture files support a future demo backend; they do not implement the API, perform investigations, make external requests, or prove allegations. The scenario can be replaced by another one that meets the same interface contract without frontend checks for these fixture IDs.
