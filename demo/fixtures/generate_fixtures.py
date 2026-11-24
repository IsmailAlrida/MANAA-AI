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
INTERNAL_SOURCE = ev(
 "EV-INT-001",
 "Assumed police internal index match (fictional mock)",
 "authorized_internal_mock",
 "2026-11-24T08:10:00Z",
 "https://police-internal.example.test/mock/person/001",
 "static_assumed_authorized_internal_api_capture",
 "A fictional mock response from an assumed authorized police internal API lists a work affiliation for the synthetic person Mariam N. Sample (مريم ن. عينة) at Cedar Spire Services FZE. It does not identify an author of the captured job post, provide an EID/passport/phone/account number, or indicate an offence. The mock residence/visa status is active through 2027-06-30. This is fixture data only; no API is called.",
 "Synthetic subject: Mariam N. Sample · Arabic name as recorded: مريم ن. عينة · work affiliation: Cedar Spire Services FZE · fictional residence/visa status: active through 2027-06-30 · role: unknown · offence or post authorship: not established",
 "Entirely invented mock record. No real person or law-enforcement record is represented. The dated residence/visa status is synthetic, not linked to a usable identifier, and not a real status lookup; no identifiers or account values are included. It cannot establish that the subject authored the job post or committed wrongdoing.",
 "en-ar",
 "possible",
)
INTERNAL_SOURCE["sourceClass"] = "authorized_internal_mock"
SOURCES.append(INTERNAL_SOURCE)
ENTITIES = [
 ("ENT-ORG-CSP-01","company","Cedar Spire Services FZE",["EV-TAMM-003","EV-LI-003","EV-MKT-002","EV-DIR-001"]),
 ("ENT-ORG-DUNE-01","company","Dune Fulfilment LLC",["EV-MKT-003","EV-DIR-001","EV-MAPS-002"]),
 ("ENT-PERSON-MARIAM-01","person","Mariam N. Sample",["EV-INT-001"]),
 ("ENT-URL-TAMM-01","url","TAMM typo-squat archive reference",["EV-TAMM-001","EV-TAMM-002","EV-TAMM-003"]),
 ("ENT-URL-LI-01","url","AED 20,000/month job landing capture",["EV-LI-001","EV-LI-002"]),
 ("ENT-MARKET-LISTING-01","marketplace_listing","Cedar Select marketplace listing",["EV-MKT-001","EV-MKT-002"]),
 ("ENT-URL-RECOVERY-01","url","Recovery service archive reference",["EV-MAPS-001","EV-MAPS-002"]),
]
RELATIONS = [
 ("REL-TAMM-SEARCH-ARCHIVE","ENT-URL-TAMM-01","ENT-ORG-CSP-01","portfolio_reference","EV-TAMM-001 EV-TAMM-002 EV-TAMM-003","The organic result leads to an archived page whose host and project reference appear in Cedar Spire's public portfolio; this is an organization-level public link."),
 ("REL-LI-ADVERTISER-CSP","ENT-URL-LI-01","ENT-ORG-CSP-01","public_advertiser_disclosure","EV-LI-001 EV-LI-002 EV-LI-003","The public disclosure names Cedar Spire as advertiser for the post; individual authorship and intent remain unknown."),
 ("REL-LI-PERSON-AFFILIATION","ENT-PERSON-MARIAM-01","ENT-ORG-CSP-01","possible_work_affiliation","EV-INT-001","An assumed authorized internal API mock lists a work affiliation only; it does not link the person to the captured post or establish authorship, an offence, or intent."),
 ("REL-MKT-TERMS-DUNE","ENT-MARKET-LISTING-01","ENT-ORG-DUNE-01","public_fulfilment_terms","EV-MKT-001 EV-MKT-003","Marketplace terms name Dune as fulfilment operator; the seller/licence mismatch is not itself evidence of a completed sale."),
 ("REL-DUNE-CSP-DIRECTORY","ENT-ORG-DUNE-01","ENT-ORG-CSP-01","public_business_directory_link","EV-MKT-002 EV-DIR-001","An independent public directory connects Cedar Spire's Cedar Select programme and Dune's fulfilment role."),
 ("REL-MAPS-TERMS-DUNE","ENT-URL-RECOVERY-01","ENT-ORG-DUNE-01","public_site_terms","EV-MAPS-001 EV-MAPS-002","The public Maps-style capture points to archived site terms that name Dune as fulfilment company."),
]
TICKETS = [
 {"id":"TKT-TAMM-001","title":"Organic TAMM typo-squat result","riskScore":90,"closingDate":"2026-11-27","summary":"An organic search capture led to an archived bilingual traffic-fee page on a typo-squat host. A public Cedar Spire portfolio archive references the same project host. These public records support a company-level association, not individual attribution or intent.","reasons":"Organic typo-squat result and bilingual service prompt (EV-TAMM-001, EV-TAMM-002); matching public portfolio reference (EV-TAMM-003).","uncertainty":"No paid ad, private provider return, payment record, victim record, or individual operator evidence is present. The public portfolio link does not establish knowledge or wrongdoing.","evidenceIds":["EV-TAMM-001","EV-TAMM-002","EV-TAMM-003"],"entityIds":["ENT-URL-TAMM-01","ENT-ORG-CSP-01"],"relationshipIds":["REL-TAMM-SEARCH-ARCHIVE"]},
 {"id":"TKT-LI-002","title":"High-pay vague-duty job post","riskScore":58,"closingDate":"2026-11-28","summary":"A public LinkedIn-style job post offers AED 20,000/month for vague duties and a public disclosure names Cedar Spire as advertiser. An assumed-authorized internal API mock lists a work affiliation for the fictional person Mariam N. Sample (مريم ن. عينة). It does not link this person to the post or establish authorship, an offence, or applicant harm.","reasons":"Public post and static landing capture (EV-LI-001, EV-LI-002); public advertiser disclosure (EV-LI-003); assumed-authorized fictional API mock (EV-INT-001).","uncertainty":"The internal record is entirely synthetic and provides no real identifier. It does not establish that the named fictional person authored the post or committed wrongdoing. No victim, payment, or complaint is recorded.","evidenceIds":["EV-LI-001","EV-LI-002","EV-LI-003","EV-INT-001"],"entityIds":["ENT-URL-LI-01","ENT-ORG-CSP-01","ENT-PERSON-MARIAM-01"],"relationshipIds":["REL-LI-ADVERTISER-CSP","REL-LI-PERSON-AFFILIATION"]},
 {"id":"TKT-MARKET-003","title":"Marketplace seller licence mismatch","riskScore":76,"closingDate":"2026-11-29","summary":"A marketplace listing shows a seller/licence-category mismatch. Public marketplace terms name Dune Fulfilment, and an independent directory links Dune's fulfilment role to Cedar Spire's Cedar Select programme. The relationship is evidence of a public business connection, not proof of a completed sale or fraud.","reasons":"Seller listing and public activity directory mismatch (EV-MKT-001, EV-MKT-002); public marketplace fulfilment terms (EV-MKT-003); independent business directory corroboration (EV-DIR-001).","uncertainty":"No private seller data, order history, payments, customer identities, or fulfilment event is included. Licensing mismatch can have benign explanations and needs verification.","evidenceIds":["EV-MKT-001","EV-MKT-002","EV-MKT-003","EV-DIR-001"],"entityIds":["ENT-MARKET-LISTING-01","ENT-ORG-DUNE-01","ENT-ORG-CSP-01"],"relationshipIds":["REL-MKT-TERMS-DUNE","REL-DUNE-CSP-DIRECTORY"]},
 {"id":"TKT-MAPS-004","title":"Maps-listed recovery service","riskScore":72,"closingDate":"2026-11-30","summary":"A public Maps-style listing points to archived site terms naming Dune Fulfilment as service fulfilment company. The independent directory links Dune to Cedar Spire's public business programme, creating a public-record path into the same network.","reasons":"Public listing and archived terms (EV-MAPS-001, EV-MAPS-002); cross-reference to the independent public directory (EV-DIR-001).","uncertainty":"No private provider records, customer complaints, payment records, or verified listing owner are included. The named fulfilment role does not prove control of the listing or fraudulent conduct.","evidenceIds":["EV-MAPS-001","EV-MAPS-002","EV-DIR-001"],"entityIds":["ENT-URL-RECOVERY-01","ENT-ORG-DUNE-01","ENT-ORG-CSP-01"],"relationshipIds":["REL-MAPS-TERMS-DUNE","REL-DUNE-CSP-DIRECTORY"]},
]

