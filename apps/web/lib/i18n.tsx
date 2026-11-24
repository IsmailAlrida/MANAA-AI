"use client"

/**
 * Minimal EN/AR dictionary + direction. Sets <html lang dir> at the app
 * boundary. Swap for next-intl when message volume grows.
 */
import * as React from "react"

export type Locale = "en" | "ar"

const en = {
  product: "MANA'A",
  workspace: "Workspace",
  nav: { network: "Network", tickets: "Tickets" },
  run: {
    scan: "Run scan",
    newScan: "Run new scan",
    retry: "Retry scan",
    starting: "Starting…",
    scanning: "Scanning",
    loading: "Loading…",
  },
  monitor: {
    pause: "Pause",
    pausing: "Pausing…",
    paused: "Paused",
    resume: "Resume",
    resuming: "Resuming…",
    complete: "Scenario replay complete",
  },
  conn: {
    idle: "Idle",
    connecting: "Connecting",
    syncing: "Syncing",
    live: "Live",
    reconnecting: "Reconnecting",
    error: "Connection error",
  },
  load: {
    error: "Couldn't load the workspace",
    retry: "Retry",
    offline: "Offline",
  },
  empty: {
    workspaceTitle: "No investigation yet",
    workspaceBody:
      "Run a scan to begin. Tickets and graph records appear here as evidence becomes available.",
    queueFiltered: "No tickets match these filters.",
    offline: "Tickets appear here once the investigation service is reachable.",
  },
  network: {
    graph: "Graph",
    list: "Entities",
    relationships: "Relationships",
    graphCanvas: "Graph canvas",
    inspector: "Inspector",
    noSelection:
      "Select an entity to inspect its claims, evidence and relationships.",
    kind: "Type",
    support: "Support",
    uncertainty: "Uncertainty",
    observed: "Observed",
    evidence: "Evidence",
    from: "From",
    to: "To",
    rationale: "Basis",
    strength: "Link strength",
    strong: "Strong",
    medium: "Medium",
    weak: "Weak",
    openEvidence: "Open Evidence tab",
    backToGraph: "Back to graph",
    evidenceTab: "Evidence",
    namesAsRecorded: "Names as recorded",
    dossierFields: "Dossier details",
    noDossier: "No additional dossier narrative is available; review the cited records.",
    strengthLegend: "Relationship strength from the investigation fabric; weak links do not establish identity.",
    legend: "Legend",
    cluster: "Cluster",
    dotKey: "Dot = entity",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    fit: "Fit to view",
    hideLegend: "Hide legend",
    showLegend: "Show legend",
    lineObserved: "Observed link",
    lineInferred: "Not observed",
    entityTypes: "Entity types",
    kinds: {
      org: "Orgs",
      identity: "People",
      web: "Web",
      content: "Ads",
      infra: "Servers",
      money: "Money",
    },
  },
  tickets: {
    search: "Search tickets",
    all: "All",
    open: "Open",
    overdue: "Overdue",
    closed: "Closed",
    title: "Title",
    status: "Status",
    priority: "Priority",
    closingDate: "Closing date",
    updated: "Updated",
    back: "Back to queue",
    notFound: "Ticket not found",
    unavailable: "Ticket unavailable while offline",
    report: "Report",
    evidence: "Evidence",
    entities: "Related entities",
    history: "History",
    noHistory: "No recorded history yet.",
    unknownBlock: "Unsupported block",
    openSource: "Open source",
    captured: "Captured",
    language: "Language",
    method: "Method",
    unresolved: "Unresolved reference",
    finalWriteup: "Final write-up",
  },
  closingDate: {
    edit: "Edit date",
    none: "Not set",
    saving: "Saving…",
    conflict:
      "This ticket changed since you opened it. Reload to see the latest version.",
    reload: "Reload",
    retry: "Retry",
    cancel: "Cancel",
    clear: "Clear date",
  },
  close: {
    action: "Close ticket",
    title: "Close ticket",
    description:
      "Record a short final write-up: what happened outside the app, or why the lead was dismissed.",
    label: "Final write-up",
    placeholder: "e.g. Takedown completed with reference …",
    required: "A final write-up is required.",
    submit: "Close ticket",
    submitting: "Closing…",
    cancel: "Cancel",
  },
  agent: {
    title: "Assistant",
    toggle: "Toggle assistant",
    unavailable: "Assistant not configured",
    unavailableBody:
      "Connect a provider to ask questions about the selected ticket's evidence.",
  },
  locale: { label: "Language", en: "English", ar: "العربية" },
  hint: {
    sidebar: "Toggle sidebar",
    closePanel: "Close",
    runReady: "Start a new investigation run",
    offline: "Investigation service unreachable. Start the demo backend (npm run dev -- --demo) or set MANAA_API_ORIGIN, then retry.",
    retry: "Retry connection",
    runBusy: "A run is in progress — updates stream in as evidence arrives",
    runComplete: "Last run finished. Start another run",
    runUnchanged: "No new scan started — the service reports this workspace's scan as already complete.",
    filterAll: "All tickets",
    filterOpen: "Open and within the closing date",
    filterOverdue: "Still open past the proposed closing date",
    filterClosed: "Closed with a final write-up",
    overdue: "Past its proposed closing date; stays open until you close it",
    noPriority: "No priority reason provided yet",
    closingDate: "Proposed closing date — click to change",
    closingDateLocked: "Closed tickets keep their final closing date",
    closeTicket: "Archive this ticket with a short final write-up",
    openSource: "Open the captured source in a new tab",
    support: {
      observed: "Directly seen in the cited evidence",
      possible: "Inferred; not directly confirmed",
      disputed: "Evidence conflicts on this point",
    } as Record<string, string>,
    unresolved: "Referenced by the backend but not yet received",
  },
}

