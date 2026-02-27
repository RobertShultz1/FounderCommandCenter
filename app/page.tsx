
"use client";
import React, { useMemo, useState, useEffect, useRef } from "react";

type DayRow = {
  date: string;
  paidOrders: number;
  paidCases: number;
  organicOrders: number;
  organicCases: number;
  pricePerCase: number;
  shipChargedPerCase: number;
  refunds: number;
  metaAdSpend: number;
  restocks: number;
};

type WeeklyRow = {
  label: string;
  paidOrders: number;
  paidCases: number;
  organicOrders: number;
  organicCases: number;
  pricePerCase: number;
  shipChargedPerCase: number;
  refunds: number;
  metaAdSpend: number;
};

type Assumptions = {
  cogsPerCase: number;
  shipCostPerCase: number;
  otherVarPerCase: number;
  processingPercent: number;
  processingFixedPerOrder: number;
  wholesaleMinMargin: number;
  wholesaleDefaultPricePerCase: number;
  wholesaleProcessingPercent: number;
};

type WholesaleDeal = {
  id: string;
  createdAt: string;
  retailer: string;
  cases: number;
  pricePerCase: number;
  youPayShipping: boolean;
  shipCostTotal: number;
  paymentTermsDays: number;
  strategicValue: boolean;
  contribution: number;
  margin: number;
};

type PendingDeal = WholesaleDeal;

type Snapshot = {
  id: string;
  savedAt: string;
  label: string;
  revenue7d: number;
  preAdContrib7d: number;
  postAdContrib7d: number;
  cases7d: number;
  preAdMargin7d: number;
  paidCac: number;
  inventoryNow: number;
  daysLeft: number;
};

type DtcSum = {
  orders: number;
  paidOrders: number;
  organicOrders: number;
  cases: number;
  paidCases: number;
  organicCases: number;
  restocks: number;
  metaAdSpend: number;
  refunds: number;
  productRevenue: number;
  shipRevenue: number;
  grossRevenue: number;
  netRevenue: number;
  cogs: number;
  shipCost: number;
  otherVar: number;
  processing: number;
  preAdContribution: number;
  postAdContribution: number;
};

const INITIAL_INVENTORY = 1200;

const INITIAL_ASSUMPTIONS: Assumptions = {
  cogsPerCase: 12.0,
  shipCostPerCase: 10.82,
  otherVarPerCase: 0.9,
  processingPercent: 2.9,
  processingFixedPerOrder: 0.3,
  wholesaleMinMargin: 25,
  wholesaleDefaultPricePerCase: 24,
  wholesaleProcessingPercent: 0,
};

const ZERO_ASSUMPTIONS: Assumptions = {
  cogsPerCase: 0,
  shipCostPerCase: 0,
  otherVarPerCase: 0,
  processingPercent: 0,
  processingFixedPerOrder: 0,
  wholesaleMinMargin: 0,
  wholesaleDefaultPricePerCase: 0,
  wholesaleProcessingPercent: 0,
};

const INITIAL_WS = {
  retailer: "Texas account",
  cases: 10,
  pricePerCase: 24,
  youPayShipping: false,
  shipCostTotal: 0,
  paymentTermsDays: 30,
  strategicValue: false,
};

const ZERO_WS = {
  retailer: "",
  cases: 0,
  pricePerCase: 0,
  youPayShipping: false,
  shipCostTotal: 0,
  paymentTermsDays: 0,
  strategicValue: false,
};

function makeBlankRows(): DayRow[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return {
      date: `${yyyy}-${mm}-${dd}`,
      paidOrders: 0,
      paidCases: 0,
      organicOrders: 0,
      organicCases: 0,
      pricePerCase: 32.4,
      shipChargedPerCase: 10,
      refunds: 0,
      metaAdSpend: 0,
      restocks: 0,
    };
  });
}

function makeZeroRows(): DayRow[] {
  return makeBlankRows().map((r) => ({
    ...r,
    paidOrders: 0,
    paidCases: 0,
    organicOrders: 0,
    organicCases: 0,
    pricePerCase: 0,
    shipChargedPerCase: 0,
    refunds: 0,
    metaAdSpend: 0,
    restocks: 0,
  }));
}

function makeBlank30dWeeks(): WeeklyRow[] {
  return [
    {
      label: "Week 2 (Days 8–14)",
      paidOrders: 0,
      paidCases: 0,
      organicOrders: 0,
      organicCases: 0,
      pricePerCase: 32.4,
      shipChargedPerCase: 10,
      refunds: 0,
      metaAdSpend: 0,
    },
    {
      label: "Week 3 (Days 15–21)",
      paidOrders: 0,
      paidCases: 0,
      organicOrders: 0,
      organicCases: 0,
      pricePerCase: 32.4,
      shipChargedPerCase: 10,
      refunds: 0,
      metaAdSpend: 0,
    },
    {
      label: "Week 4 (Days 22–30)",
      paidOrders: 0,
      paidCases: 0,
      organicOrders: 0,
      organicCases: 0,
      pricePerCase: 32.4,
      shipChargedPerCase: 10,
      refunds: 0,
      metaAdSpend: 0,
    },
  ];
}

function makeZero30dWeeks(): WeeklyRow[] {
  return makeBlank30dWeeks().map((w) => ({
    ...w,
    paidOrders: 0,
    paidCases: 0,
    organicOrders: 0,
    organicCases: 0,
    pricePerCase: 0,
    shipChargedPerCase: 0,
    refunds: 0,
    metaAdSpend: 0,
  }));
}

const LS_KEY = "fcc_v2";

function lsGet<T>(field: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(LS_KEY) ?? "null";
    const blob = JSON.parse(raw);
    const v = blob?.[field];
    return v !== undefined && v !== null ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsClear() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(LS_KEY);
  }
}

function money(n: number) {
  const x = Number.isFinite(n) ? n : 0;
  return x.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function num(n: number, digits = 2) {
  return (Number.isFinite(n) ? n : 0).toFixed(digits);
}

function clamp0(n: number) {
  return Math.max(0, n);
}

function daysAgo(d: number) {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt;
}

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function addDays(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toYmd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseYmdLocal(s: string) {
  const [y, m, d] = s.split("-").map((v) => Number(v));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return new Date();
  }
  return new Date(y, m - 1, d);
}

type RowLike = {
  paidOrders: number;
  paidCases: number;
  organicOrders: number;
  organicCases: number;
  pricePerCase: number;
  shipChargedPerCase: number;
  refunds: number;
  metaAdSpend: number;
  restocks?: number;
};

const EMPTY_SUM: DtcSum = {
  orders: 0,
  paidOrders: 0,
  organicOrders: 0,
  cases: 0,
  paidCases: 0,
  organicCases: 0,
  restocks: 0,
  metaAdSpend: 0,
  refunds: 0,
  productRevenue: 0,
  shipRevenue: 0,
  grossRevenue: 0,
  netRevenue: 0,
  cogs: 0,
  shipCost: 0,
  otherVar: 0,
  processing: 0,
  preAdContribution: 0,
  postAdContribution: 0,
};

function computeDtcSum(rows: RowLike[], assumptions: Assumptions): DtcSum {
  return rows.reduce(
    (acc, r) => {
      const paidOrders = r.paidOrders || 0;
      const organicOrders = r.organicOrders || 0;
      const paidCases = r.paidCases || 0;
      const organicCases = r.organicCases || 0;
      const totalOrders = paidOrders + organicOrders;
      const totalCases = paidCases + organicCases;

      acc.paidOrders += paidOrders;
      acc.organicOrders += organicOrders;
      acc.orders += totalOrders;
      acc.paidCases += paidCases;
      acc.organicCases += organicCases;
      acc.cases += totalCases;
      acc.restocks += r.restocks || 0;
      acc.metaAdSpend += r.metaAdSpend || 0;
      acc.refunds += r.refunds || 0;

      const productRevenue = totalCases * (r.pricePerCase || 0);
      const shipRevenue = totalCases * (r.shipChargedPerCase || 0);
      const grossRevenue = productRevenue + shipRevenue;
      const netRevenue = grossRevenue - (r.refunds || 0);

      acc.productRevenue += productRevenue;
      acc.shipRevenue += shipRevenue;
      acc.grossRevenue += grossRevenue;
      acc.netRevenue += netRevenue;

      const cogs = totalCases * (assumptions.cogsPerCase || 0);
      const shipCost = totalCases * (assumptions.shipCostPerCase || 0);
      const otherVar = totalCases * (assumptions.otherVarPerCase || 0);
      const processingPct = (assumptions.processingPercent || 0) / 100;
      const processing =
        netRevenue * processingPct +
        totalOrders * (assumptions.processingFixedPerOrder || 0);

      acc.cogs += cogs;
      acc.shipCost += shipCost;
      acc.otherVar += otherVar;
      acc.processing += processing;

      const preAdContribution = netRevenue - cogs - shipCost - otherVar - processing;
      acc.preAdContribution += preAdContribution;
      acc.postAdContribution += preAdContribution - (r.metaAdSpend || 0);

      return acc;
    },
    { ...EMPTY_SUM },
  );
}

const BG_RADIALS = [
  "radial-gradient(ellipse 80% 60% at 15% -10%, rgba(29,78,216,0.38) 0%, transparent 68%)",
  "radial-gradient(ellipse 60% 45% at 88% 8%, rgba(99,102,241,0.28) 0%, transparent 60%)",
  "radial-gradient(ellipse 55% 65% at 4% 88%, rgba(37,99,235,0.22) 0%, transparent 65%)",
  "radial-gradient(ellipse 45% 45% at 95% 88%, rgba(79,70,229,0.16) 0%, transparent 60%)",
].join(", ");

const GRAIN_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' " +
  "width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence " +
  "type='fractalNoise' baseFrequency='0.68' numOctaves='4' " +
  "stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' " +
  "filter='url(%23n)' opacity='1'/%3E%3C/svg%3E";

function MetricCard(props: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "good" | "bad" | "warn";
}) {
  const tone = props.tone ?? "neutral";
  const text =
    tone === "good"
      ? "text-emerald-400"
      : tone === "bad"
        ? "text-rose-400"
        : tone === "warn"
          ? "text-amber-400"
          : "text-zinc-100";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm backdrop-blur-sm">
      <div className="text-xs font-medium text-zinc-500">{props.label}</div>
      <div className={`mt-1 truncate text-2xl font-semibold ${text}`}>{props.value}</div>
      {props.sub && <div className="mt-1 text-xs leading-snug text-zinc-600">{props.sub}</div>}
    </div>
  );
}

