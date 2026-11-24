# MANA'A Demo Fictional Casebook

**Status:** Scenario and evidence contract for the deterministic fixture generator in `demo/fixtures`.  
**Companion:** [Frozen product/API plan](WIZARD-OF-OZ-DEMO-PLAN.md) and [frontend/backend contract](FRONTEND-BACKEND-CONTRACT.md).  
**Scope:** Fictional static public-source captures only. These fixtures are not a production threat dataset and do not measure detector accuracy.

## Scenario

A proactive **Run scan** begins from an empty workspace and independently discovers four leads through organic search, a public social post, a marketplace listing, and a Maps-style listing. None requires a complaint, ad purchase, private account access, private provider return, financial record, or manual data import. Each item is fictional and nonfunctional. All hosts use reserved `.test` names.

Initially, the four tickets look unrelated. The public evidence builds a connected path without asserting that a person or company committed fraud:

1. **TAMM typo-squat:** organic search result `EV-TAMM-001` → archived bilingual page `EV-TAMM-002` ↔ the same host/project reference in Cedar Spire's public portfolio archive `EV-TAMM-003`.
2. **Job post:** public LinkedIn-style post and static landing capture `EV-LI-001/002` → public advertiser disclosure naming Cedar Spire `EV-LI-003`.
3. **Marketplace seller:** public Cedar Select listing and trade-licence/activity mismatch `EV-MKT-001/002` → public marketplace terms naming Dune Fulfilment `EV-MKT-003` → independently published business directory linking Dune's fulfilment role with Cedar Spire's Cedar Select programme `EV-DIR-001`.
4. **Maps recovery:** public Maps-style listing `EV-MAPS-001` → archived service terms naming Dune Fulfilment `EV-MAPS-002` → the same independent directory `EV-DIR-001` → Cedar Spire.

The paths converge through cited public records. The directory relationship supports a public business connection only. It does not establish shared control, individual authorship, intent, a completed marketplace order, or fraudulent conduct. A licence mismatch, high salary, vague job duties, or fee language is a triage lead requiring review, not a verdict. The fixtures contain no victim identities, complaint details, customer records, transactions, private provider data, or private account returns.

## Fictional entities and stable IDs

All people, organizations, listings, disclosures, and records are invented. Source cards are short descriptive text captures; do not reproduce proprietary interfaces or use live links, forms, credentials, payment controls, redirects, contact details, or real identifiers.

| ID | Fixture entity | Meaning and limit |
| --- | --- | --- |
| `ENT-ORG-CSP-01` | Cedar Spire Services FZE | Fictional organization named in a public portfolio and advertiser disclosure. Association does not establish wrongdoing. |
| `ENT-ORG-DUNE-01` | Dune Fulfilment LLC | Fictional fulfilment company named in public marketplace/site terms and directory material. A named role does not prove performance or control. |
| `ENT-URL-TAMM-01` | TAMM typo-squat archive reference | Fictional organic search and archived bilingual fee-page captures. |
| `ENT-URL-LI-01` | High-pay vague-duty job capture | Fictional public post and static landing capture. Salary/duties are warning signals only. |
| `ENT-MARKET-LISTING-01` | Cedar Select marketplace listing | Fictional public seller/listing with a visible activity-category mismatch. |
| `ENT-URL-RECOVERY-01` | Maps recovery archive reference | Fictional public listing and archived service terms. |

### Relationship IDs and support

| Relationship | Evidence | Supported statement |
| --- | --- | --- |
| `REL-TAMM-SEARCH-ARCHIVE` | `EV-TAMM-001`, `EV-TAMM-002`, `EV-TAMM-003` | Organic result, archive, and portfolio reference connect at the organization/project level. |
| `REL-LI-ADVERTISER-CSP` | `EV-LI-001`, `EV-LI-002`, `EV-LI-003` | Public disclosure names Cedar Spire as advertiser for the captured post. No individual is identified. |
| `REL-MKT-TERMS-DUNE` | `EV-MKT-001`, `EV-MKT-003` | Marketplace terms name Dune as a fulfilment operator for the seller programme. They do not prove an order was fulfilled. |
| `REL-DUNE-CSP-DIRECTORY` | `EV-MKT-002`, `EV-DIR-001` | Independent directory material connects Dune's stated role to Cedar Spire's Cedar Select programme. |
| `REL-MAPS-TERMS-DUNE` | `EV-MAPS-001`, `EV-MAPS-002` | Public listing leads to archived terms naming Dune as the service fulfilment company. |