type Dict = typeof en

const ar: Dict = {
  product: "مناعة",
  workspace: "مساحة العمل",
  nav: { network: "الشبكة", tickets: "التذاكر" },
  run: {
    scan: "بدء الفحص",
    newScan: "فحص جديد",
    retry: "إعادة الفحص",
    starting: "جارٍ البدء…",
    scanning: "جارٍ الفحص",
    loading: "جارٍ التحميل…",
  },
  monitor: {
    pause: "إيقاف مؤقت",
    pausing: "جارٍ الإيقاف…",
    paused: "متوقف مؤقتًا",
    resume: "استئناف",
    resuming: "جارٍ الاستئناف…",
    complete: "اكتمل عرض السيناريو",
  },
  conn: {
    idle: "خامل",
    connecting: "جارٍ الاتصال",
    syncing: "جارٍ المزامنة",
    live: "متصل",
    reconnecting: "إعادة الاتصال",
    error: "خطأ في الاتصال",
  },
  load: { error: "تعذّر تحميل مساحة العمل", retry: "إعادة المحاولة", offline: "غير متصل" },
  empty: {
    workspaceTitle: "لا يوجد تحقيق بعد",
    workspaceBody:
      "ابدأ الفحص. ستظهر التذاكر وسجلات الشبكة هنا عند توفر الأدلة.",
    queueFiltered: "لا توجد تذاكر مطابقة لهذه المرشحات.",
    offline: "ستظهر التذاكر هنا عند توفر خدمة التحقيق.",
  },
  network: {
    graph: "المخطط",
    list: "الكيانات",
    relationships: "العلاقات",
    graphCanvas: "لوحة المخطط",
    inspector: "المعاين",
    noSelection: "اختر كيانًا لعرض الادعاءات والأدلة والعلاقات.",
    kind: "النوع",
    support: "الدعم",
    uncertainty: "عدم اليقين",
    observed: "تاريخ الرصد",
    evidence: "الأدلة",
    from: "من",
    to: "إلى",
    rationale: "الأساس",
    strength: "قوة الارتباط",
    strong: "قوي",
    medium: "متوسط",
    weak: "ضعيف",
    openEvidence: "فتح تبويب الأدلة",
    backToGraph: "العودة إلى الرسم البياني",
    evidenceTab: "الأدلة",
    namesAsRecorded: "الأسماء كما وردت في المصادر",
    dossierFields: "تفاصيل الملف",
    noDossier: "لا يتوفر ملخص إضافي؛ راجع السجلات المشار إليها.",
    strengthLegend: "قوة الارتباط كما قيّمها نظام التحقيق؛ الارتباط الضعيف لا يثبت الهوية.",
    legend: "مفتاح الرموز",
    cluster: "مجموعة",
    dotKey: "النقطة = كيان",
    zoomIn: "تكبير",
    zoomOut: "تصغير",
    fit: "ملاءمة العرض",
    hideLegend: "إخفاء المفتاح",
    showLegend: "إظهار المفتاح",
    lineObserved: "ارتباط مرصود",
    lineInferred: "غير مرصود",
    entityTypes: "أنواع الكيانات",
    kinds: {
      org: "المؤسسات",
      identity: "الأشخاص",
      web: "الويب",
      content: "الإعلانات",
      infra: "الخوادم",
      money: "الأموال",
    },
  },
  tickets: {
    search: "ابحث في التذاكر",
    all: "الكل",
    open: "مفتوحة",
    overdue: "متأخرة",
    closed: "مغلقة",
    title: "العنوان",
    status: "الحالة",
    priority: "الأولوية",
    closingDate: "تاريخ الإغلاق",
    updated: "آخر تحديث",
    back: "العودة إلى القائمة",
    notFound: "التذكرة غير موجودة",
    unavailable: "التذكرة غير متاحة دون اتصال",
    report: "التقرير",
    evidence: "الأدلة",
    entities: "الكيانات المرتبطة",
    history: "السجل",
    noHistory: "لا يوجد سجل بعد.",
    unknownBlock: "كتلة غير مدعومة",
    openSource: "فتح المصدر",
    captured: "تاريخ الالتقاط",
    language: "اللغة",
    method: "الطريقة",
    unresolved: "مرجع غير محلول",
    finalWriteup: "الملاحظة الختامية",
  },
  closingDate: {
    edit: "تعديل التاريخ",
    none: "غير محدد",
    saving: "جارٍ الحفظ…",
    conflict: "تغيّرت هذه التذكرة منذ فتحها. أعد التحميل لرؤية أحدث نسخة.",
    reload: "إعادة التحميل",
    retry: "إعادة المحاولة",
    cancel: "إلغاء",
    clear: "مسح التاريخ",
  },
  close: {
    action: "إغلاق التذكرة",
    title: "إغلاق التذكرة",
    description:
      "اكتب ملاحظة ختامية قصيرة: ما حدث خارج التطبيق أو سبب استبعاد البلاغ.",
    label: "الملاحظة الختامية",
    placeholder: "مثال: تم الإيقاف بالمرجع …",
    required: "الملاحظة الختامية مطلوبة.",
    submit: "إغلاق التذكرة",
    submitting: "جارٍ الإغلاق…",
    cancel: "إلغاء",
  },
  agent: {
    title: "المساعد",
    toggle: "إظهار/إخفاء المساعد",
    unavailable: "المساعد غير مهيأ",
    unavailableBody: "اربط مزودًا لطرح أسئلة حول أدلة التذكرة المحددة.",
  },
  locale: { label: "اللغة", en: "English", ar: "العربية" },
  hint: {
    sidebar: "إظهار/إخفاء الشريط الجانبي",
    closePanel: "إغلاق",
    runReady: "بدء جولة تحقيق جديدة",
    offline: "تعذّر الوصول إلى خدمة التحقيق. شغّل الخادم التجريبي أو اضبط MANAA_API_ORIGIN ثم أعد المحاولة.",
    retry: "إعادة الاتصال",
    runBusy: "الفحص جارٍ — تصل التحديثات تباعًا مع توفر الأدلة",
    runComplete: "انتهت الجولة الأخيرة. ابدأ جولة أخرى",
    runUnchanged: "لم يبدأ فحص جديد — تفيد الخدمة بأن فحص مساحة العمل هذه مكتمل بالفعل.",
    filterAll: "كل التذاكر",
    filterOpen: "مفتوحة وضمن تاريخ الإغلاق",
    filterOverdue: "ما زالت مفتوحة بعد تاريخ الإغلاق المقترح",
    filterClosed: "مغلقة بملاحظة ختامية",
    overdue: "تجاوزت تاريخ الإغلاق المقترح؛ تبقى مفتوحة حتى تغلقها",
    noPriority: "لم يُقدَّم سبب للأولوية بعد",
    closingDate: "تاريخ الإغلاق المقترح — انقر للتغيير",
    closingDateLocked: "تحتفظ التذاكر المغلقة بتاريخ إغلاقها النهائي",
    closeTicket: "أرشفة هذه التذكرة بملاحظة ختامية قصيرة",
    openSource: "فتح المصدر الملتقط في علامة تبويب جديدة",
    support: {
      observed: "مرصود مباشرة في الدليل المذكور",
      possible: "استنتاج غير مؤكد مباشرة",
      disputed: "الأدلة متعارضة في هذه النقطة",
    } as Record<string, string>,
    unresolved: "أشار إليه الخادم ولم يصل بعد",
  },
}