function StatBox(props: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="text-xs text-zinc-500">{props.label}</div>
      <div className={`mt-1 text-lg font-semibold ${props.valueClass ?? "text-zinc-100"}`}>
        {props.value}
      </div>
      {props.sub && <div className="mt-1 text-[11px] text-zinc-600">{props.sub}</div>}
    </div>
  );
}

function PanelTitle(props: { title: string; sub?: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-zinc-200">{props.title}</h2>
      {props.sub && <p className="mt-1 text-xs text-zinc-500">{props.sub}</p>}
    </div>
  );
}

function FieldNumber(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-zinc-400">{props.label}</div>
      <input
        className={
          "mt-1 w-full rounded-xl border border-white/10 bg-black/40 " +
          "px-3 py-2 text-sm text-zinc-100 outline-none " +
          "transition-colors focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 " +
          "disabled:opacity-40"
        }
        type="number"
        step={props.step ?? "0.01"}
        disabled={props.disabled}
        value={Number.isFinite(props.value) ? props.value : 0}
        onChange={(e) => props.onChange(parseFloat(e.target.value) || 0)}
      />
    </label>
  );
}

function FieldText(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-zinc-400">{props.label}</div>
      <input
        className={
          "mt-1 w-full rounded-xl border border-white/10 bg-black/40 " +
          "px-3 py-2 text-sm text-zinc-100 outline-none " +
          "transition-colors focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
        }
        type="text"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

function MiniNumber(props: {
  value: number;
  onChange: (v: number) => void;
  step?: string;
}) {
  return (
    <input
      className={
        "w-24 rounded-lg border border-white/10 bg-black/40 " +
        "px-2 py-1 text-right text-sm text-zinc-100 outline-none " +
        "transition-colors focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
      }
      type="number"
      step={props.step ?? "1"}
      value={Number.isFinite(props.value) ? props.value : 0}
      onChange={(e) => props.onChange(parseFloat(e.target.value) || 0)}
    />
  );
}

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const fmt = props.format ?? ((v: number) => v.toFixed(2));
  const valColor =
    props.value > 0 ? "text-emerald-400" : props.value < 0 ? "text-rose-400" : "text-zinc-400";
  return (
    <label className="block">
      <div className="mb-2 flex justify-between text-xs font-medium text-zinc-400">
        <span>{props.label}</span>
        <span className={valColor}>{fmt(props.value)}</span>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(parseFloat(e.target.value))}
        className="w-full cursor-pointer accent-blue-500"
      />
      <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
        <span>{fmt(props.min)}</span>
        <span>0</span>
        <span>{fmt(props.max)}</span>
      </div>
    </label>
  );
}

