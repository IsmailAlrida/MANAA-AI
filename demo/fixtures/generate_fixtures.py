#!/usr/bin/env python3
"""Generate deterministic fictional public-OSINT demo fixtures; no network access."""
from __future__ import annotations
import argparse, hashlib, json, re, sys
from collections import Counter
from pathlib import Path
from string import Template

HERE = Path(__file__).resolve().parent
TEMPLATES = HERE / "templates"
DEFAULT_OUTPUT = HERE / "generated"
REVISION = 1
DATE = "2026-11-24"

def ev(id, title, kind, at, ref, method, description, text, limitations, language="en", support="observed"):
    return {"id":id,"title":title,"recordType":kind,"capturedAt":at,"sourceReference":ref,"collectionMethod":method,"description":description,"originalText":text,"limitations":limitations,"language":language,"support":support,"assetRef":f"/api/v1/assets/{id}","sourceClass":"public_capture","revealPhase":"public"}

SOURCES = [
 ev("EV-TAMM-001","Organic typo-squat search result","search_capture","2026-11-24T08:03:00Z","https://search.example.test/results?q=tamm+fees","static_organic_result_capture","An organic result for a misspelled TAMM fee query points to an unrelated reserved `.test` host. No paid placement or ad account is shown.","Result title: TAMM fee review · result type: organic · destination: tamm-fees.example.test","Fictional text capture. It does not reproduce an actual search result or imply a live page."),
 ev("EV-TAMM-002","Archived bilingual fee-page capture","archive_capture","2026-11-24T08:04:00Z","https://archive.example.test/captures/tamm-fees-01","static_archive_text_capture","The archived static page uses bilingual traffic-fine and UAE PASS wording and a host that differs from the fictional government reference. No form, credential field, or payment control is present.","Traffic fee due · Continue with UAE PASS · راجع رسوم المخالفة","Original fictional capture, nonfunctional and not a real service clone.","en-ar"),
 ev("EV-TAMM-003","Cedar Spire public portfolio archive","portfolio_capture","2026-11-24T08:05:00Z","https://portfolio.example.test/cedar-spire/projects/service-notices","static_public_portfolio_capture","A public portfolio archive lists the same `tamm-fees.example.test` project reference and a matching project title. This links the archived page to the public portfolio entity, without identifying an individual operator.","Project: bilingual service-notice microsite · archived preview host: tamm-fees.example.test","Fictional portfolio text. A portfolio credit does not establish who authored or knowingly operated the page."),
 ev("EV-LI-001","Public LinkedIn job-post capture","social_post_capture","2026-11-24T08:07:00Z","https://social.example.test/posts/role-204","static_public_post_capture","A fictional public job post offers AED 20,000 per month for vague duties and links to a static landing page. It is a warning signal only.","Operations opportunity · AED 20,000/month · coordinate assigned work · details on role page","Fictional text snapshot. No real LinkedIn interface, applicant, or victim is represented."),
 ev("EV-LI-002","Static job landing-page archive","archive_capture","2026-11-24T08:08:00Z","https://archive.example.test/captures/csp-role-02","static_archive_text_capture","The landing capture repeats the salary and vague duties. It contains no application, login, fee, or contact interaction.","AED 20,000/month · assist operations and coordinate assigned work","The salary and generic duties do not prove fraud or victimization."),
 ev("EV-LI-003","Public advertiser transparency disclosure","advertiser_disclosure","2026-11-24T08:09:00Z","https://ads.example.test/library/disclosure/csp-role-02","static_public_ad_disclosure_capture","A public advertiser disclosure names Cedar Spire Services FZE as the disclosed advertiser for the captured job post and references its archive ID.","Disclosed advertiser: Cedar Spire Services FZE · post reference: ROLE-204","Fictional public disclosure. It supports an organization-level campaign link, not individual authorship or intent."),
 ev("EV-MKT-001","Marketplace seller listing capture","marketplace_capture","2026-11-24T08:12:00Z","https://market.example.test/listings/seller-88/item-12","static_public_listing_capture","A public marketplace listing uses seller label Cedar Select and displays a trade-licence category that does not match the separately captured registry activity category.","Seller: Cedar Select · licence category displayed: IT consultancy · listing category: consumer electronics","Fictional public listing snapshot. The mismatch is a review lead, not a fraud finding."),
 ev("EV-MKT-002","Public trade-licence directory record","directory_capture","2026-11-24T08:13:00Z","https://directory.example.test/entities/cedar-spire","static_public_directory_capture","The public directory record for Cedar Spire lists a consultancy activity category and a public trading-name reference, Cedar Select. This corroborates the visible seller/licence mismatch while leaving authorization and fulfilment unresolved.","Entity: Cedar Spire Services FZE · public trade name: Cedar Select · listed activity: IT consultancy","All entities and records are fictional. No real licence identifier is included."),
 ev("EV-MKT-003","Marketplace public seller and fulfilment terms","marketplace_terms_capture","2026-11-24T08:14:00Z","https://market.example.test/policies/seller-fulfilment","static_public_terms_capture","The marketplace's public terms name Dune Fulfilment LLC as the fulfilment operator for the captured seller programme and explain that seller and fulfilment roles may differ.","Seller remains responsible for listing accuracy · fulfilment operator: Dune Fulfilment LLC","Terms are fictional. This record does not by itself establish that Dune handled a particular order."),
 ev("EV-DIR-001","Independent public directory links Cedar Spire and Dune","directory_capture","2026-11-24T08:15:00Z","https://directory.example.test/partners/dune-cedar","static_public_directory_capture","An independent public business directory lists Cedar Spire's Cedar Select programme and Dune Fulfilment LLC under the same published fulfilment relationship. This is the public bridge used across the cases.","Cedar Select programme · fulfilment partner: Dune Fulfilment LLC","Fictional directory record. Shared business relationship does not establish common control or wrongdoing."),
 ev("EV-MAPS-001","Public Maps-style recovery listing","maps_listing_capture","2026-11-24T08:18:00Z","https://maps.example.test/listings/recovery-41","static_public_listing_capture","A fictional Maps-style listing promotes document and payment recovery services and links by text reference to a static service site. No real address, phone number, coordinates, or action is included.","Recovery desk · document and payment recovery · service details at rapid-return.example.test","Text-only fictional listing; no copied map interface or contact details."),
 ev("EV-MAPS-002","Archived recovery-site terms","archive_capture","2026-11-24T08:19:00Z","https://archive.example.test/captures/recovery-terms-01","static_archive_text_capture","The archived terms page names Dune Fulfilment LLC as the service fulfilment company and mentions an advance review fee. It is static text only.","Service fulfilment company: Dune Fulfilment LLC · review fee applies before outcome","Fictional archived text. The listed role does not prove who controlled the listing or whether a service was delivered."),
]
ENTITIES = [
 ("ENT-ORG-CSP-01","company","Cedar Spire Services FZE",["EV-TAMM-003","EV-LI-003","EV-MKT-002","EV-DIR-001"]),
 ("ENT-ORG-DUNE-01","company","Dune Fulfilment LLC",["EV-MKT-003","EV-DIR-001","EV-MAPS-002"]),
 ("ENT-URL-TAMM-01","url","TAMM typo-squat archive reference",["EV-TAMM-001","EV-TAMM-002","EV-TAMM-003"]),
 ("ENT-URL-LI-01","url","AED 20,000/month job landing capture",["EV-LI-001","EV-LI-002"]),
 ("ENT-MARKET-LISTING-01","marketplace_listing","Cedar Select marketplace listing",["EV-MKT-001","EV-MKT-002"]),
 ("ENT-URL-RECOVERY-01","url","Recovery service archive reference",["EV-MAPS-001","EV-MAPS-002"]),
]
RELATIONS = [
 ("REL-TAMM-SEARCH-ARCHIVE","ENT-URL-TAMM-01","ENT-ORG-CSP-01","portfolio_reference","EV-TAMM-001 EV-TAMM-002 EV-TAMM-003","The organic result leads to an archived page whose host and project reference appear in Cedar Spire's public portfolio; this is an organization-level public link."),
 ("REL-LI-ADVERTISER-CSP","ENT-URL-LI-01","ENT-ORG-CSP-01","public_advertiser_disclosure","EV-LI-001 EV-LI-002 EV-LI-003","The public disclosure names Cedar Spire as advertiser for the post; individual authorship and intent remain unknown."),
 ("REL-MKT-TERMS-DUNE","ENT-MARKET-LISTING-01","ENT-ORG-DUNE-01","public_fulfilment_terms","EV-MKT-001 EV-MKT-003","Marketplace terms name Dune as fulfilment operator; the seller/licence mismatch is not itself evidence of a completed sale."),
 ("REL-DUNE-CSP-DIRECTORY","ENT-ORG-DUNE-01","ENT-ORG-CSP-01","public_business_directory_link","EV-MKT-002 EV-DIR-001","An independent public directory connects Cedar Spire's Cedar Select programme and Dune's fulfilment role."),
 ("REL-MAPS-TERMS-DUNE","ENT-URL-RECOVERY-01","ENT-ORG-DUNE-01","public_site_terms","EV-MAPS-001 EV-MAPS-002","The public Maps-style capture points to archived site terms that name Dune as fulfilment company."),
]
TICKETS = [
 {"id":"TKT-TAMM-001","title":"Organic TAMM typo-squat result","riskScore":90,"closingDate":"2026-11-27","summary":"An organic search capture led to an archived bilingual traffic-fee page on a typo-squat host. A public Cedar Spire portfolio archive references the same project host. These public records support a company-level association, not individual attribution or intent.","reasons":"Organic typo-squat result and bilingual service prompt (EV-TAMM-001, EV-TAMM-002); matching public portfolio reference (EV-TAMM-003).","uncertainty":"No paid ad, private provider return, payment record, victim record, or individual operator evidence is present. The public portfolio link does not establish knowledge or wrongdoing.","evidenceIds":["EV-TAMM-001","EV-TAMM-002","EV-TAMM-003"],"entityIds":["ENT-URL-TAMM-01","ENT-ORG-CSP-01"],"relationshipIds":["REL-TAMM-SEARCH-ARCHIVE"]},
 {"id":"TKT-LI-002","title":"High-pay vague-duty job post","riskScore":58,"closingDate":"2026-11-28","summary":"A public LinkedIn-style job post offers AED 20,000/month for vague duties. A public advertiser disclosure names Cedar Spire. Salary and vague duties are triage signals only; no applicant harm is established.","reasons":"Public post and static landing capture (EV-LI-001, EV-LI-002); public advertiser transparency disclosure (EV-LI-003).","uncertainty":"No victim, payment, complaint, or verified individual recruiter is recorded. The ad disclosure ties the campaign to an organization, not a person or intent.","evidenceIds":["EV-LI-001","EV-LI-002","EV-LI-003"],"entityIds":["ENT-URL-LI-01","ENT-ORG-CSP-01"],"relationshipIds":["REL-LI-ADVERTISER-CSP"]},
 {"id":"TKT-MARKET-003","title":"Marketplace seller licence mismatch","riskScore":76,"closingDate":"2026-11-29","summary":"A marketplace listing shows a seller/licence-category mismatch. Public marketplace terms name Dune Fulfilment, and an independent directory links Dune's fulfilment role to Cedar Spire's Cedar Select programme. The relationship is evidence of a public business connection, not proof of a completed sale or fraud.","reasons":"Seller listing and public activity directory mismatch (EV-MKT-001, EV-MKT-002); public marketplace fulfilment terms (EV-MKT-003); independent business directory corroboration (EV-DIR-001).","uncertainty":"No private seller data, order history, payments, customer identities, or fulfilment event is included. Licensing mismatch can have benign explanations and needs verification.","evidenceIds":["EV-MKT-001","EV-MKT-002","EV-MKT-003","EV-DIR-001"],"entityIds":["ENT-MARKET-LISTING-01","ENT-ORG-DUNE-01","ENT-ORG-CSP-01"],"relationshipIds":["REL-MKT-TERMS-DUNE","REL-DUNE-CSP-DIRECTORY"]},
 {"id":"TKT-MAPS-004","title":"Maps-listed recovery service","riskScore":72,"closingDate":"2026-11-30","summary":"A public Maps-style listing points to archived site terms naming Dune Fulfilment as service fulfilment company. The independent directory links Dune to Cedar Spire's public business programme, creating a public-record path into the same network.","reasons":"Public listing and archived terms (EV-MAPS-001, EV-MAPS-002); cross-reference to the independent public directory (EV-DIR-001).","uncertainty":"No private provider records, customer complaints, payment records, or verified listing owner are included. The named fulfilment role does not prove control of the listing or fraudulent conduct.","evidenceIds":["EV-MAPS-001","EV-MAPS-002","EV-DIR-001"],"entityIds":["ENT-URL-RECOVERY-01","ENT-ORG-DUNE-01","ENT-ORG-CSP-01"],"relationshipIds":["REL-MAPS-TERMS-DUNE","REL-DUNE-CSP-DIRECTORY"]},
]