# Final-stage Arabic narrative is authored in the fixture source. Source captures
# and proper-name variants remain unchanged; there is no runtime translation.
TICKET_COPY_AR = {
    "TKT-TAMM-001": {
        "title": "نتيجة بحث عضوية لموقع ينتحل خدمات TAMM",
        "summary": "أوصلت نتيجة بحث عضوية إلى صفحة رسوم ثنائية اللغة محفوظة في الأرشيف على نطاق ينتحل الخدمة. ويشير أرشيف المحفظة العامة لشركة Cedar Spire إلى النطاق نفسه للمشروع. وتدعم هذه السجلات العامة وجود ارتباط على مستوى الشركة، لكنها لا تثبت هوية أي شخص أو علمه أو قصده.",
        "priorityReason": "نتيجة البحث العضوية والنص الثنائي اللغة لطلب الخدمة (EV-TAMM-001 وEV-TAMM-002)، مع مرجع مطابق في المحفظة العامة (EV-TAMM-003).",
        "uncertainty": "لا يتضمن هذا السجل إعلاناً مدفوعاً أو سجلاً من مزود خاص أو سجلاً للدفع أو الضحايا أو دليلاً يحدد مشغلاً بعينه. ولا يثبت رابط المحفظة العامة العلم أو ارتكاب مخالفة.",
    },
    "TKT-LI-002": {
        "title": "إعلان وظيفة براتب مرتفع ومهام مبهمة",
        "summary": "يعرض منشور عام بأسلوب LinkedIn وظيفة براتب AED 20,000 شهرياً مع مهام مبهمة، ويسمي إفصاح عام شركة Cedar Spire معلناً. ويعرض سجل تجريبي مفترض من واجهة داخلية مصرح بها ارتباط عمل لشخصية خيالية اسمها Mariam N. Sample (مريم ن. عينة) بالشركة. ولا يربط السجل الشخص بالإعلان أو يثبت مخالفة أو تعرض متقدم للضرر.",
        "priorityReason": "المنشور والصفحة الثابتة (EV-LI-001 وEV-LI-002)، وإفصاح المعلن (EV-LI-003)، وسجل الارتباط الوظيفي التجريبي المفترض (EV-INT-001).",
        "uncertainty": "الاسم والارتباط الوظيفي في السجل الداخلي بيانات خيالية اختبارية. لا يحدد السجل كاتب الإعلان أو مسؤول التوظيف، ولا يتضمن ضحية أو دفعة أو شكوى أو رقماً تعريفياً حقيقياً. لا يثبت أي دور في الإعلان أو قصداً أو مخالفة.",
    },
    "TKT-MARKET-003": {
        "title": "عدم تطابق فئة البائع مع الرخصة التجارية في السوق الإلكتروني",
        "summary": "يعرض إدراج في السوق الإلكتروني اختلافاً بين فئة المنتج ونشاط الرخصة التجارية المسجل. وتسمي شروط السوق العامة Dune Fulfilment، ويربط دليل تجاري مستقل دور Dune Fulfilment ببرنامج Cedar Select التابع لشركة Cedar Spire. وتدل هذه السجلات على صلة تجارية عامة فقط، ولا تثبت إتمام بيع أو وقوع احتيال.",
        "priorityReason": "إدراج البائع والسجل العام لنشاطه (EV-MKT-001 وEV-MKT-002)، وشروط التنفيذ العامة للسوق (EV-MKT-003)، وتأكيد من دليل تجاري مستقل (EV-DIR-001).",
        "uncertainty": "لا يتضمن السجل بيانات خاصة بالبائع أو سجل طلبات أو دفعات أو هويات عملاء أو واقعة تنفيذ. وقد تكون لاختلاف فئة النشاط تفسيرات مشروعة، لذا يلزم التحقق.",
    },
    "TKT-MAPS-004": {
        "title": "إدراج على الخرائط لخدمة استرداد",
        "summary": "يشير إدراج عام بأسلوب الخرائط إلى شروط موقع محفوظة في الأرشيف، وتذكر الشروط Dune Fulfilment بوصفها جهة تنفيذ الخدمة. ويربط الدليل التجاري المستقل Dune Fulfilment ببرنامج Cedar Select التابع لشركة Cedar Spire، ما يوفر مساراً من السجلات العامة إلى الشبكة التجارية نفسها.",
        "priorityReason": "الإدراج العام وشروط الموقع المحفوظة في الأرشيف (EV-MAPS-001 وEV-MAPS-002)، مع إحالة إلى الدليل التجاري المستقل (EV-DIR-001).",
        "uncertainty": "لا تتضمن البيانات سجلات من مزود خاص أو شكاوى عملاء أو دفعات، كما أن مالك الإدراج غير مؤكد. ولا يثبت دور التنفيذ المذكور السيطرة على الإدراج أو وقوع احتيال.",
    },
}