export default function Page() {
  const [mounted, setMounted] = useState(false);
  const skipPersistRef = useRef(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [inventoryStart, setInventoryStart] = useState<number>(INITIAL_INVENTORY);
  const [assumptions, setAssumptions] = useState<Assumptions>(INITIAL_ASSUMPTIONS);
  const [rows, setRows] = useState<DayRow[]>(() => makeBlankRows());
  const [weeks2to4, setWeeks2to4] = useState<WeeklyRow[]>(() => makeBlank30dWeeks());
  const [wholesaleDeals, setWholesaleDeals] = useState<WholesaleDeal[]>([]);
  const [pendingDeals, setPendingDeals] = useState<PendingDeal[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [ws, setWs] = useState({ ...INITIAL_WS });
  const [projectionWeeklyGrowthPct, setProjectionWeeklyGrowthPct] = useState<number>(0);
  const [leadTimeDays, setLeadTimeDays] = useState<number>(42);
  const [priceAdjust, setPriceAdjust] = useState<number>(0);
  const [cogsAdjust, setCogsAdjust] = useState<number>(0);
  const [show30d, setShow30d] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    setInventoryStart(lsGet("inventoryStart", INITIAL_INVENTORY));
    setAssumptions(lsGet("assumptions", INITIAL_ASSUMPTIONS));
    setRows(lsGet("rows", makeBlankRows()));
    setWeeks2to4(lsGet("weeks2to4", makeBlank30dWeeks()));
    setWholesaleDeals(lsGet("wholesaleDeals", []));
    setPendingDeals(lsGet("pendingDeals", []));
    setSnapshots(lsGet("snapshots", []));
    setWs(lsGet("ws", INITIAL_WS));
    setProjectionWeeklyGrowthPct(lsGet("projectionWeeklyGrowthPct", 0));
    setLeadTimeDays(lsGet("leadTimeDays", 42));
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          inventoryStart,
          assumptions,
          rows,
          weeks2to4,
          wholesaleDeals,
          pendingDeals,
          snapshots,
          ws,
          projectionWeeklyGrowthPct,
          leadTimeDays,
        }),
      );
    } catch {}
  }, [
    mounted,
    inventoryStart,
    assumptions,
    rows,
    weeks2to4,
    wholesaleDeals,
    pendingDeals,
    snapshots,
    ws,
    projectionWeeklyGrowthPct,
    leadTimeDays,
  ]);

  const dtc = useMemo(() => {
    const sum = computeDtcSum(rows, assumptions);
    const avgDailyCases = sum.cases / 7;
    const inventoryNowBase = clamp0(inventoryStart - sum.cases + sum.restocks);
    const postAdPerCase = sum.cases > 0 ? sum.postAdContribution / sum.cases : 0;
    const paidCacPerOrder = sum.paidOrders > 0 ? sum.metaAdSpend / sum.paidOrders : 0;
    const roas = sum.metaAdSpend > 0 ? sum.netRevenue / sum.metaAdSpend : 0;
    const preAdMargin = sum.netRevenue > 0 ? sum.preAdContribution / sum.netRevenue : 0;
    const postAdMargin = sum.netRevenue > 0 ? sum.postAdContribution / sum.netRevenue : 0;
    const preAdPerOrder = sum.orders > 0 ? sum.preAdContribution / sum.orders : 0;
    return {
      sum,
      avgDailyCases,
      inventoryNowBase,
      postAdPerCase,
      paidCacPerOrder,
      roas,
      preAdMargin,
      postAdMargin,
      preAdPerOrder,
    };
  }, [rows, assumptions, inventoryStart]);

  const dtc30 = useMemo(() => {
    const allRows: RowLike[] = [...rows, ...weeks2to4];
    const sum = computeDtcSum(allRows, assumptions);
    const avgDailyCases = sum.cases / 30;
    const preAdMargin = sum.netRevenue > 0 ? sum.preAdContribution / sum.netRevenue : 0;
    const postAdMargin = sum.netRevenue > 0 ? sum.postAdContribution / sum.netRevenue : 0;
    const paidCacPerOrder = sum.paidOrders > 0 ? sum.metaAdSpend / sum.paidOrders : 0;
    const roas = sum.metaAdSpend > 0 ? sum.netRevenue / sum.metaAdSpend : 0;
    const has30dData = weeks2to4.some((w) => w.paidCases + w.organicCases > 0);
    return { sum, avgDailyCases, preAdMargin, postAdMargin, paidCacPerOrder, roas, has30dData };
  }, [rows, weeks2to4, assumptions]);

  const wsCalc = useMemo(() => {
    const cases = Math.max(0, ws.cases || 0);
    const pricePerCase = Math.max(0, ws.pricePerCase || 0);
    const revenue = cases * pricePerCase;
    const cogs = cases * (assumptions.cogsPerCase || 0);
    const otherVar = cases * (assumptions.otherVarPerCase || 0);
    const shipCost = ws.youPayShipping ? Math.max(0, ws.shipCostTotal || 0) : 0;
    const processing = revenue * ((assumptions.wholesaleProcessingPercent || 0) / 100);
    const contribution = revenue - cogs - otherVar - shipCost - processing;
    const margin = revenue > 0 ? contribution / revenue : 0;
    const minMargin = (assumptions.wholesaleMinMargin || 0) / 100;
    const isGreen = margin >= minMargin && revenue > 0;
    const isRed = revenue > 0 && !isGreen;
    const reasons: string[] = [];
    if (revenue <= 0) reasons.push("Enter cases and a price per case.");
    if (shipCost > 0) reasons.push("You are paying shipping on this deal.");
    if (margin < minMargin && revenue > 0) {
      reasons.push(
        `Margin is below your minimum (${assumptions.wholesaleMinMargin}%). Raise price, reduce shipping, or lower COGS.`,
      );
    }
    if (ws.paymentTermsDays >= 60) {
      reasons.push("Long payment terms can create cash stress. Try net 30 or a deposit.");
    }
    if (ws.strategicValue) {
      reasons.push("Strategic value toggle is ON — you may accept thinner margin if cash allows.");
    }
    return {
      revenue,
      cogs,
      otherVar,
      shipCost,
      processing,
      contribution,
      margin,
      isGreen,
      isRed,
      reasons: reasons.slice(0, 4),
    };
  }, [ws, assumptions]);

  const wsTotals = useMemo(() => {
    const d7 = daysAgo(7);
    const d30 = daysAgo(30);
    const base = {
      lifetimeCases: 0,
      lifetimeProfit: 0,
      cases7: 0,
      profit7: 0,
      cases30: 0,
      profit30: 0,
    };
    for (const deal of wholesaleDeals) {
      const created = new Date(deal.createdAt);
      base.lifetimeCases += deal.cases;
      base.lifetimeProfit += deal.contribution;
      if (created >= d7) {
        base.cases7 += deal.cases;
        base.profit7 += deal.contribution;
      }
      if (created >= d30) {
        base.cases30 += deal.cases;
        base.profit30 += deal.contribution;
      }
    }
    return base;
  }, [wholesaleDeals]);

  const pendingTotals = useMemo(() => {
    return pendingDeals.reduce(
      (acc, d) => {
        acc.cases += d.cases;
        acc.revenue += d.cases * d.pricePerCase;
        acc.contribution += d.contribution;
        return acc;
      },
      { cases: 0, revenue: 0, contribution: 0 },
    );
  }, [pendingDeals]);

  const inventoryNow = useMemo(
    () => clamp0(dtc.inventoryNowBase - wsTotals.lifetimeCases),
    [dtc.inventoryNowBase, wsTotals.lifetimeCases],
  );
  const avgDailyCases = dtc.avgDailyCases;
  const daysLeft = avgDailyCases > 0 ? inventoryNow / avgDailyCases : Infinity;

  const reorder = useMemo(() => {
    if (daysLeft === Infinity || avgDailyCases === 0) return null;
    const daysUntilEmpty = Math.floor(daysLeft);
    const daysUntilReorder = daysUntilEmpty - leadTimeDays;
    const reorderByDate = addDays(daysUntilReorder);
    const runoutDate = addDays(daysUntilEmpty);
    let urgency: "critical" | "warning" | "ok";
    let message: string;
    if (daysUntilReorder <= 0) {
      urgency = "critical";
      message =
        `You are LATE to reorder by ${Math.abs(daysUntilReorder)} days. ` +
        `Place a production order immediately or face a stockout by ${fmtDate(runoutDate)}.`;
    } else if (daysUntilReorder <= 7) {
      urgency = "critical";
      message =
        `Reorder within ${daysUntilReorder} day${daysUntilReorder === 1 ? "" : "s"} ` +
        `(by ${fmtDate(reorderByDate)}) to avoid a stockout. ` +
        `Production lead time is ${leadTimeDays} days.`;
    } else if (daysUntilReorder <= 14) {
      urgency = "warning";
      message =
        `Reorder by ${fmtDate(reorderByDate)} — that's ${daysUntilReorder} days away. ` +
        `Stockout risk on ${fmtDate(runoutDate)} if you delay.`;
    } else {
      urgency = "ok";
      message =
        `You have ${daysUntilReorder} days before you need to reorder ` +
        `(by ${fmtDate(reorderByDate)}). At current velocity, ` +
        `inventory runs out ${fmtDate(runoutDate)}.`;
    }
    return { urgency, message, daysUntilReorder, reorderByDate, runoutDate };
  }, [daysLeft, leadTimeDays, avgDailyCases]);

  const combined = useMemo(
    () => ({
      combinedProfit7: dtc.sum.postAdContribution + wsTotals.profit7,
    }),
    [dtc.sum.postAdContribution, wsTotals.profit7],
  );

  const arbitrage = useMemo(() => {
    const dtcPostAdPerCase = dtc.postAdPerCase;
    const price = assumptions.wholesaleDefaultPricePerCase || 0;
    const cogs = assumptions.cogsPerCase || 0;
    const other = assumptions.otherVarPerCase || 0;
    const proc = ((assumptions.wholesaleProcessingPercent || 0) / 100) * price;
    const defaultWs = price - cogs - other - proc;
    const message: string[] = [];
    if (dtc.sum.cases === 0) {
      return {
        tone: "neutral" as const,
        message: ["No DTC cases in last 7 days yet."],
        dtcPostAdPerCase: 0,
        defaultWs,
      };
    }
    if (dtcPostAdPerCase < defaultWs) {
      message.push(
        `Wholesale arbitrage is ON: default wholesale profit/case (${money(defaultWs)}) beats DTC post-ad profit/case (${money(dtcPostAdPerCase)}).`,
      );
      message.push(
        "If cash is tight, shift effort toward wholesale or fix CAC/AOV before scaling ads.",
      );
      return { tone: "bad" as const, message, dtcPostAdPerCase, defaultWs };
    }
    message.push(
      `DTC is currently stronger: DTC post-ad profit/case (${money(dtcPostAdPerCase)}) beats default wholesale profit/case (${money(defaultWs)}).`,
    );
    message.push(
      "Wholesale can still be great for volume + stability, but you're not forced into it for margin right now.",
    );
    return { tone: "good" as const, message, dtcPostAdPerCase, defaultWs };
  }, [dtc.postAdPerCase, dtc.sum.cases, assumptions]);

  const breakEvenCac = useMemo(() => {
    const maxCac = dtc.preAdPerOrder;
    const currentCac = dtc.paidCacPerOrder;
    const headroom = maxCac - currentCac;
    const utilizationPct = maxCac > 0 ? (currentCac / maxCac) * 100 : 0;
    return { maxCac, currentCac, headroom, utilizationPct };
  }, [dtc.preAdPerOrder, dtc.paidCacPerOrder]);

  const sensitivity = useMemo(() => {
    const cases = dtc.sum.cases;
    const processingPct = (assumptions.processingPercent || 0) / 100;
    const extraRevenue = cases * priceAdjust * (1 - processingPct);
    const cogsSavings = cases * cogsAdjust;
    const sensPostAd = dtc.sum.postAdContribution + extraRevenue + cogsSavings;
    const sensPreAd = dtc.sum.preAdContribution + extraRevenue + cogsSavings;
    const sensPostAdPerCase = cases > 0 ? sensPostAd / cases : 0;
    const delta = sensPostAd - dtc.sum.postAdContribution;
    return { sensPostAd, sensPreAd, sensPostAdPerCase, delta, extraRevenue, cogsSavings };
  }, [dtc.sum, assumptions, priceAdjust, cogsAdjust]);

  const projection = useMemo(() => {
    const weeklyNet = dtc30.has30dData ? dtc30.sum.netRevenue / 4.3 : dtc.sum.netRevenue;
    const weeklyCases = dtc30.has30dData ? dtc30.sum.cases / 4.3 : dtc.sum.cases;
    const weeklyProfit = dtc30.has30dData
      ? dtc30.sum.postAdContribution / 4.3
      : dtc.sum.postAdContribution;
    const runRateRevenue = weeklyNet * 52;
    const runRateProfit = weeklyProfit * 52;
    const g = (projectionWeeklyGrowthPct || 0) / 100;
    let projectedRevenue = 0;
    let projectedProfit = 0;
    let projectedCases = 0;
    for (let t = 0; t < 52; t++) {
      const f = Math.pow(1 + g, t);
      projectedRevenue += weeklyNet * f;
      projectedProfit += weeklyProfit * f;
      projectedCases += weeklyCases * f;
    }
    return {
      weeklyNet,
      weeklyProfit,
      runRateRevenue,
      runRateProfit,
      projectedRevenue,
      projectedProfit,
      projectedCases,
    };
  }, [dtc.sum, dtc30, projectionWeeklyGrowthPct]);

  const truthEngine = useMemo(() => {
    const items: {
      tone: "good" | "bad" | "neutral";
      title: string;
      why: string;
      action: string;
    }[] = [];
    const postAdMarginPct = dtc.postAdMargin * 100;
    const preAdMarginPct = dtc.preAdMargin * 100;

    if (dtc.sum.cases === 0) {
      items.push({
        tone: "neutral",
        title: "Get real data in",
        why: "No cases sold in last 7 days — the engine can't diagnose anything yet.",
        action: "Enter the last 7 days of paid + organic cases and orders (even approximate).",
      });
      return items.slice(0, 3);
    }

    if (dtc.sum.preAdContribution < 0) {
      items.push({
        tone: "bad",
        title: "Fix unit economics before ads",
        why: `You're losing money BEFORE ads. Pre-ad margin is ${preAdMarginPct.toFixed(1)}%.`,
        action: "Raise price, reduce shipping cost, reduce COGS, or tighten refunds/processing.",
      });
    }

    if (dtc.sum.postAdContribution < 0 && dtc.sum.paidOrders > 0) {
      items.push({
        tone: "bad",
        title: "Ads are buying revenue, not profit",
        why: `Post-ad contribution is negative. Paid CAC is ${money(dtc.paidCacPerOrder)} on ${dtc.sum.paidOrders} paid orders.`,
        action: "Pause spend increases. Fix creative/AOV/offer or shift focus to wholesale to stabilize cash.",
      });
    }

    if (daysLeft !== Infinity && daysLeft < 21) {
      items.push({
        tone: "bad",
        title: "Inventory runway is tight",
        why: `At ${num(avgDailyCases, 2)} cases/day, you have ~${daysLeft.toFixed(0)} days left.`,
        action: "Plan restocks/production now and avoid scaling demand into a stockout.",
      });
    }

    if (items.length === 0) {
      items.push({
        tone: "good",
        title: "You have permission to execute",
        why: `Pre-ad margin ${preAdMarginPct.toFixed(1)}%, post-ad margin ${postAdMarginPct.toFixed(1)}%.`,
        action: "Keep inputs updated weekly. Test 1 improvement lever at a time (price/AOV/CAC/wholesale).",
      });
    }

    if (arbitrage.tone === "bad") {
      items.push({
        tone: "neutral",
        title: "Channel arbitrage opportunity",
        why: arbitrage.message[0] ?? "Wholesale vs DTC economics are shifting.",
        action: "If you need cash stability, prioritize wholesale while you repair CAC/AOV.",
      });
    }

    if (reorder?.urgency === "critical") {
      items.push({
        tone: "bad",
        title: "Reorder NOW",
        why: reorder.message,
        action: "Place a production order today.",
      });
    }

    return items.slice(0, 3);
  }, [dtc, daysLeft, avgDailyCases, arbitrage, reorder]);

  const dataWarnings = useMemo(() => {
    const warnings: string[] = [];

    if (dtc.sum.paidOrders === 0 && dtc.sum.metaAdSpend > 0) {
      warnings.push("Meta spend entered but paid orders are 0 (CAC will be undefined).");
    }

    const avgRowPrice =
      rows.length > 0 ? rows.reduce((acc, r) => acc + (r.pricePerCase || 0), 0) / rows.length : 0;
    if (dtc.sum.cases > 0 && avgRowPrice === 0) {
      warnings.push("Cases were entered, but average price per case across the 7-day rows is 0.");
    }

    for (const r of rows) {
      const cases = (r.paidCases || 0) + (r.organicCases || 0);
      const gross = cases * ((r.pricePerCase || 0) + (r.shipChargedPerCase || 0));
      if ((r.refunds || 0) > gross) {
        warnings.push(`Refunds exceed gross collected on ${r.date}.`);
      }
    }

    if (inventoryStart === 0 && (dtc.sum.restocks > 0 || dtc.sum.cases > 0)) {
      warnings.push("Inventory start is 0 while restocks/cases activity exists.");
    }

    for (const d of wholesaleDeals) {
      if (d.cases <= 0 || d.pricePerCase <= 0) {
        warnings.push(`Wholesale deal "${d.retailer}" has non-positive cases or price.`);
      }
    }

    return warnings.slice(0, 5);
  }, [dtc.sum, rows, inventoryStart, wholesaleDeals]);

  function updateRow(i: number, patch: Partial<DayRow>) {
    setRows((prev) => {
      const copy = [...prev];
      copy[i] = { ...copy[i], ...patch };
      return copy;
    });
  }

  function updateWeek(i: number, patch: Partial<WeeklyRow>) {
    setWeeks2to4((prev) => {
      const copy = [...prev];
      copy[i] = { ...copy[i], ...patch };
      return copy;
    });
  }

  function fillPriceShipDown7d() {
    setRows((prev) => {
      if (prev.length === 0) return prev;
      const source = prev[prev.length - 1] ?? prev[0];
      return prev.map((r) => ({
        ...r,
        pricePerCase: source.pricePerCase || 0,
        shipChargedPerCase: source.shipChargedPerCase || 0,
      }));
    });
  }

  function shiftWindowForwardOneDay() {
    setRows((prev) => {
      if (prev.length === 0) return prev;
      const newest = prev[prev.length - 1];
      const nextDate = parseYmdLocal(newest.date);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextRow: DayRow = {
        ...newest,
        date: toYmd(nextDate),
        paidOrders: 0,
        paidCases: 0,
        organicOrders: 0,
        organicCases: 0,
        refunds: 0,
        metaAdSpend: 0,
        restocks: 0,
      };
      return [...prev.slice(1), nextRow];
    });
  }

  function zeroThisWeekKeepPriceShip() {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        paidOrders: 0,
        paidCases: 0,
        organicOrders: 0,
        organicCases: 0,
        refunds: 0,
        metaAdSpend: 0,
        restocks: 0,
      })),
    );
  }

  function fillPriceShipDown30d() {
    setWeeks2to4((prev) => {
      if (prev.length === 0) return prev;
      const source =
        [...prev]
          .reverse()
          .find((w) => (w.pricePerCase || 0) !== 0 || (w.shipChargedPerCase || 0) !== 0) ?? prev[0];
      return prev.map((w) => ({
        ...w,
        pricePerCase: source.pricePerCase || 0,
        shipChargedPerCase: source.shipChargedPerCase || 0,
      }));
    });
  }

  function zero30dWeeksKeepPriceShip() {
    setWeeks2to4((prev) =>
      prev.map((w) => ({
        ...w,
        paidOrders: 0,
        paidCases: 0,
        organicOrders: 0,
        organicCases: 0,
        refunds: 0,
        metaAdSpend: 0,
      })),
    );
  }

  function exportState() {
    if (typeof window === "undefined") return;
    setImportError(null);
    const payload = {
      inventoryStart,
      assumptions,
      rows,
      weeks2to4,
      wholesaleDeals,
      pendingDeals,
      snapshots,
      ws,
      projectionWeeklyGrowthPct,
      leadTimeDays,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `founder-command-center-${toYmd(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const raw = await file.text();
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid JSON shape");
      }
      const obj = parsed as Record<string, unknown>;

      const asNum = (v: unknown, fallback: number) =>
        typeof v === "number" && Number.isFinite(v) ? v : fallback;
      const asStr = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
      const asBool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

      const assumptionsIn = obj.assumptions as Partial<Assumptions> | undefined;
      const nextAssumptions: Assumptions = {
        cogsPerCase: asNum(assumptionsIn?.cogsPerCase, INITIAL_ASSUMPTIONS.cogsPerCase),
        shipCostPerCase: asNum(assumptionsIn?.shipCostPerCase, INITIAL_ASSUMPTIONS.shipCostPerCase),
        otherVarPerCase: asNum(assumptionsIn?.otherVarPerCase, INITIAL_ASSUMPTIONS.otherVarPerCase),
        processingPercent: asNum(assumptionsIn?.processingPercent, INITIAL_ASSUMPTIONS.processingPercent),
        processingFixedPerOrder: asNum(
          assumptionsIn?.processingFixedPerOrder,
          INITIAL_ASSUMPTIONS.processingFixedPerOrder,
        ),
        wholesaleMinMargin: asNum(assumptionsIn?.wholesaleMinMargin, INITIAL_ASSUMPTIONS.wholesaleMinMargin),
        wholesaleDefaultPricePerCase: asNum(
          assumptionsIn?.wholesaleDefaultPricePerCase,
          INITIAL_ASSUMPTIONS.wholesaleDefaultPricePerCase,
        ),
        wholesaleProcessingPercent: asNum(
          assumptionsIn?.wholesaleProcessingPercent,
          INITIAL_ASSUMPTIONS.wholesaleProcessingPercent,
        ),
      };

      const rowDefaults = makeBlankRows();
      const rowsIn = Array.isArray(obj.rows) ? obj.rows : [];
      const nextRows: DayRow[] = rowDefaults.map((base, i) => {
        const r = (rowsIn[i] ?? {}) as Partial<DayRow>;
        return {
          date: asStr(r.date, base.date),
          paidOrders: asNum(r.paidOrders, base.paidOrders),
          paidCases: asNum(r.paidCases, base.paidCases),
          organicOrders: asNum(r.organicOrders, base.organicOrders),
          organicCases: asNum(r.organicCases, base.organicCases),
          pricePerCase: asNum(r.pricePerCase, base.pricePerCase),
          shipChargedPerCase: asNum(r.shipChargedPerCase, base.shipChargedPerCase),
          refunds: asNum(r.refunds, base.refunds),
          metaAdSpend: asNum(r.metaAdSpend, base.metaAdSpend),
          restocks: asNum(r.restocks, base.restocks),
        };
      });

      const weekDefaults = makeBlank30dWeeks();
      const weeksIn = Array.isArray(obj.weeks2to4) ? obj.weeks2to4 : [];
      const nextWeeks: WeeklyRow[] = weekDefaults.map((base, i) => {
        const w = (weeksIn[i] ?? {}) as Partial<WeeklyRow>;
        return {
          label: asStr(w.label, base.label),
          paidOrders: asNum(w.paidOrders, base.paidOrders),
          paidCases: asNum(w.paidCases, base.paidCases),
          organicOrders: asNum(w.organicOrders, base.organicOrders),
          organicCases: asNum(w.organicCases, base.organicCases),
          pricePerCase: asNum(w.pricePerCase, base.pricePerCase),
          shipChargedPerCase: asNum(w.shipChargedPerCase, base.shipChargedPerCase),
          refunds: asNum(w.refunds, base.refunds),
          metaAdSpend: asNum(w.metaAdSpend, base.metaAdSpend),
        };
      });

      const dealFrom = (d: unknown): WholesaleDeal | null => {
        if (!d || typeof d !== "object") return null;
        const x = d as Partial<WholesaleDeal>;
        return {
          id: asStr(x.id, uid()),
          createdAt: asStr(x.createdAt, new Date().toISOString()),
          retailer: asStr(x.retailer, "Wholesale account"),
          cases: asNum(x.cases, 0),
          pricePerCase: asNum(x.pricePerCase, 0),
          youPayShipping: asBool(x.youPayShipping, false),
          shipCostTotal: asNum(x.shipCostTotal, 0),
          paymentTermsDays: asNum(x.paymentTermsDays, 0),
          strategicValue: asBool(x.strategicValue, false),
          contribution: asNum(x.contribution, 0),
          margin: asNum(x.margin, 0),
        };
      };

      const nextWholesaleDeals = (Array.isArray(obj.wholesaleDeals) ? obj.wholesaleDeals : [])
        .map(dealFrom)
        .filter((d): d is WholesaleDeal => d !== null);

      const nextPendingDeals = (Array.isArray(obj.pendingDeals) ? obj.pendingDeals : [])
        .map(dealFrom)
        .filter((d): d is PendingDeal => d !== null);

      const snapshotFrom = (s: unknown): Snapshot | null => {
        if (!s || typeof s !== "object") return null;
        const x = s as Partial<Snapshot>;
        return {
          id: asStr(x.id, uid()),
          savedAt: asStr(x.savedAt, new Date().toISOString()),
          label: asStr(x.label, "Imported Snapshot"),
          revenue7d: asNum(x.revenue7d, 0),
          preAdContrib7d: asNum(x.preAdContrib7d, 0),
          postAdContrib7d: asNum(x.postAdContrib7d, 0),
          cases7d: asNum(x.cases7d, 0),
          preAdMargin7d: asNum(x.preAdMargin7d, 0),
          paidCac: asNum(x.paidCac, 0),
          inventoryNow: asNum(x.inventoryNow, 0),
          daysLeft: asNum(x.daysLeft, 0),
        };
      };

      const nextSnapshots = (Array.isArray(obj.snapshots) ? obj.snapshots : [])
        .map(snapshotFrom)
        .filter((s): s is Snapshot => s !== null);

      const wsIn = (obj.ws ?? {}) as Partial<typeof INITIAL_WS>;
      const nextWs = {
        retailer: asStr(wsIn.retailer, INITIAL_WS.retailer),
        cases: asNum(wsIn.cases, INITIAL_WS.cases),
        pricePerCase: asNum(wsIn.pricePerCase, INITIAL_WS.pricePerCase),
        youPayShipping: asBool(wsIn.youPayShipping, INITIAL_WS.youPayShipping),
        shipCostTotal: asNum(wsIn.shipCostTotal, INITIAL_WS.shipCostTotal),
        paymentTermsDays: asNum(wsIn.paymentTermsDays, INITIAL_WS.paymentTermsDays),
        strategicValue: asBool(wsIn.strategicValue, INITIAL_WS.strategicValue),
      };

      const nextStateBlob = {
        inventoryStart: asNum(obj.inventoryStart, INITIAL_INVENTORY),
        assumptions: nextAssumptions,
        rows: nextRows,
        weeks2to4: nextWeeks,
        wholesaleDeals: nextWholesaleDeals,
        pendingDeals: nextPendingDeals,
        snapshots: nextSnapshots,
        ws: nextWs,
        projectionWeeklyGrowthPct: asNum(obj.projectionWeeklyGrowthPct, 0),
        leadTimeDays: asNum(obj.leadTimeDays, 42),
      };

      skipPersistRef.current = true;
      setInventoryStart(nextStateBlob.inventoryStart);
      setAssumptions(nextStateBlob.assumptions);
      setRows(nextStateBlob.rows);
      setWeeks2to4(nextStateBlob.weeks2to4);
      setWholesaleDeals(nextStateBlob.wholesaleDeals);
      setPendingDeals(nextStateBlob.pendingDeals);
      setSnapshots(nextStateBlob.snapshots);
      setWs(nextStateBlob.ws);
      setProjectionWeeklyGrowthPct(nextStateBlob.projectionWeeklyGrowthPct);
      setLeadTimeDays(nextStateBlob.leadTimeDays);

      if (typeof window !== "undefined") {
        localStorage.setItem(LS_KEY, JSON.stringify(nextStateBlob));
      }
    } catch {
      setImportError("Import failed. Please select a valid Founder Command Center JSON export.");
    } finally {
      e.target.value = "";
    }
  }

  function addToPipeline() {
    if (wsCalc.revenue <= 0 || ws.cases <= 0) return;
    const deal: PendingDeal = {
      id: uid(),
      createdAt: new Date().toISOString(),
      retailer: ws.retailer || "Wholesale account",
      cases: Math.max(0, ws.cases),
      pricePerCase: Math.max(0, ws.pricePerCase),
      youPayShipping: ws.youPayShipping,
      shipCostTotal: ws.youPayShipping ? Math.max(0, ws.shipCostTotal) : 0,
      paymentTermsDays: Math.max(0, ws.paymentTermsDays),
      strategicValue: !!ws.strategicValue,
      contribution: wsCalc.contribution,
      margin: wsCalc.margin,
    };
    setPendingDeals((prev) => [deal, ...prev]);
    setWs((w) => ({ ...w, cases: 0 }));
  }

  function approvePending(id: string) {
    const deal = pendingDeals.find((d) => d.id === id);
    if (!deal) return;
    setWholesaleDeals((prev) => [{ ...deal }, ...prev]);
    setPendingDeals((prev) => prev.filter((d) => d.id !== id));
  }

  function rejectPending(id: string) {
    setPendingDeals((prev) => prev.filter((d) => d.id !== id));
  }

  function approveWholesale() {
    if (wsCalc.revenue <= 0 || ws.cases <= 0) return;
    const deal: WholesaleDeal = {
      id: uid(),
      createdAt: new Date().toISOString(),
      retailer: ws.retailer || "Wholesale account",
      cases: Math.max(0, ws.cases),
      pricePerCase: Math.max(0, ws.pricePerCase),
      youPayShipping: ws.youPayShipping,
      shipCostTotal: ws.youPayShipping ? Math.max(0, ws.shipCostTotal) : 0,
      paymentTermsDays: Math.max(0, ws.paymentTermsDays),
      strategicValue: !!ws.strategicValue,
      contribution: wsCalc.contribution,
      margin: wsCalc.margin,
    };
    setWholesaleDeals((prev) => [deal, ...prev]);
    setWs((w) => ({ ...w, cases: 0 }));
  }

  function saveSnapshot() {
    const snap: Snapshot = {
      id: uid(),
      savedAt: new Date().toISOString(),
      label: `Week of ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      revenue7d: dtc.sum.netRevenue,
      preAdContrib7d: dtc.sum.preAdContribution,
      postAdContrib7d: dtc.sum.postAdContribution,
      cases7d: dtc.sum.cases,
      preAdMargin7d: dtc.preAdMargin,
      paidCac: dtc.paidCacPerOrder,
      inventoryNow,
      daysLeft: daysLeft === Infinity ? 9999 : daysLeft,
    };
    setSnapshots((prev) => [snap, ...prev.slice(0, 11)]);
  }

  function handleReset() {
    const ok = window.confirm(
      "Reset everything to ZERO? This clears all data, wholesale deals, assumptions, snapshots, and browser storage.",
    );
    if (!ok) return;
    skipPersistRef.current = true;
    lsClear();
    setInventoryStart(0);
    setAssumptions({ ...ZERO_ASSUMPTIONS });
    setRows(makeZeroRows());
    setWeeks2to4(makeZero30dWeeks());
    setWholesaleDeals([]);
    setPendingDeals([]);
    setSnapshots([]);
    setWs({ ...ZERO_WS });
    setProjectionWeeklyGrowthPct(0);
    setLeadTimeDays(0);
    setPriceAdjust(0);
    setCogsAdjust(0);
    setShow30d(false);
    setShowSnapshots(false);
  }

  const postAdBad = dtc.sum.postAdContribution < 0;
  const preAdBad = dtc.sum.preAdContribution < 0;

  if (!mounted) {
    return (
      <div className="relative min-h-screen overflow-x-hidden text-zinc-100" style={{ background: "#05070c" }}>
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0" style={{ background: BG_RADIALS }} />
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            opacity: 0.07,
            backgroundImage: `url("${GRAIN_SVG}")`,
            backgroundRepeat: "repeat",
            backgroundSize: "300px 300px",
          }}
        />
        <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-8">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_0_40px_rgba(16,185,129,0.08)] backdrop-blur-xl">
            <div className="inline-flex items-center gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-5 py-4">
              <span className="relative flex h-4 w-4 items-center justify-center">
                <span className="absolute h-4 w-4 rounded-full bg-emerald-400/35 blur-[3px]" />
                <span className="relative h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.95)]" />
              </span>
              <div>
                <div className="text-sm font-semibold tracking-wide text-zinc-100">Founder Command Center</div>
                <div className="text-xs text-zinc-400">Loading</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden text-zinc-100" style={{ background: "#05070c" }}>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0" style={{ background: BG_RADIALS }} />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          opacity: 0.07,
          backgroundImage: `url("${GRAIN_SVG}")`,
          backgroundRepeat: "repeat",
          backgroundSize: "300px 300px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(16,185,129,0.08) 0%, transparent 38%), radial-gradient(circle at 50% 100%, rgba(59,130,246,0.06) 0%, transparent 42%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8">
        <header className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_10px_60px_rgba(2,6,23,0.35)] backdrop-blur-xl lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-4 rounded-2xl border border-emerald-400/20 bg-gradient-to-r from-emerald-400/10 to-emerald-300/5 px-5 py-4 shadow-[0_0_30px_rgba(16,185,129,0.08)]">
              <span className="relative flex h-5 w-5 items-center justify-center">
                <span className="absolute h-5 w-5 rounded-full bg-emerald-400/25 blur-[5px]" />
                <span className="absolute h-3.5 w-3.5 animate-pulse rounded-full bg-emerald-300/30" />
                <span className="relative h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.95)]" />
              </span>
              <div className="leading-tight">
                <div className="text-base font-semibold tracking-wide text-zinc-50">Founder Command Center</div>
                <div className="mt-1 text-xs text-zinc-400">{mounted ? "Auto-saved" : "Loading"}</div>
              </div>
            </div>

            <h1 className="mt-5 text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
              Truth Engine <span className="font-normal text-zinc-400">— DTC + Wholesale</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Split paid vs organic, simulate wholesale outcomes, approve pipeline deals, and track inventory runway with auto-saved inputs.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-2 pt-1 sm:items-end">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={saveSnapshot}
                className={
                  "rounded-xl border border-white/10 bg-white/5 px-3 py-2 " +
                  "text-sm font-semibold text-zinc-300 transition-all backdrop-blur-sm " +
                  "hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-300"
                }
              >
                📸 Save Snapshot
              </button>
              <button
                onClick={exportState}
                className={
                  "rounded-xl border border-white/10 bg-white/5 px-3 py-2 " +
                  "text-sm font-semibold text-zinc-300 transition-all backdrop-blur-sm " +
                  "hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300"
                }
              >
                Export
              </button>
              <button
                onClick={() => {
                  setImportError(null);
                  importInputRef.current?.click();
                }}
                className={
                  "rounded-xl border border-white/10 bg-white/5 px-3 py-2 " +
                  "text-sm font-semibold text-zinc-300 transition-all backdrop-blur-sm " +
                  "hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300"
                }
              >
                Import
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={handleImportFile}
              />
              <button
                onClick={handleReset}
                className={
                  "rounded-xl border border-white/10 bg-white/5 px-3 py-2 " +
                  "text-sm font-semibold text-zinc-400 transition-all backdrop-blur-sm " +
                  "hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
                }
              >
                ↺ Reset
              </button>
            </div>
            {importError ? (
              <p className="text-[11px] text-rose-400">{importError}</p>
            ) : (
              <p className="text-[11px] text-zinc-600">Data auto-saved to browser · Reset clears all</p>
            )}
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
          <PanelTitle title="Truth Engine — Top 3 Actions" sub="Rules-based, honest, and still encouraging." />
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
            {truthEngine.map((t, idx) => (
              <div
                key={idx}
                className={
                  "rounded-2xl border p-4 backdrop-blur-sm " +
                  (t.tone === "bad"
                    ? "border-rose-500/25 bg-rose-500/10"
                    : t.tone === "good"
                      ? "border-emerald-500/25 bg-emerald-500/10"
                      : "border-blue-500/25 bg-blue-500/10")
                }
              >
                <div className="text-sm font-semibold">{t.title}</div>
                <div className="mt-2 text-xs text-zinc-200/90">{t.why}</div>
                <div className="mt-3 text-xs text-zinc-400">Do this:</div>
                <div className="mt-1 text-sm">{t.action}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="DTC Net Revenue (7d)"
            value={money(dtc.sum.netRevenue)}
            sub={`Product ${money(dtc.sum.productRevenue)} + Ship ${money(dtc.sum.shipRevenue)} − Refunds ${money(dtc.sum.refunds)}`}
            tone="neutral"
          />
          <MetricCard
            label="DTC Pre-Ad Contribution (7d)"
            value={money(dtc.sum.preAdContribution)}
            sub={`Pre-ad margin ${(dtc.preAdMargin * 100).toFixed(1)}%`}
            tone={preAdBad ? "bad" : "good"}
          />
          <MetricCard
            label="DTC Post-Ad Contribution (7d)"
            value={money(dtc.sum.postAdContribution)}
            sub={`Meta spend ${money(dtc.sum.metaAdSpend)} · ROAS ${num(dtc.roas, 2)}x`}
            tone={postAdBad ? "bad" : "good"}
          />
          <MetricCard
            label="Paid CAC (Meta only)"
            value={dtc.sum.paidOrders > 0 ? money(dtc.paidCacPerOrder) : "—"}
            sub={`Paid orders ${dtc.sum.paidOrders} · Organic orders ${dtc.sum.organicOrders}`}
            tone="neutral"
          />
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Combined Profit (7d)"
            value={money(combined.combinedProfit7)}
            sub="DTC post-ad + Wholesale approved (7d)"
            tone={combined.combinedProfit7 < 0 ? "bad" : "good"}
          />
          <MetricCard label="Avg Daily Cases (7d)" value={num(dtc.avgDailyCases, 2)} sub="Total DTC cases ÷ 7" tone="neutral" />
          <MetricCard
            label="Inventory Now (cases)"
            value={inventoryNow.toLocaleString("en-US")}
            sub={`Start ${inventoryStart.toLocaleString()} − DTC ${dtc.sum.cases} + restocks ${dtc.sum.restocks} − WS ${wsTotals.lifetimeCases}`}
            tone="neutral"
          />
          <MetricCard
            label="Days of Inventory Left"
            value={daysLeft === Infinity ? "—" : daysLeft.toFixed(0)}
            sub="Inventory now ÷ avg daily DTC cases"
            tone={
              daysLeft !== Infinity && daysLeft < 14
                ? "bad"
                : daysLeft !== Infinity && daysLeft < 30
                  ? "warn"
                  : "neutral"
            }
          />
        </section>

        <section className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 backdrop-blur-sm">
          <PanelTitle title="Data Warnings" sub="Quick sanity checks on current inputs." />
          {dataWarnings.length === 0 ? (
            <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              No issues detected.
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {dataWarnings.map((w, i) => (
                <li
                  key={`${w}-${i}`}
                  className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
                >
                  {w}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <PanelTitle
              title="Break-even CAC Calculator"
              sub="How much can you afford to spend per paid customer before ads go negative?"
            />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBox label="Pre-ad contribution/order" value={money(breakEvenCac.maxCac)} sub="= your max sustainable CAC" />
              <StatBox
                label="Current paid CAC"
                value={dtc.sum.paidOrders > 0 ? money(breakEvenCac.currentCac) : "—"}
                valueClass={breakEvenCac.currentCac > breakEvenCac.maxCac ? "text-rose-400" : "text-zinc-100"}
              />
              <StatBox
                label="CAC headroom"
                value={dtc.sum.paidOrders > 0 ? money(breakEvenCac.headroom) : "—"}
                valueClass={breakEvenCac.headroom > 0 ? "text-emerald-400" : "text-rose-400"}
                sub={breakEvenCac.headroom > 0 ? "You can spend more per customer" : "You're overspending on ads"}
              />
              <StatBox
                label="CAC utilization"
                value={dtc.sum.paidOrders > 0 ? `${breakEvenCac.utilizationPct.toFixed(0)}%` : "—"}
                valueClass={
                  breakEvenCac.utilizationPct > 100
                    ? "text-rose-400"
                    : breakEvenCac.utilizationPct > 80
                      ? "text-amber-400"
                      : "text-emerald-400"
                }
                sub="of break-even capacity used"
              />
            </div>
            {dtc.sum.paidOrders > 0 && (
              <div
                className={
                  "mt-4 rounded-xl border px-4 py-3 text-sm " +
                  (breakEvenCac.headroom > 0
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
                    : "border-rose-500/25 bg-rose-500/10 text-rose-200")
                }
              >
                {breakEvenCac.headroom > 0
                  ? `✅ You have ${money(breakEvenCac.headroom)} of CAC headroom per paid order. You could increase ad spend by up to ${money(breakEvenCac.headroom * dtc.sum.paidOrders)} this week before going post-ad negative.`
                  : `⚠️ CAC is ${money(Math.abs(breakEvenCac.headroom))} above break-even. You're spending more to acquire each customer than you earn back before ads. Reduce bids or fix AOV/COGS first.`}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <PanelTitle title="Reorder Trigger" sub="Based on current velocity + your production lead time." />
            <div className="mt-4">
              <FieldNumber
                label="Production lead time (days)"
                value={leadTimeDays}
                step="1"
                onChange={(v) => setLeadTimeDays(Math.max(1, Math.round(v)))}
              />
            </div>
            {reorder ? (
              <div
                className={
                  "mt-4 rounded-xl border px-4 py-4 text-sm " +
                  (reorder.urgency === "critical"
                    ? "border-rose-500/40 bg-rose-500/15 text-rose-200"
                    : reorder.urgency === "warning"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                      : "border-emerald-500/25 bg-emerald-500/10 text-emerald-200")
                }
              >
                <div className="mb-1 font-semibold">
                  {reorder.urgency === "critical"
                    ? "🚨 Action required"
                    : reorder.urgency === "warning"
                      ? "⚠️ Reorder soon"
                      : "✅ Inventory healthy"}
                </div>
                {reorder.message}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400">
                  <div>
                    Reorder by: <span className="font-medium text-zinc-200">{fmtDate(reorder.reorderByDate)}</span>
                  </div>
                  <div>
                    Stockout on: <span className="font-medium text-zinc-200">{fmtDate(reorder.runoutDate)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-zinc-500">
                Enter daily cases data to see reorder timing.
              </div>
            )}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
          <PanelTitle
            title="What-If Sensitivity"
            sub="Slide to see how price increases or COGS reductions impact post-ad contribution — without changing your real assumptions."
          />
          <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <Slider
                label="Price increase per case ($)"
                value={priceAdjust}
                min={-5}
                max={10}
                step={0.5}
                onChange={setPriceAdjust}
                format={(v) => `$${v >= 0 ? "+" : ""}${v.toFixed(2)}`}
              />
              <Slider
                label="COGS reduction per case ($)"
                value={cogsAdjust}
                min={0}
                max={5}
                step={0.25}
                onChange={setCogsAdjust}
                format={(v) => `$${v >= 0 ? "-" : "+"}${Math.abs(v).toFixed(2)}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              <StatBox
                label="Current post-ad profit"
                value={money(dtc.sum.postAdContribution)}
                valueClass={dtc.sum.postAdContribution < 0 ? "text-rose-400" : "text-zinc-100"}
              />
              <StatBox
                label="What-if post-ad profit"
                value={money(sensitivity.sensPostAd)}
                valueClass={sensitivity.sensPostAd < 0 ? "text-rose-400" : "text-emerald-400"}
              />
              <StatBox
                label="Uplift from these changes"
                value={`${sensitivity.delta >= 0 ? "+" : ""}${money(sensitivity.delta)}`}
                valueClass={sensitivity.delta > 0 ? "text-emerald-400" : "text-rose-400"}
              />
              <StatBox
                label="What-if post-ad / case"
                value={money(sensitivity.sensPostAdPerCase)}
                valueClass={sensitivity.sensPostAdPerCase < 0 ? "text-rose-400" : "text-emerald-400"}
              />
            </div>
          </div>
          {(priceAdjust !== 0 || cogsAdjust !== 0) && (
            <div className="mt-4 flex gap-4 text-xs text-zinc-500">
              {priceAdjust !== 0 && (
                <span>
                  Price +{money(priceAdjust)}/case → extra revenue after processing:{" "}
                  <span className="text-zinc-300">{money(sensitivity.extraRevenue)}</span>
                </span>
              )}
              {cogsAdjust !== 0 && (
                <span>
                  COGS −{money(cogsAdjust)}/case → total savings:{" "}
                  <span className="text-zinc-300">{money(sensitivity.cogsSavings)}</span>
                </span>
              )}
            </div>
          )}
        </section>

        <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
          <PanelTitle
            title="Wholesale ↔ DTC Arbitrage Alert"
            sub="Capital allocation intelligence — where is profit-per-case strongest right now?"
          />
          {dtc.sum.cases > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-zinc-400">DTC post-ad profit/case</div>
                <div
                  className={`mt-1 text-xl font-bold ${dtc.postAdPerCase >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                >
                  {money(dtc.postAdPerCase)}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-zinc-400">Default wholesale profit/case</div>
                <div
                  className={`mt-1 text-xl font-bold ${arbitrage.defaultWs >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                >
                  {money(arbitrage.defaultWs)}
                </div>
              </div>
              <div
                className={
                  "col-span-2 rounded-xl border p-4 sm:col-span-1 " +
                  (arbitrage.tone === "bad"
                    ? "border-amber-500/30 bg-amber-500/10"
                    : arbitrage.tone === "good"
                      ? "border-emerald-500/25 bg-emerald-500/10"
                      : "border-blue-500/25 bg-blue-500/10")
                }
              >
                <div className="text-xs text-zinc-400">Verdict</div>
                <div
                  className={`mt-1 text-sm font-semibold ${
                    arbitrage.tone === "bad"
                      ? "text-amber-300"
                      : arbitrage.tone === "good"
                        ? "text-emerald-300"
                        : "text-blue-300"
                  }`}
                >
                  {arbitrage.tone === "bad"
                    ? "⚠️ Wholesale arbitrage ON"
                    : arbitrage.tone === "good"
                      ? "✅ DTC is the stronger engine"
                      : "—"}
                </div>
              </div>
            </div>
          )}
          <div
            className={
              "mt-4 rounded-2xl border p-4 " +
              (arbitrage.tone === "bad"
                ? "border-amber-500/25 bg-amber-500/10"
                : arbitrage.tone === "good"
                  ? "border-emerald-500/25 bg-emerald-500/10"
                  : "border-blue-500/25 bg-blue-500/10")
            }
          >
            <div className="space-y-2 text-sm">
              {arbitrage.message.map((m, i) => (
                <div key={i}>{m}</div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <PanelTitle
              title="Wholesale Deal Engine"
              sub="Plug in a deal → get a verdict → send to pipeline or approve directly."
            />
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldText
                label="Retailer / Account"
                value={ws.retailer}
                onChange={(v) => setWs((w) => ({ ...w, retailer: v }))}
              />
              <FieldNumber
                label="Cases"
                value={ws.cases}
                step="1"
                onChange={(v) => setWs((w) => ({ ...w, cases: Math.max(0, Math.round(v)) }))}
              />
              <FieldNumber
                label="Price per case ($)"
                value={ws.pricePerCase}
                step="0.01"
                onChange={(v) => setWs((w) => ({ ...w, pricePerCase: Math.max(0, v) }))}
              />
              <FieldNumber
                label="Payment terms (days)"
                value={ws.paymentTermsDays}
                step="1"
                onChange={(v) => setWs((w) => ({ ...w, paymentTermsDays: Math.max(0, Math.round(v)) }))}
              />
              <label
                className={
                  "flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 " +
                  "bg-black/30 px-3 py-2 text-sm transition-colors hover:border-white/20"
                }
              >
                <input
                  type="checkbox"
                  className="accent-emerald-400"
                  checked={ws.youPayShipping}
                  onChange={(e) => setWs((w) => ({ ...w, youPayShipping: e.target.checked }))}
                />
                <span className="text-zinc-200">You pay shipping?</span>
              </label>
              <FieldNumber
                label="Shipping total $ (if you pay)"
                value={ws.shipCostTotal}
                step="0.01"
                disabled={!ws.youPayShipping}
                onChange={(v) => setWs((w) => ({ ...w, shipCostTotal: Math.max(0, v) }))}
              />
              <label
                className={
                  "flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm " +
                  "transition-colors hover:border-white/20 sm:col-span-2"
                }
              >
                <input
                  type="checkbox"
                  className="accent-blue-400"
                  checked={ws.strategicValue}
                  onChange={(e) => setWs((w) => ({ ...w, strategicValue: e.target.checked }))}
                />
                <span className="text-zinc-200">Strategic value (door opener / brand building)</span>
              </label>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <StatBox label="Wholesale revenue" value={money(wsCalc.revenue)} />
              <StatBox
                label="Contribution (profit)"
                value={money(wsCalc.contribution)}
                valueClass={wsCalc.contribution < 0 ? "text-rose-400" : "text-emerald-400"}
              />
              <StatBox
                label="Margin"
                value={`${(wsCalc.margin * 100).toFixed(1)}%`}
                valueClass={
                  wsCalc.margin * 100 < assumptions.wholesaleMinMargin ? "text-amber-400" : "text-emerald-400"
                }
                sub={`Green if ≥ ${assumptions.wholesaleMinMargin}%`}
              />
              <StatBox
                label="Verdict"
                value={wsCalc.isGreen ? "✅ GOOD DEAL" : wsCalc.isRed ? "❌ RISKY DEAL" : "—"}
                valueClass={
                  wsCalc.isGreen ? "text-emerald-400" : wsCalc.isRed ? "text-rose-400" : "text-zinc-300"
                }
              />
            </div>
            {wsCalc.reasons.length > 0 && (
              <div className="mt-4 space-y-2">
                {wsCalc.reasons.map((r, i) => (
                  <div
                    key={i}
                    className={
                      "rounded-xl border px-4 py-3 text-sm " +
                      (wsCalc.isRed
                        ? "border-rose-500/25 bg-rose-500/10 text-rose-200"
                        : "border-emerald-500/25 bg-emerald-500/10 text-emerald-200")
                    }
                  >
                    {r}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                onClick={addToPipeline}
                disabled={wsCalc.revenue <= 0 || ws.cases <= 0}
                className={
                  "rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 " +
                  "text-sm font-semibold text-blue-300 transition-all " +
                  "hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-30"
                }
              >
                → Add to Pipeline
              </button>
              <button
                onClick={approveWholesale}
                disabled={wsCalc.revenue <= 0 || ws.cases <= 0}
                className={
                  "rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold " +
                  "text-white transition-all hover:bg-emerald-500 " +
                  "disabled:cursor-not-allowed disabled:bg-emerald-600/20 disabled:text-emerald-600/50"
                }
              >
                ✓ Approve directly
              </button>
              <div className="text-xs text-zinc-500">Pipeline = staged, not yet deducted from inventory.</div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <PanelTitle title="Wholesale Tracker" sub="Pipeline (pending) + approved deals." />

            {pendingDeals.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-300">
                    Pipeline ({pendingDeals.length} pending)
                  </span>
                  <span className="text-xs text-zinc-500">
                    {pendingTotals.cases} cases · {money(pendingTotals.revenue)} revenue ·{" "}
                    {money(pendingTotals.contribution)} profit
                  </span>
                </div>
                <div className="space-y-2">
                  {pendingDeals.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-2 text-sm"
                    >
                      <div>
                        <span className="font-medium text-zinc-200">{d.retailer}</span>
                        <span className="ml-3 text-xs text-zinc-500">
                          {d.cases} cases · {money(d.pricePerCase)}/case · Net {d.paymentTermsDays}d
                        </span>
                      </div>
                      <div className="ml-4 flex gap-2">
                        <button
                          onClick={() => approvePending(d.id)}
                          className="rounded-lg bg-emerald-600/80 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => rejectPending(d.id)}
                          className={
                            "rounded-lg border border-rose-500/30 bg-rose-500/10 " +
                            "px-3 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
                          }
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricCard
                label="Cases (7d)"
                value={wsTotals.cases7.toLocaleString()}
                sub={`Profit ${money(wsTotals.profit7)}`}
                tone={wsTotals.profit7 < 0 ? "bad" : "good"}
              />
              <MetricCard
                label="Cases (30d)"
                value={wsTotals.cases30.toLocaleString()}
                sub={`Profit ${money(wsTotals.profit30)}`}
                tone={wsTotals.profit30 < 0 ? "bad" : "good"}
              />
              <MetricCard
                label="Cases (lifetime)"
                value={wsTotals.lifetimeCases.toLocaleString()}
                sub={`Profit ${money(wsTotals.lifetimeProfit)}`}
                tone={wsTotals.lifetimeProfit < 0 ? "bad" : "good"}
              />
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-zinc-500">
                    <th className="py-2 pr-3 text-left">When</th>
                    <th className="px-2 py-2 text-left">Account</th>
                    <th className="px-2 py-2 text-right">Cases</th>
                    <th className="px-2 py-2 text-right">Price</th>
                    <th className="px-2 py-2 text-right">Margin</th>
                    <th className="px-2 py-2 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {wholesaleDeals.map((d) => (
                    <tr key={d.id} className="border-b border-white/5 transition-colors hover:bg-white/5">
                      <td className="py-2 pr-3 text-xs text-zinc-500">{new Date(d.createdAt).toLocaleString()}</td>
                      <td className="px-2 py-2 text-zinc-200">{d.retailer}</td>
                      <td className="px-2 py-2 text-right">{d.cases}</td>
                      <td className="px-2 py-2 text-right">{money(d.pricePerCase)}</td>
                      <td
                        className={`px-2 py-2 text-right ${
                          d.margin * 100 < assumptions.wholesaleMinMargin ? "text-amber-400" : "text-emerald-400"
                        }`}
                      >
                        {(d.margin * 100).toFixed(1)}%
                      </td>
                      <td
                        className={`px-2 py-2 text-right font-medium ${
                          d.contribution < 0 ? "text-rose-400" : "text-emerald-400"
                        }`}
                      >
                        {money(d.contribution)}
                      </td>
                    </tr>
                  ))}
                  {wholesaleDeals.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-zinc-600">
                        No wholesale deals approved yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <PanelTitle title="Assumptions" sub="Change anything — everything recalculates instantly." />
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldNumber
                label="COGS per case ($)"
                value={assumptions.cogsPerCase}
                onChange={(v) => setAssumptions((a) => ({ ...a, cogsPerCase: v }))}
              />
              <FieldNumber
                label="Your shipping cost/case (DTC)"
                value={assumptions.shipCostPerCase}
                onChange={(v) => setAssumptions((a) => ({ ...a, shipCostPerCase: v }))}
              />
              <FieldNumber
                label="Other variable cost/case ($)"
                value={assumptions.otherVarPerCase}
                onChange={(v) => setAssumptions((a) => ({ ...a, otherVarPerCase: v }))}
              />
              <FieldNumber
                label="DTC processing %"
                value={assumptions.processingPercent}
                onChange={(v) => setAssumptions((a) => ({ ...a, processingPercent: v }))}
              />
              <FieldNumber
                label="DTC processing fixed/order ($)"
                value={assumptions.processingFixedPerOrder}
                onChange={(v) => setAssumptions((a) => ({ ...a, processingFixedPerOrder: v }))}
              />
              <FieldNumber
                label="Wholesale min margin % (green)"
                value={assumptions.wholesaleMinMargin}
                onChange={(v) => setAssumptions((a) => ({ ...a, wholesaleMinMargin: v }))}
              />
              <FieldNumber
                label="Default wholesale price/case ($)"
                value={assumptions.wholesaleDefaultPricePerCase}
                onChange={(v) => setAssumptions((a) => ({ ...a, wholesaleDefaultPricePerCase: v }))}
              />
              <FieldNumber
                label="Wholesale processing % (0 = ACH)"
                value={assumptions.wholesaleProcessingPercent}
                onChange={(v) => setAssumptions((a) => ({ ...a, wholesaleProcessingPercent: v }))}
              />
              <FieldNumber
                label="Inventory start (cases)"
                value={inventoryStart}
                onChange={(v) => setInventoryStart(Math.max(0, v))}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <PanelTitle
              title="12-Month On-Target"
              sub={`Projection uses ${dtc30.has30dData ? "30-day average" : "7-day data (add 30d below for more accuracy)"}.`}
            />
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <StatBox label="Weekly net revenue" value={money(projection.weeklyNet)} />
              <StatBox
                label="Weekly post-ad profit"
                value={money(projection.weeklyProfit)}
                valueClass={projection.weeklyProfit < 0 ? "text-rose-400" : "text-emerald-400"}
              />
              <StatBox label="Run-rate revenue (flat)" value={money(projection.runRateRevenue)} />
              <StatBox
                label="Run-rate profit (flat)"
                value={money(projection.runRateProfit)}
                valueClass={projection.runRateProfit < 0 ? "text-rose-400" : "text-emerald-400"}
              />
              <div className="sm:col-span-2">
                <FieldNumber
                  label="Assumed weekly growth %"
                  value={projectionWeeklyGrowthPct}
                  onChange={(v) => setProjectionWeeklyGrowthPct(v)}
                />
              </div>
              <StatBox label="Projected 12-mo revenue" value={money(projection.projectedRevenue)} sub="Compounded weekly · 52 weeks" />
              <StatBox
                label="Projected 12-mo profit"
                value={money(projection.projectedProfit)}
                valueClass={projection.projectedProfit < 0 ? "text-rose-400" : "text-emerald-400"}
              />
              <StatBox label="Projected 12-mo cases (DTC)" value={`${projection.projectedCases.toFixed(0)} cases`} />
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
          <PanelTitle title="Last 7 Days — DTC Inputs" sub="Paid vs organic fixes CAC. Everything updates on every keystroke." />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={fillPriceShipDown7d}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300 transition-colors hover:border-blue-500/40 hover:text-blue-300"
            >
              Fill Price/Ship Down
            </button>
            <button
              onClick={shiftWindowForwardOneDay}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300 transition-colors hover:border-emerald-500/40 hover:text-emerald-300"
            >
              Shift Window +1 Day
            </button>
            <button
              onClick={zeroThisWeekKeepPriceShip}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300 transition-colors hover:border-amber-500/40 hover:text-amber-300"
            >
              Zero This Week
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-zinc-500">
                  <th className="py-2 pr-3 text-left">Date</th>
                  <th className="px-2 py-2 text-right">Paid Orders</th>
                  <th className="px-2 py-2 text-right">Paid Cases</th>
                  <th className="px-2 py-2 text-right">Org Orders</th>
                  <th className="px-2 py-2 text-right">Org Cases</th>
                  <th className="px-2 py-2 text-right">Price/Case</th>
                  <th className="px-2 py-2 text-right">Ship Charged/Case</th>
                  <th className="px-2 py-2 text-right">Refunds</th>
                  <th className="px-2 py-2 text-right">Meta Spend</th>
                  <th className="py-2 pl-2 text-right">Restocks</th>
                  <th className="py-2 pl-4 text-right">Day Net</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const totalCases = (r.paidCases || 0) + (r.organicCases || 0);
                  const dayNet = totalCases * (r.pricePerCase + r.shipChargedPerCase) - r.refunds;
                  return (
                    <tr key={r.date} className="border-b border-white/5 transition-colors hover:bg-white/5">
                      <td className="py-2 pr-3 text-left font-mono text-xs text-zinc-300">{r.date}</td>
                      <td className="px-2 py-2 text-right">
                        <MiniNumber value={r.paidOrders} onChange={(v) => updateRow(i, { paidOrders: v })} />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <MiniNumber value={r.paidCases} onChange={(v) => updateRow(i, { paidCases: v })} />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <MiniNumber value={r.organicOrders} onChange={(v) => updateRow(i, { organicOrders: v })} />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <MiniNumber value={r.organicCases} onChange={(v) => updateRow(i, { organicCases: v })} />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <MiniNumber value={r.pricePerCase} step="0.01" onChange={(v) => updateRow(i, { pricePerCase: v })} />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <MiniNumber
                          value={r.shipChargedPerCase}
                          step="0.01"
                          onChange={(v) => updateRow(i, { shipChargedPerCase: v })}
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <MiniNumber value={r.refunds} step="0.01" onChange={(v) => updateRow(i, { refunds: v })} />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <MiniNumber value={r.metaAdSpend} step="0.01" onChange={(v) => updateRow(i, { metaAdSpend: v })} />
                      </td>
                      <td className="py-2 pl-2 text-right">
                        <MiniNumber value={r.restocks} onChange={(v) => updateRow(i, { restocks: v })} />
                      </td>
                      <td className="py-2 pl-4 text-right text-xs text-zinc-500">{money(dayNet)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10 text-xs font-medium text-zinc-400">
                  <td className="py-2 pr-3 text-left">Totals</td>
                  <td className="px-2 py-2 text-right">{dtc.sum.paidOrders}</td>
                  <td className="px-2 py-2 text-right">{dtc.sum.paidCases}</td>
                  <td className="px-2 py-2 text-right">{dtc.sum.organicOrders}</td>
                  <td className="px-2 py-2 text-right">{dtc.sum.organicCases}</td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">—</td>
                  <td className="px-2 py-2 text-right">{money(dtc.sum.refunds)}</td>
                  <td className="px-2 py-2 text-right">{money(dtc.sum.metaAdSpend)}</td>
                  <td className="py-2 pl-2 text-right">{dtc.sum.restocks}</td>
                  <td className="py-2 pl-4 text-right">{money(dtc.sum.netRevenue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-600">
            CAC is accurate: Meta spend ÷ paid orders only. Organic orders don&apos;t distort it.
          </p>
        </section>

        <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <PanelTitle
              title="30-Day Extended — Weeks 2–4 (Optional)"
              sub="Enter weekly totals for days 8–30. Unlocks more accurate 12-mo projections."
            />
            <button
              onClick={() => setShow30d((v) => !v)}
              className="rounded-lg border border-white/10 px-3 py-1 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
            >
              {show30d ? "Hide" : "Show"}
            </button>
          </div>
          {show30d && (
            <div className="mt-4">
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  onClick={fillPriceShipDown30d}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300 transition-colors hover:border-blue-500/40 hover:text-blue-300"
                >
                  Fill Price/Ship Down (30d)
                </button>
                <button
                  onClick={zero30dWeeksKeepPriceShip}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300 transition-colors hover:border-amber-500/40 hover:text-amber-300"
                >
                  Zero 30d Weeks
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs text-zinc-500">
                      <th className="py-2 pr-3 text-left">Period</th>
                      <th className="px-2 py-2 text-right">Paid Orders</th>
                      <th className="px-2 py-2 text-right">Paid Cases</th>
                      <th className="px-2 py-2 text-right">Org Orders</th>
                      <th className="px-2 py-2 text-right">Org Cases</th>
                      <th className="px-2 py-2 text-right">Price/Case</th>
                      <th className="px-2 py-2 text-right">Ship Charged/Case</th>
                      <th className="px-2 py-2 text-right">Refunds</th>
                      <th className="px-2 py-2 text-right">Meta Spend</th>
                      <th className="py-2 pl-4 text-right">Week Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeks2to4.map((w, i) => {
                      const totalCases = (w.paidCases || 0) + (w.organicCases || 0);
                      const weekNet = totalCases * (w.pricePerCase + w.shipChargedPerCase) - w.refunds;
                      return (
                        <tr key={w.label} className="border-b border-white/5 transition-colors hover:bg-white/5">
                          <td className="py-2 pr-3 text-left text-xs text-zinc-300">{w.label}</td>
                          <td className="px-2 py-2 text-right">
                            <MiniNumber value={w.paidOrders} onChange={(v) => updateWeek(i, { paidOrders: v })} />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <MiniNumber value={w.paidCases} onChange={(v) => updateWeek(i, { paidCases: v })} />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <MiniNumber value={w.organicOrders} onChange={(v) => updateWeek(i, { organicOrders: v })} />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <MiniNumber value={w.organicCases} onChange={(v) => updateWeek(i, { organicCases: v })} />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <MiniNumber value={w.pricePerCase} step="0.01" onChange={(v) => updateWeek(i, { pricePerCase: v })} />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <MiniNumber
                              value={w.shipChargedPerCase}
                              step="0.01"
                              onChange={(v) => updateWeek(i, { shipChargedPerCase: v })}
                            />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <MiniNumber value={w.refunds} step="0.01" onChange={(v) => updateWeek(i, { refunds: v })} />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <MiniNumber value={w.metaAdSpend} step="0.01" onChange={(v) => updateWeek(i, { metaAdSpend: v })} />
                          </td>
                          <td className="py-2 pl-4 text-right text-xs text-zinc-500">{money(weekNet)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/10 text-xs font-medium text-zinc-400">
                      <td className="py-2 pr-3 text-left">30d Total</td>
                      <td className="px-2 py-2 text-right">{dtc30.sum.paidOrders}</td>
                      <td className="px-2 py-2 text-right">{dtc30.sum.paidCases}</td>
                      <td className="px-2 py-2 text-right">{dtc30.sum.organicOrders}</td>
                      <td className="px-2 py-2 text-right">{dtc30.sum.organicCases}</td>
                      <td className="px-2 py-2 text-right">—</td>
                      <td className="px-2 py-2 text-right">—</td>
                      <td className="px-2 py-2 text-right">{money(dtc30.sum.refunds)}</td>
                      <td className="px-2 py-2 text-right">{money(dtc30.sum.metaAdSpend)}</td>
                      <td className="py-2 pl-4 text-right">{money(dtc30.sum.netRevenue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {dtc30.has30dData && (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatBox label="30d Net Revenue" value={money(dtc30.sum.netRevenue)} />
                  <StatBox
                    label="30d Pre-Ad Contribution"
                    value={money(dtc30.sum.preAdContribution)}
                    valueClass={dtc30.sum.preAdContribution < 0 ? "text-rose-400" : "text-emerald-400"}
                  />
                  <StatBox
                    label="30d Post-Ad Contribution"
                    value={money(dtc30.sum.postAdContribution)}
                    valueClass={dtc30.sum.postAdContribution < 0 ? "text-rose-400" : "text-emerald-400"}
                  />
                  <StatBox
                    label="30d Pre-Ad Margin"
                    value={`${(dtc30.preAdMargin * 100).toFixed(1)}%`}
                    valueClass={
                      dtc30.preAdMargin < 0.15
                        ? "text-rose-400"
                        : dtc30.preAdMargin < 0.3
                          ? "text-amber-400"
                          : "text-emerald-400"
                    }
                  />
                </div>
              )}
            </div>
          )}
        </section>

        <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <PanelTitle
              title="Weekly Snapshot History"
              sub={`${snapshots.length} snapshot${snapshots.length === 1 ? "" : "s"} saved · click "Save Snapshot" above to add one.`}
            />
            <button
              onClick={() => setShowSnapshots((v) => !v)}
              className="rounded-lg border border-white/10 px-3 py-1 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
            >
              {showSnapshots ? "Hide" : "Show"}
            </button>
          </div>
          {showSnapshots && (
            <div className="mt-4 overflow-x-auto">
              {snapshots.length === 0 ? (
                <p className="py-4 text-center text-sm text-zinc-600">
                  No snapshots yet. Hit &quot;📸 Save Snapshot&quot; in the header to start tracking week-over-week.
                </p>
              ) : (
                <table className="w-full min-w-[800px] text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs text-zinc-500">
                      <th className="py-2 pr-3 text-left">Saved</th>
                      <th className="px-2 py-2 text-right">Net Revenue (7d)</th>
                      <th className="px-2 py-2 text-right">Pre-Ad Contribution</th>
                      <th className="px-2 py-2 text-right">Post-Ad Contribution</th>
                      <th className="px-2 py-2 text-right">Cases (7d)</th>
                      <th className="px-2 py-2 text-right">Pre-Ad Margin</th>
                      <th className="px-2 py-2 text-right">Paid CAC</th>
                      <th className="px-2 py-2 text-right">Inventory</th>
                      <th className="py-2 pl-2 text-right">Days Left</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((s, idx) => {
                      const prev = snapshots[idx + 1];
                      const revDelta = prev ? s.revenue7d - prev.revenue7d : null;
                      return (
                        <tr key={s.id} className="border-b border-white/5 transition-colors hover:bg-white/5">
                          <td className="py-2 pr-3 text-xs text-zinc-400">
                            {new Date(s.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            {revDelta !== null && (
                              <span className={`ml-2 ${revDelta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                {revDelta >= 0 ? "▲" : "▼"} {money(Math.abs(revDelta))}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right">{money(s.revenue7d)}</td>
                          <td className={`px-2 py-2 text-right ${s.preAdContrib7d < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                            {money(s.preAdContrib7d)}
                          </td>
                          <td className={`px-2 py-2 text-right ${s.postAdContrib7d < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                            {money(s.postAdContrib7d)}
                          </td>
                          <td className="px-2 py-2 text-right">{s.cases7d}</td>
                          <td
                            className={`px-2 py-2 text-right ${
                              s.preAdMargin7d < 0.15 ? "text-rose-400" : s.preAdMargin7d < 0.3 ? "text-amber-400" : "text-emerald-400"
                            }`}
                          >
                            {(s.preAdMargin7d * 100).toFixed(1)}%
                          </td>
                          <td className="px-2 py-2 text-right">{s.paidCac > 0 ? money(s.paidCac) : "—"}</td>
                          <td className="px-2 py-2 text-right">{s.inventoryNow.toLocaleString()}</td>
                          <td
                            className={`py-2 pl-2 text-right ${
                              s.daysLeft < 14 ? "text-rose-400" : s.daysLeft < 30 ? "text-amber-400" : "text-zinc-300"
                            }`}
                          >
                            {s.daysLeft >= 9999 ? "—" : Math.round(s.daysLeft)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>

        <footer className="mt-10 pb-4 text-xs text-zinc-700">
          Founder Command Center v2.0 · 7 features live · Data auto-saved to browser localStorage · Reset clears all.
        </footer>
      </div>
    </div>
  );
}