Every graph relationship must cite one or more existing evidence IDs. Use support labels such as `observed` only for what the static source says; do not present an inference as a verified fact. Preserve uncertainty and competing benign explanations.

## Four campaign tickets

Risk scores are fixture-level triage examples, not calibrated probabilities or validated detector performance.

| Ticket | Discovery / finding | Score | Important limit |
| --- | --- | ---: | --- |
| `TKT-TAMM-001` | Organic search typo-squat result, bilingual archived page, public portfolio cross-reference | 90 / 100 | The portfolio link is an organization-level public association, not proof of individual operation or intent. No paid ad or loss record exists. |
| `TKT-LI-002` | Public job post: AED 20,000/month and vague duties; advertiser disclosure names Cedar Spire | 58 / 100 | High pay and vague duties are warning signals only. No victim or completed application is established. |
| `TKT-MARKET-003` | Marketplace seller/licence mismatch, public fulfilment terms, independent directory link | 76 / 100 | The mismatch may have benign explanations. No private seller data, order history, or fulfilment event is present. |
| `TKT-MAPS-004` | Maps-style recovery listing and archived terms naming Dune Fulfilment | 72 / 100 | Listing ownership and service delivery are unknown. The public business link does not establish fraudulent activity. |

## Evidence register

The fixture generator is the source of truth for capture text, timestamps, source references, and ticket/evidence links. Every source has `sourceClass: public_capture`; use these IDs consistently:

| Evidence IDs | Public capture |
| --- | --- |
| `EV-TAMM-001`–`EV-TAMM-003` | Organic typo-squat search result; archived bilingual page; Cedar Spire portfolio archive referencing the same project host. |
| `EV-LI-001`–`EV-LI-003` | Public LinkedIn-style job post; static landing page; public advertiser transparency disclosure naming Cedar Spire. |
| `EV-MKT-001`–`EV-MKT-003` | Marketplace seller/listing; public trade-licence directory; marketplace seller and fulfilment terms naming Dune. |
| `EV-DIR-001` | Independent public directory linking Dune's fulfilment role to Cedar Spire's Cedar Select programme. |
| `EV-MAPS-001`–`EV-MAPS-002` | Maps-style recovery listing; archived service terms naming Dune. |

Evidence items are static, fictional text records with descriptive source references on `.test` hosts. References are not network instructions and must never trigger external requests. Public-source labels in this fictional dataset do not assert that any real platform published these records.

## Discovery and reveal contract

1. A fresh workspace starts empty. **Run scan** emits the four public discoveries as tickets and cited evidence/graph upserts.
2. Surface the cases separately first: TAMM organic search, job post, marketplace seller mismatch, then Maps recovery.
3. Reveal the public cross-references: TAMM archive ↔ portfolio; job post ↔ advertiser disclosure ↔ Cedar Spire; marketplace listing ↔ marketplace terms ↔ Dune ↔ directory ↔ Cedar Spire; Maps listing ↔ archived terms ↔ Dune ↔ directory ↔ Cedar Spire.
4. Complete the run when all four tickets, cited source cards, entities, and relationships resolve. No later manual import or private-data phase exists.

The backend owns fixture event timing and sends normal ticket, evidence, entity, and relationship upserts. The frontend renders returned objects and must not hard-code scenario IDs. This is a demo narrative, not a claim of live scanning or integrations.

## Fixture-generator contract

The generator in `demo/fixtures/generate_fixtures.py` must:

- produce deterministic static outputs from standard-library Python without network calls;
- emit exactly the four tickets and public evidence paths described here;
- keep every report, evidence card, ticket reference, graph edge, and source hash consistent;
- prove the four ticket subgraphs connect through observed, evidence-cited public records;
- keep all source records classified as public captures and omit private imports, bank/provider records, customer data, transactions, complaints, and manual dependencies;
- retain uncertainty around attribution, ownership, intent, listing management, licensing explanations, and fulfilment;
- use only fictional `.test` references and noninteractive text artifacts;
- allow deterministic regeneration and `--check` to detect missing, stale, and unexpected generated files.

Generated fixture files support a future demo backend; they do not implement the API, perform investigations, make external requests, or prove allegations. The scenario can be replaced by another one that meets the same interface contract without frontend checks for these fixture IDs.