SOURCE_COPY_AR = {
    "EV-TAMM-001": ("نتيجة بحث عضوية عن رسوم TAMM", "تُظهر لقطة البحث نتيجة عضوية لعبارة مكتوبة على نحو خاطئ للبحث عن رسوم TAMM، وتحيل إلى نطاق تجريبي مختلف. ولا يظهر فيها إعلان مدفوع أو حساب معلن."),
    "EV-TAMM-002": ("نسخة مؤرشفة من صفحة رسوم ثنائية اللغة", "تستخدم الصفحة الثابتة المحفوظة في الأرشيف عبارة عن رسوم مخالفة مرورية وطلباً لمتابعة الإجراء عبر UAE PASS. ويختلف النطاق عن المرجع الحكومي الخيالي، ولا تتضمن الصفحة نموذجاً أو حقلاً لبيانات الدخول أو وسيلة دفع."),
    "EV-TAMM-003": ("أرشيف المحفظة العامة لشركة Cedar Spire", "يسجل أرشيف المحفظة العامة مشروعاً بالنطاق نفسه tamm-fees.example.test وبعنوان مطابق للمشروع. وهذا يربط الصفحة المؤرشفة بمرجع المحفظة على مستوى الشركة، من دون تحديد مشغّل فردي."),
    "EV-LI-001": ("لقطة لمنشور وظيفة عام على LinkedIn", "يعرض المنشور العام وظيفة براتب AED 20,000 شهرياً لمهام مبهمة، ويحيل إلى صفحة ثابتة. وهذا مؤشر للمراجعة فقط."),
    "EV-LI-002": ("أرشيف صفحة الوظيفة الثابتة", "تكرر الصفحة المحفوظة الراتب والمهام العامة المبهمة. ولا تتضمن طلب تقديم أو دخول أو رسوماً أو تفاعلاً للتواصل."),
    "EV-LI-003": ("إفصاح عام عن هوية المعلن", "يسمي الإفصاح العام عن المعلن شركة Cedar Spire Services FZE معلناً للمنشور الوظيفي، ويشير إلى مرجع الأرشيف الخاص به. ولا يحدد الإفصاح كاتب الإعلان أو قصده."),
    "EV-MKT-001": ("لقطة لإدراج بائع في السوق الإلكتروني", "يعرض الإدراج العام اسم البائع Cedar Select، ويذكر فئة الرخصة المعروضة IT consultancy بينما يندرج المنتج ضمن consumer electronics. ويُعد هذا الاختلاف مؤشراً للمراجعة، لا دليلاً على احتيال."),
    "EV-MKT-002": ("سجل دليل عام لنشاط الرخصة التجارية", "يسجل الدليل العام نشاط الاستشارات لشركة Cedar Spire Services FZE واسمها التجاري Cedar Select. ويساعد ذلك في مقارنة فئة نشاط الرخصة بفئة الإدراج، من دون حسم التفويض أو التنفيذ."),
    "EV-MKT-003": ("شروط السوق العامة للبائع والتنفيذ", "تسمي الشروط العامة Dune Fulfilment LLC جهةً لتنفيذ برنامج البائعين، وتوضح أن دور البائع يختلف عن دور جهة التنفيذ. ولا تثبت الشروط وحدها تنفيذ طلب بعينه."),
    "EV-DIR-001": ("دليل تجاري مستقل يربط Cedar Spire وDune", "يعرض دليل تجاري عام ومستقل برنامج Cedar Select التابع لشركة Cedar Spire وعلاقة التنفيذ المنشورة مع Dune Fulfilment LLC. وهذا هو الرابط التجاري العام المستخدم بين الحالات، ولا يثبت تحكماً مشتركاً أو مخالفة."),
    "EV-MAPS-001": ("إدراج عام بأسلوب الخرائط لخدمة استرداد", "يعرض الإدراج الخيالي خدمة لاسترداد المستندات والمدفوعات ويحيل نصياً إلى موقع خدمة ثابت. ولا يتضمن عنواناً أو رقم هاتف أو إحداثيات حقيقية أو إجراء تواصل."),
    "EV-MAPS-002": ("شروط مؤرشفة لموقع خدمة الاسترداد", "تذكر الشروط المحفوظة في الأرشيف شركة Dune Fulfilment LLC جهةً لتنفيذ الخدمة، وتشير إلى رسم مراجعة مسبق. والمحتوى نص ثابت فقط ولا يثبت هوية من أدار الإدراج أو تنفيذ الخدمة."),
    "EV-INT-001": ("مطابقة في فهرس شرطي داخلي مفترض (محاكاة خيالية)", "يسجل رد خيالي تجريبي من واجهة شرطية داخلية مفترضة ومصرح بها ارتباط عمل للشخصية الاصطناعية Mariam N. Sample (مريم ن. عينة) بشركة Cedar Spire Services FZE. وتظهر فيه حالة إقامة/تأشيرة خيالية سارية حتى 2027-06-30، من دون رقم تعريف قابل للاستخدام. لا يحدد الرد كاتب المنشور الوظيفي ولا يتضمن رقم هوية أو جواز أو هاتف أو حساب حقيقياً، ولا يشير إلى جريمة. هذه بيانات ثابتة لا تستدعي أي واجهة فعلية."),
}