const dicts: Record<Locale, Dict> = { en, ar }

interface LocaleCtx {
  locale: Locale
  dir: "ltr" | "rtl"
  t: Dict
  setLocale: (l: Locale) => void
  fmtDate: (iso: string | null | undefined, withTime?: boolean) => string
}

const Ctx = React.createContext<LocaleCtx | null>(null)
const STORAGE_KEY = "manaa.locale"

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>("en")

  React.useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === "ar" || saved === "en") setLocaleState(saved)
  }, [])

  const dir = locale === "ar" ? "rtl" : "ltr"

  React.useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = dir
  }, [locale, dir])

  const value = React.useMemo<LocaleCtx>(() => {
    const tag = locale === "ar" ? "ar-AE" : "en-AE"
    return {
      locale,
      dir,
      t: dicts[locale],
      setLocale: (l) => {
        localStorage.setItem(STORAGE_KEY, l)
        setLocaleState(l)
      },
      fmtDate: (iso, withTime = false) => {
        if (!iso) return "—"
        const d = new Date(iso)
        if (Number.isNaN(d.getTime())) return iso
        return new Intl.DateTimeFormat(tag, {
          dateStyle: "medium",
          ...(withTime ? { timeStyle: "short" } : {}),
        }).format(d)
      },
    }
  }, [locale, dir])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLocale() {
  const c = React.useContext(Ctx)
  if (!c) throw new Error("useLocale must be used inside LocaleProvider")
  return c
}