def render_source(row):
 vals={"evidence_id":row["id"],"title":row["title"],"record_type":row["recordType"],"captured_at":row["capturedAt"],"source_reference":row["sourceReference"],"capture_method":row["collectionMethod"],"language":row["language"],"support":row["support"],"description":row["description"],"original_text":row["originalText"],"limitations":row["limitations"]}
 return Template((TEMPLATES/"source-card.md.tmpl").read_text(encoding="utf-8")).substitute(vals)

def build():
 sources={r["id"]:dict(r) for r in SOURCES}
 for r in sources.values(): r["sha256"]=hashlib.sha256(render_source(r).encode()).hexdigest()
 entities=[{"id":i,"kind":k,"label":label,"attributes":{"fictional":True},"observedAt":DATE+"T08:00:00Z","support":"observed","uncertainty":None,"provenance":[{"evidenceId":x} for x in ids],"revision":REVISION} for i,k,label,ids in ENTITIES]
 rels=[]
 for i,a,b,k,evs,rationale in RELATIONS: rels.append({"id":i,"fromEntityId":a,"toEntityId":b,"kind":k,"support":"observed","rationale":rationale,"observedAt":DATE+"T08:20:00Z","evidenceIds":evs.split(),"revision":REVISION})
 tickets=[]
 for t in TICKETS:
  citations="\n".join(f"- [{eid}]({sources[eid]['assetRef']}) — {sources[eid]['title']}" for eid in t["evidenceIds"])
  report=f"# {t['title']}\n\n**Ticket:** `{t['id']}`  \n**Risk score:** **{t['riskScore']}/100** — triage score, not a probability or finding of guilt.  \n**Proposed closing date:** {t['closingDate']}\n\n## Assessment\n\n{t['summary']}\n\n## Why it is prioritized\n\n{t['reasons']}\n\n## What remains unknown\n\n{t['uncertainty']}\n\n## Public evidence\n\n{citations}\n"
  blocks=[{"id":f"BLK-{t['id']}-REPORT","type":"markdown","text":report}]
  for eid in t["evidenceIds"]:
   e=sources[eid]; blocks.append({"id":f"BLK-{eid}","type":"evidence","evidenceId":eid,"title":e["title"],"summary":e["description"],"sourceReference":e["sourceReference"],"capturedAt":e["capturedAt"],"collectionMethod":e["collectionMethod"],"language":e["language"],"support":e["support"],"asset":{"url":e["assetRef"],"mimeType":"text/markdown","sha256":e["sha256"]}})
  tickets.append({"id":t["id"],"revision":REVISION,"title":t["title"],"createdAt":min(sources[e]["capturedAt"] for e in t["evidenceIds"]),"updatedAt":max(sources[e]["capturedAt"] for e in t["evidenceIds"]),"closingDate":t["closingDate"],"status":"open","reportMarkdown":report,"blocks":blocks,"entityIds":t["entityIds"],"relationshipIds":t["relationshipIds"],"evidenceIds":t["evidenceIds"]})
 data={"workspaceId":"workspace-demo-public-osint-01","revision":REVISION,"generatedForDate":DATE,"entities":entities,"relationships":rels,"tickets":tickets}
 out={"workspace.json":json.dumps(data,ensure_ascii=False,indent=2,sort_keys=True)+"\n"}
 events=[{"at":r["capturedAt"],"type":"evidence_available","evidenceId":r["id"],"title":r["title"],"ticketIds":[t["id"] for t in TICKETS if r["id"] in t["evidenceIds"]]} for r in sorted(SOURCES,key=lambda x:(x["capturedAt"],x["id"]))]
 out["backend-reveal-timeline.json"]=json.dumps({"purpose":"public OSINT demo fixture schedule only","events":events},ensure_ascii=False,indent=2,sort_keys=True)+"\n"
 out["README.md"]="# Generated fictional public OSINT fixtures\n\nDeterministic static captures for four fictional cases. All records are public-source-style text artifacts using reserved `.test` hosts. No live scanning, requests, ads, forms, redirects, customer data, private provider imports, or transactions are implemented. The four evidence paths converge through public portfolio/ad disclosure, marketplace terms, and independent business directory captures.\n\nRun `python3 generate_fixtures.py` to generate. Run `python3 generate_fixtures.py --check` to compare expected output without writing. Uses only the Python standard library.\n"
 for eid,r in sources.items(): out[f"sources/{eid}.md"]=render_source(r)
 for t in TICKETS:
  data_ticket=next(x for x in tickets if x["id"]==t["id"])
  out[f"reports/{t['id']}.md"]=next(x["text"] for x in data_ticket["blocks"] if x["type"]=="markdown")
 out["profiles/organizations.md"]="# Fictional public business records\n\nCedar Spire Services FZE, Cedar Select, and Dune Fulfilment LLC are fictional. Public directory and disclosure captures connect public business roles only. They do not establish common control, personal involvement, or wrongdoing.\n"
 out["profiles/collection-scope.md"]="# Collection scope\n\nThis demo uses retrospective fictional public captures only: organic search, archived pages, public portfolio material, advertiser disclosures, marketplace listings and terms, Maps-style listing text, and independent public directories. The scan has no ad buying, private account access, provider imports, customer transaction data, or network collection.\n"
 return out,data,sources