# One source-backed record per observed spelling/source occurrence. No Arabic
# company/person name is synthesized when none appears in a source capture.
ENTITY_NAME_VARIANTS = {
    "ENT-ORG-CSP-01": [
        {"value":"Cedar Spire Services FZE","languageTag":"en","evidenceIds":["EV-LI-003"],"sourceReference":"https://ads.example.test/library/disclosure/csp-role-02"},
        {"value":"Cedar Spire Services FZE","languageTag":"en","evidenceIds":["EV-MKT-002"],"sourceReference":"https://directory.example.test/entities/cedar-spire"},
        {"value":"Cedar Spire","languageTag":"en","evidenceIds":["EV-TAMM-003"],"sourceReference":"https://portfolio.example.test/cedar-spire/projects/service-notices"},
        {"value":"Cedar Spire","languageTag":"en","evidenceIds":["EV-DIR-001"],"sourceReference":"https://directory.example.test/partners/dune-cedar"},
        {"value":"Cedar Select","languageTag":"en","evidenceIds":["EV-MKT-001"],"sourceReference":"https://market.example.test/listings/seller-88/item-12"},
        {"value":"Cedar Select","languageTag":"en","evidenceIds":["EV-MKT-002"],"sourceReference":"https://directory.example.test/entities/cedar-spire"},
        {"value":"Cedar Select","languageTag":"en","evidenceIds":["EV-DIR-001"],"sourceReference":"https://directory.example.test/partners/dune-cedar"},
    ],
    "ENT-ORG-DUNE-01": [
        {"value":"Dune Fulfilment LLC","languageTag":"en","evidenceIds":["EV-MKT-003"],"sourceReference":"https://market.example.test/policies/seller-fulfilment"},
        {"value":"Dune Fulfilment LLC","languageTag":"en","evidenceIds":["EV-DIR-001"],"sourceReference":"https://directory.example.test/partners/dune-cedar"},
        {"value":"Dune Fulfilment LLC","languageTag":"en","evidenceIds":["EV-MAPS-002"],"sourceReference":"https://archive.example.test/captures/recovery-terms-01"},
    ],
    "ENT-PERSON-MARIAM-01": [
        {"value":"Mariam N. Sample","languageTag":"en","evidenceIds":["EV-INT-001"],"sourceReference":"https://police-internal.example.test/mock/person/001"},
        {"value":"مريم ن. عينة","languageTag":"ar","evidenceIds":["EV-INT-001"],"sourceReference":"https://police-internal.example.test/mock/person/001"},
    ],
}
ENTITY_LABEL_AR = {
    "ENT-ORG-CSP-01":"Cedar Spire Services FZE",
    "ENT-ORG-DUNE-01":"Dune Fulfilment LLC",
    "ENT-URL-TAMM-01":"مرجع أرشيفي لموقع ينتحل خدمة TAMM",
    "ENT-URL-LI-01":"أرشيف صفحة وظيفة براتب مرتفع ومهام مبهمة",
    "ENT-MARKET-LISTING-01":"إدراج Cedar Select في السوق الإلكتروني",
    "ENT-URL-RECOVERY-01":"مرجع أرشيفي لخدمة استرداد مدرجة على الخرائط",
    "ENT-PERSON-MARIAM-01":"Mariam N. Sample",
}
ENTITY_DOSSIER_COPY = {
    "ENT-PERSON-MARIAM-01": {
        "en": {
            "summary": "A static assumed-authorized internal API mock lists a work affiliation with Cedar Spire Services FZE. It contains no real identity or account identifiers and does not link this person to the job post.",
            "fields": [
                {"label":"Name as recorded","value":"Mariam N. Sample · مريم ن. عينة","evidenceIds":["EV-INT-001"]},
                {"label":"Work affiliation","value":"Cedar Spire Services FZE (listed; role and dates unknown)","evidenceIds":["EV-INT-001"]},
                {"label":"Connection to job post","value":"Unknown; the record does not identify the author or recruiter.","evidenceIds":["EV-INT-001"]},
                {"label":"Mock residence/visa status","value":"Active through 2027-06-30 (fictional mock; not a real lookup).","evidenceIds":["EV-INT-001"]},
                {"label":"EID, passport, phone, bank accounts","value":"Unknown; no usable identifiers or account data are present in this mock.","evidenceIds":["EV-INT-001"]},
            ],
        },
        "ar": {
            "summary": "يسجل مصدر تجريبي ثابت من واجهة داخلية شرطية مفترضة ارتباط عمل بشركة Cedar Spire Services FZE. ولا يتضمن بيانات هوية أو حساب حقيقية، ولا يربط الشخصية بإعلان الوظيفة.",
            "fields": [
                {"label":"الاسم كما ورد في المصدر","value":"Mariam N. Sample · مريم ن. عينة","evidenceIds":["EV-INT-001"]},
                {"label":"الارتباط الوظيفي","value":"Cedar Spire Services FZE (ارتباط مدرج؛ المسمى والتواريخ غير معروفة)","evidenceIds":["EV-INT-001"]},
                {"label":"الصلة بإعلان الوظيفة","value":"غير معروفة؛ لا يحدد السجل الكاتب أو مسؤول التوظيف.","evidenceIds":["EV-INT-001"]},
                {"label":"حالة الإقامة/التأشيرة في المحاكاة","value":"سارية حتى 2027-06-30 (محاكاة خيالية وليست استعلاماً حقيقياً).","evidenceIds":["EV-INT-001"]},
                {"label":"الهوية الإماراتية والجواز والهاتف والحسابات المصرفية","value":"غير معروفة؛ لا يتضمن هذا السجل التجريبي أرقاماً قابلة للاستخدام أو بيانات حساب.","evidenceIds":["EV-INT-001"]},
            ],
        },
    },
}
RELATION_COPY_AR = {
    "REL-TAMM-SEARCH-ARCHIVE":"تؤدي نتيجة البحث العضوية إلى صفحة محفوظة في الأرشيف، ويظهر النطاق ومرجع المشروع نفسيهما في المحفظة العامة لـ Cedar Spire؛ وهذا يدعم ارتباطاً موثقاً على مستوى الشركة فقط.",
    "REL-LI-ADVERTISER-CSP":"يسمي الإفصاح العام عن المعلن Cedar Spire معلناً للمنشور؛ ولا يحدد هوية من كتبه أو قصده.",
    "REL-MKT-TERMS-DUNE":"تذكر شروط السوق العامة Dune Fulfilment جهةً لتنفيذ البرنامج؛ ولا يثبت اختلاف فئة البائع والرخصة وحده إتمام طلب.",
    "REL-DUNE-CSP-DIRECTORY":"يربط دليل تجاري مستقل برنامج Cedar Select التابع لـ Cedar Spire بدور التنفيذ المنشور لـ Dune Fulfilment.",
    "REL-MAPS-TERMS-DUNE":"يحيل الإدراج العام بأسلوب الخرائط إلى شروط الموقع المؤرشفة التي تسمي Dune Fulfilment جهةً لتنفيذ الخدمة.",
    "REL-LI-PERSON-AFFILIATION":"يسجل مصدر داخلي تجريبي مفترض ارتباط عمل للشخصية الخيالية بالشركة فقط؛ ولا يربطها بالمنشور أو يثبت هوية الكاتب أو وقوع مخالفة.",
}
RELATION_STRENGTH = {
    "REL-TAMM-SEARCH-ARCHIVE":"strong",
    "REL-LI-ADVERTISER-CSP":"medium",
    "REL-LI-PERSON-AFFILIATION":"weak",
    "REL-MKT-TERMS-DUNE":"medium",
    "REL-DUNE-CSP-DIRECTORY":"medium",
    "REL-MAPS-TERMS-DUNE":"medium",
}

