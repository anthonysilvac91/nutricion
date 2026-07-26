"use client";

export interface StrategyResult {
    metricId: string;
    status: "CALCULATED" | "MISSING_DATA" | "NOT_APPLICABLE" | "PENDING_RULE";
    numericValue?: number;
    stringValue?: string;
    unit?: string;
    statusCode?: string;
    statusLabel?: string;
    metadataAsJson?: Record<string, any>;
    formulaUsed?: string;
    formulaVersion?: string;
    referenceTableId?: string;
    engineVersion?: string;
}

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
    MISSING_DATA: { label: "Dato faltante", bg: "bg-gray-100", color: "text-gray-500" },
    NOT_APPLICABLE: { label: "No aplicable", bg: "bg-gray-100", color: "text-gray-500" },
    PENDING_RULE: { label: "Pendiente de aprobación", bg: "bg-amber-100", color: "text-amber-700" },
};

export function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
    return <span className={`inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-full w-fit ${bg} ${color}`}>{label}</span>;
}

/** Renders MISSING_DATA/NOT_APPLICABLE/PENDING_RULE as a comprehensible pill; renders nothing for CALCULATED (the value itself is shown instead). */
export function StatusBadge({ result }: { result?: StrategyResult | null }) {
    if (!result || result.status === "CALCULATED") return null;
    const cfg = STATUS_LABELS[result.status] ?? { label: result.status, bg: "bg-gray-100", color: "text-gray-500" };
    return <Badge {...cfg} />;
}

/** Formats a numeric result for display, or "—" when it isn't CALCULATED. Never derives or guesses a value locally. */
export function formatResultValue(result?: StrategyResult | null, fallbackUnit?: string): string {
    if (!result || result.status !== "CALCULATED" || result.numericValue == null) return "—";
    const unit = result.unit ?? fallbackUnit ?? "";
    return unit ? `${result.numericValue} ${unit}` : `${result.numericValue}`;
}

export function isMissingRequired(result?: StrategyResult | null): boolean {
    return !result || result.status === "MISSING_DATA" || result.status === "NOT_APPLICABLE";
}