def validate(out,data,sources):
 errors=[]; eids={x["id"] for x in data["entities"]}; rids={x["id"] for x in data["relationships"]}; tids={x["id"] for x in data["tickets"]}; sids=set(sources)
 for label,rows in (("entity",data["entities"]),("relationship",data["relationships"]),("ticket",data["tickets"])): errors += [f"duplicate {label} id {k}" for k,n in Counter(r["id"] for r in rows).items() if n>1]
 for r in data["relationships"]:
  if r["fromEntityId"] not in eids or r["toEntityId"] not in eids: errors.append(f"unresolved endpoint in {r['id']}")
  if not r["evidenceIds"] or any(e not in sids for e in r["evidenceIds"]): errors.append(f"unresolved evidence in {r['id']}")
 for t in data["tickets"]:
  if any(x not in eids for x in t["entityIds"]): errors.append(f"unresolved entity in {t['id']}")
  if any(x not in rids for x in t["relationshipIds"]): errors.append(f"unresolved relationship in {t['id']}")
  if any(x not in sids for x in t["evidenceIds"]): errors.append(f"unresolved source in {t['id']}")
  if "authorized_import" in t["reportMarkdown"] or "TXN-" in t["reportMarkdown"]: errors.append(f"private/transaction language in {t['id']}")
 required={"TKT-TAMM-001","TKT-LI-002","TKT-MARKET-003","TKT-MAPS-004"}
 if tids != required: errors.append(f"ticket set mismatch: {tids}")
 adj={x:set() for x in eids}
 for r in data["relationships"]: adj[r["fromEntityId"]].add(r["toEntityId"]); adj[r["toEntityId"]].add(r["fromEntityId"])
 seen=set(); stack=["ENT-ORG-CSP-01"]
 while stack:
  x=stack.pop()
  if x in seen: continue
  seen.add(x); stack.extend(adj[x]-seen)
 case_entities=set().union(*(set(t["entityIds"]) for t in data["tickets"]))
 if not case_entities <= seen: errors.append(f"disconnected entities: {case_entities-seen}")
 alltext="\n".join(out.values())
 for bad in ("authorized_case_import","casefile.example.test","EV-CORP-","EV-HOST-","EV-BANK-","EV-MAP-003","TXN-"):
  if bad in alltext: errors.append(f"stale private scenario marker: {bad}")
 if re.search(r"https?://(?![^/]*\.test(?:/|$))[^\s)]+",alltext): errors.append("non-.test URL found")
 if any(s.get("sourceClass")!="public_capture" for s in sources.values()): errors.append("non-public source class")
 return errors