AR_REPORT_LABELS = {
    "en":{"ticket":"Ticket","risk":"Case priority","riskCaption":"a triage score based on the cited evidence, not a probability or finding of guilt.","closing":"Proposed closing date","assessment":"Assessment","reasons":"Why it is prioritized","unknown":"What remains unknown","evidence":"Evidence citations"},
    "ar":{"ticket":"التذكرة","risk":"درجة الأولوية","riskCaption":"درجة فرز استرشادية تستند إلى الأدلة المذكورة، وليست احتمالاً أو حكماً بالذنب.","closing":"تاريخ الإغلاق المقترح","assessment":"التقييم","reasons":"أسباب الأولوية","unknown":"ما لا يزال مجهولاً","evidence":"مراجع الأدلة"},
}

def priority(t):
 """Explained triage priority: the fixture score is a story example, not a calibrated probability."""
 level="high" if t["riskScore"]>=80 else "medium" if t["riskScore"]>=60 else "low"
 return {"level":level,"score":t["riskScore"],"scoreScale":100,"reason":t["reasons"],"uncertainty":t["uncertainty"],"evidenceIds":t["evidenceIds"]}

def render_source(row):
 vals={"evidence_id":row["id"],"title":row["title"],"record_type":row["recordType"],"captured_at":row["capturedAt"],"source_reference":row["sourceReference"],"capture_method":row["collectionMethod"],"language":row["language"],"support":row["support"],"description":row["description"],"original_text":row["originalText"],"limitations":row["limitations"]}
 return Template((TEMPLATES/"source-card.md.tmpl").read_text(encoding="utf-8")).substitute(vals)