def main():
 p=argparse.ArgumentParser(); p.add_argument("--output",type=Path,default=DEFAULT_OUTPUT); p.add_argument("--check",action="store_true"); a=p.parse_args()
 out,data,sources=build(); errors=validate(out,data,sources)
 if errors: print("\n".join("ERROR: "+e for e in errors),file=sys.stderr); return 1
 target=a.output.resolve()
 if a.check:
  missing=[k for k in out if not (target/k).is_file()]; stale=[k for k,v in out.items() if (target/k).is_file() and (target/k).read_text(encoding="utf-8")!=v]
  if missing or stale:
   for x in missing: print("MISSING: "+x,file=sys.stderr)
   for x in stale: print("STALE: "+x,file=sys.stderr)
   return 1
  unexpected=[str(x.relative_to(target)) for x in target.rglob("*") if x.is_file() and x.relative_to(target).as_posix() not in out]
  if unexpected:
   for x in unexpected: print("UNEXPECTED: "+x,file=sys.stderr)
   return 1
  print(f"Fixture output is current ({len(out)} files): {target}"); return 0
 target.mkdir(parents=True,exist_ok=True)
 for x in sorted(target.rglob("*"),reverse=True):
  if x.is_file(): x.unlink()
  elif x.is_dir(): x.rmdir()
 for name,content in out.items():
  dest=target/name; dest.parent.mkdir(parents=True,exist_ok=True); dest.write_text(content,encoding="utf-8",newline="\n")
 print(f"Generated {len(out)} deterministic files: {target}"); return 0
if __name__=="__main__": raise SystemExit(main())