def render_ticket_report(t, locale, titles):
 labels=AR_REPORT_LABELS[locale]
 values={"title":t["title"] if locale=="en" else TICKET_COPY_AR[t["id"]]["title"],"ticket_label":labels["ticket"],"ticket_id":t["id"],"risk_label":labels["risk"],"risk_score":t["riskScore"],"risk_caption":labels["riskCaption"],"closing_label":labels["closing"],"closing_date":t["closingDate"],"assessment_heading":labels["assessment"],"summary":t["summary"] if locale=="en" else TICKET_COPY_AR[t["id"]]["summary"],"reasons_heading":labels["reasons"],"risk_reasons":t["reasons"] if locale=="en" else TICKET_COPY_AR[t["id"]]["priorityReason"],"unknown_heading":labels["unknown"],"uncertainty":t["uncertainty"] if locale=="en" else TICKET_COPY_AR[t["id"]]["uncertainty"],"evidence_heading":labels["evidence"],"citations":"\n".join(f"- [{eid}]({SOURCES_BY_ID[eid]['assetRef']}) — {titles[eid]}" for eid in t["evidenceIds"])}
 return Template((TEMPLATES/"ticket-report.md.tmpl").read_text(encoding="utf-8")).substitute(values)

def build():
 global SOURCES_BY_ID
 sources={r["id"]:dict(r) for r in SOURCES}
 SOURCES_BY_ID=sources
 for r in sources.values(): r["sha256"]=hashlib.sha256(render_source(r).encode()).hexdigest()
 entities=[]
 for i,k,label,ids in ENTITIES:
  entity={"id":i,"kind":k,"label":label,"attributes":{"fictional":True},"observedAt":DATE+"T08:00:00Z","support":"observed","uncertainty":None,"provenance":[{"evidenceId":x} for x in ids],"revision":REVISION}
  entity["labelVariants"]={"en":label,"ar":ENTITY_LABEL_AR[i]}
  entity["nameVariants"]=ENTITY_NAME_VARIANTS.get(i,[])
  if i in ENTITY_DOSSIER_COPY:
   entity["dossierVariants"]=ENTITY_DOSSIER_COPY[i]
  else:
   entity["dossierVariants"]={
    "en":{"summary":"Compiled from the cited fixture evidence. Interpret links cautiously and retain the cited source limitations.","fields":[{"label":"Identity and context","value":label,"evidenceIds":ids}]},
    "ar":{"summary":"أُعد هذا الملخص من الأدلة المذكورة. تُفسر الروابط بحذر مع مراعاة قيود المصادر.","fields":[{"label":"الهوية والسياق","value":ENTITY_LABEL_AR[i],"evidenceIds":ids}]},
   }
  entities.append(entity)
 rels=[]
 for i,a,b,k,evs,rationale in RELATIONS:
  rels.append({"id":i,"fromEntityId":a,"toEntityId":b,"kind":k,"support":"possible" if i=="REL-LI-PERSON-AFFILIATION" else "observed","strength":RELATION_STRENGTH[i],"rationale":rationale,"rationaleVariants":{"en":rationale,"ar":RELATION_COPY_AR[i]},"observedAt":DATE+"T08:20:00Z","evidenceIds":evs.split(),"revision":REVISION})
 tickets=[]
 for t in TICKETS:
  localized_sources={locale:{eid:(sources[eid]["title"] if locale=="en" else SOURCE_COPY_AR[eid][0]) for eid in t["evidenceIds"]} for locale in ("en","ar")}
  reports={locale:render_ticket_report(t,locale,localized_sources[locale]) for locale in ("en","ar")}
  blocks=[{"id":f"BLK-{t['id']}-REPORT","type":"markdown","text":reports["en"]}]
  block_text={"en":{},"ar":{}}
  report_block_id=f"BLK-{t['id']}-REPORT"
  block_text["en"][report_block_id]=reports["en"]
  block_text["ar"][report_block_id]=reports["ar"]
  for eid in t["evidenceIds"]:
   e=sources[eid]; bid=f"BLK-{eid}"
   blocks.append({"id":bid,"type":"evidence","evidenceId":eid,"title":e["title"],"summary":e["description"],"sourceReference":e["sourceReference"],"capturedAt":e["capturedAt"],"collectionMethod":e["collectionMethod"],"language":e["language"],"support":e["support"],"asset":{"url":e["assetRef"],"mimeType":"text/markdown","sha256":e["sha256"]}})
   block_text["en"][bid]={"title":e["title"],"summary":e["description"]}
   block_text["ar"][bid]={"title":SOURCE_COPY_AR[eid][0],"summary":SOURCE_COPY_AR[eid][1]}
  copy=TICKET_COPY_AR[t["id"]]
  variants={"en":{"title":t["title"],"summary":t["summary"],"priorityReason":t["reasons"],"uncertainty":t["uncertainty"],"reportMarkdown":reports["en"],"blockTextById":block_text["en"]},"ar":{"title":copy["title"],"summary":copy["summary"],"priorityReason":copy["priorityReason"],"uncertainty":copy["uncertainty"],"reportMarkdown":reports["ar"],"blockTextById":block_text["ar"]}}
  tickets.append({"id":t["id"],"revision":REVISION,"title":t["title"],"createdAt":min(sources[e]["capturedAt"] for e in t["evidenceIds"]),"updatedAt":max(sources[e]["capturedAt"] for e in t["evidenceIds"]),"closingDate":t["closingDate"],"status":"open","reportMarkdown":reports["en"],"contentVariants":variants,"blocks":blocks,"entityIds":t["entityIds"],"relationshipIds":t["relationshipIds"],"evidenceIds":t["evidenceIds"],"summary":t["summary"],"priority":priority(t)})
 data={"workspaceId":"workspace-demo-public-osint-01","revision":REVISION,"generatedForDate":DATE,"entities":entities,"relationships":rels,"tickets":tickets}
 out={"workspace.json":json.dumps(data,ensure_ascii=False,indent=2,sort_keys=True)+"\n"}
 events=[{"at":r["capturedAt"],"type":"evidence_available","evidenceId":r["id"],"title":r["title"],"ticketIds":[t["id"] for t in TICKETS if r["id"] in t["evidenceIds"]]} for r in sorted(SOURCES,key=lambda x:(x["capturedAt"],x["id"]))]
 out["backend-reveal-timeline.json"]=json.dumps({"purpose":"public OSINT demo fixture schedule only","events":events},ensure_ascii=False,indent=2,sort_keys=True)+"\n"
 out["README.md"]="# Generated fictional public OSINT fixtures\n\nDeterministic static captures for four fictional cases, including one explicitly assumed-authorized police internal API mock record. All records use reserved `.test` hosts. No real internal API call, live scan, customer/transaction record, or real person data is included. The four evidence paths converge through public portfolio/ad disclosure, marketplace terms, and independent business directory captures. Ticket reports include final-stage authored Arabic and English variants with shared IDs and cited evidence; source captures remain unchanged.\n\nRun `python3 generate_fixtures.py` to generate. Run `python3 generate_fixtures.py --check` to compare expected output without writing. Uses only the Python standard library.\n"
 for eid,r in sources.items(): out[f"sources/{eid}.md"]=render_source(r)
 for t in tickets:
  out[f"reports/{t['id']}.en.md"]=t["contentVariants"]["en"]["reportMarkdown"]
  out[f"reports/{t['id']}.ar.md"]=t["contentVariants"]["ar"]["reportMarkdown"]
 out["profiles/organizations.md"]="# Fictional public business records\n\nCedar Spire Services FZE, Cedar Select, and Dune Fulfilment LLC are fictional. Public directory and disclosure captures connect public business roles only. They do not establish common control, personal involvement, or wrongdoing.\n"
 out["profiles/collection-scope.md"]="# Collection scope\n\nThis demo fixture includes retrospective fictional public captures and one assumed-authorized police internal API mock record. Its person and records are entirely synthetic, contain no real identifiers or account data, trigger no external request, and are linked cautiously as possible work affiliation only. The mock does not establish authorship or wrongdoing.\n"
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
  p=t.get("priority") or {}
  if not p.get("reason") or any(x not in sids for x in p.get("evidenceIds",[])): errors.append(f"unexplained or unresolved priority in {t['id']}")
  variants=t.get("contentVariants") or {}
  if set(variants)!={"en","ar"}: errors.append(f"missing canonical bilingual variants in {t['id']}")
  expected_blocks={b["id"] for b in t.get("blocks",[])}
  for locale in ("en","ar"):
   v=variants.get(locale) or {}
   if any(not isinstance(v.get(k),str) or not v[k].strip() for k in ("title","summary","priorityReason","uncertainty","reportMarkdown")): errors.append(f"incomplete {locale} content in {t['id']}")
   if set((v.get("blockTextById") or {}))!=expected_blocks: errors.append(f"block IDs differ in {locale} variant for {t['id']}")
   cited=set(re.findall(r"\[(EV-[A-Z0-9-]+)\]",v.get("reportMarkdown", "")))
   if cited!=set(t["evidenceIds"]): errors.append(f"citation set differs in {locale} report for {t['id']}")
  if variants.get("en",{}).get("title")!=t.get("title") or variants.get("en",{}).get("summary")!=t.get("summary"): errors.append(f"English compatibility aliases differ in {t['id']}")
  if variants.get("en",{}).get("reportMarkdown")!=t.get("reportMarkdown"): errors.append(f"English report compatibility alias differs in {t['id']}")
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
 # Validate one connected evidence graph and source-backed exact name variants.
 for entity in data["entities"]:
  name_variants=entity.get("nameVariants",[])
  for variant in name_variants:
   evidence_ids=variant.get("evidenceIds",[])
   if not variant.get("value") or not variant.get("languageTag") or len(evidence_ids)!=1 or any(eid not in sources for eid in evidence_ids):
    errors.append(f"invalid name provenance in {entity['id']}"); continue
   for eid in evidence_ids:
    src=sources[eid]
    observed="\n".join((src["title"],src["description"],src["originalText"]))
    if variant["value"] not in observed: errors.append(f"name variant is not verbatim in {eid}: {variant['value']}")
    if variant.get("sourceReference")!=src["sourceReference"]: errors.append(f"name source reference mismatch in {eid}")
  labels=entity.get("labelVariants") or {}
  if set(labels)!={"en","ar"}: errors.append(f"missing entity label variant in {entity['id']}")
 for rel in data["relationships"]:
  if set((rel.get("rationaleVariants") or {}))!={"en","ar"}: errors.append(f"missing relationship rationale variant in {rel['id']}")
 for t in data["tickets"]:
  en=t["contentVariants"]["en"]; ar=t["contentVariants"]["ar"]
  if set(en["blockTextById"])!=set(ar["blockTextById"]): errors.append(f"variant block set mismatch in {t['id']}")
  if any(re.findall(r"\b\d+(?:[.,]\d+)?\b",en[k])!=re.findall(r"\b\d+(?:[.,]\d+)?\b",ar[k]) for k in ("summary","priorityReason","uncertainty","reportMarkdown")):
   errors.append(f"numeric value mismatch in bilingual narrative for {t['id']}")
  if re.findall(r"\b\d{4}-\d{2}-\d{2}\b",en["reportMarkdown"])!=re.findall(r"\b\d{4}-\d{2}-\d{2}\b",ar["reportMarkdown"]): errors.append(f"date mismatch in bilingual report for {t['id']}")
 alltext="\n".join(out.values())
 for bad in ("authorized_case_import","casefile.example.test","EV-CORP-","EV-HOST-","EV-BANK-","EV-MAP-003","TXN-"):
  if bad in alltext: errors.append(f"stale private scenario marker: {bad}")
 if re.search(r"https?://(?![^/]*\.test(?:/|$))[^\s)]+",alltext): errors.append("non-.test URL found")
 if any(s.get("sourceClass") not in {"public_capture","authorized_internal_mock"} for s in sources.values()): errors.append("unapproved fixture source class")
 if any(r.get("sourceClass")=="authorized_internal_mock" and ("no api is called" not in r.get("description", "").lower() or "fictional" not in r.get("description", "").lower()) for r in sources.values()): errors.append("internal mock source must state it is fictional and no API is called")
 if any(r.get("strength") not in {"strong","medium","weak"} for r in data["relationships"]): errors.append("relationship strength missing or invalid")
 if any("ENT-PERSON-MARIAM-01" in t["entityIds"] and "EV-INT-001" not in t["evidenceIds"] for t in data["tickets"]): errors.append("person dossier lacks internal mock evidence")
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
