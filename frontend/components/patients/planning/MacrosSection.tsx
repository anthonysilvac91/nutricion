"use client";

import { useState, useEffect } from "react";
import { Droplets, Wheat, Dumbbell } from "lucide-react";
export interface MacrosData {
    proteinPct: number;
    lipidPct: number;
    carbPct: number;
}

interface MacroResult {
    percentage: number | null;
    grams: number | null;
    gramsPerKg: number | null;
    status: "CALCULATED" | "MISSING_DATA" | "NOT_APPLICABLE" | "PENDING_RULE";
}

interface Props {
    results?: { protein?: MacroResult; lipids?: MacroResult; carbohydrates?: MacroResult };
    defaultData?: Partial<MacrosData>;
    onChange?: (data: MacrosData) => void;
    readOnly?: boolean;
}

function formatGrams(result?: MacroResult) {
    if (!result || result.status !== "CALCULATED" || result.grams == null) return "—";
    return `${result.grams} g`;
}

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
    MISSING_DATA: { label: "Dato faltante", bg: "bg-gray-100", color: "text-gray-500" },
    NOT_APPLICABLE: { label: "No aplicable", bg: "bg-gray-100", color: "text-gray-500" },
    PENDING_RULE: { label: "Pendiente de aprobación", bg: "bg-amber-100", color: "text-amber-700" },
};

function MacroStatusBadge({ result }: { result?: MacroResult }) {
    if (!result || result.status === "CALCULATED") return null;
    const cfg = STATUS_LABELS[result.status] ?? { label: result.status, bg: "bg-gray-100", color: "text-gray-500" };
    return <span className={`inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-full w-fit ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>;
}

interface SliderProps { value: number; onChange: (v: number) => void; disabled?: boolean; color: string; max: number }
function MacroSlider({ value, onChange, disabled = false, color, max }: SliderProps) {
    const fill = (value / max) * 100;
    return (
        <input type="range" min={0} max={max} value={value} disabled={disabled} onChange={e => onChange(Number(e.target.value))}
            style={{ background: `linear-gradient(to right, ${disabled ? "#d1d5db" : color} ${fill}%, #e5e7eb ${fill}%)` }}
            className={`w-40 h-1.5 rounded-full appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-300 [&::-webkit-slider-thumb]:shadow-sm ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
        />
    );
}

export function MacrosSection({ results, defaultData, onChange, readOnly = false }: Props) {
    // Los 3 sliders son independientes -- ninguno se auto-deriva de los otros. Si no suman 100%,
    // el backend lo refleja como el blocker INVALID_MACRO_TOTAL al intentar finalizar; el frontend
    // no valida ni completa el porcentaje faltante por su cuenta.
    const [lipidPct, setLipidPct] = useState(defaultData?.lipidPct ?? 0);
    const [proteinPct, setProteinPct] = useState(defaultData?.proteinPct ?? 0);
    const [carbPct, setCarbPct] = useState(defaultData?.carbPct ?? 0);

    useEffect(() => {
        onChange?.({ lipidPct, proteinPct, carbPct });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lipidPct, proteinPct, carbPct]);

    const rows = [
        { key: "lipid", pct: lipidPct, color: "#EAB308", icon: <Droplets className="w-3.5 h-3.5" />, iconBg: "bg-yellow-50 text-yellow-500", result: results?.lipids, onSlide: setLipidPct },
        { key: "carb", pct: carbPct, color: "#F97316", icon: <Wheat className="w-3.5 h-3.5" />, iconBg: "bg-orange-50 text-orange-400", result: results?.carbohydrates, onSlide: setCarbPct },
        { key: "protein", pct: proteinPct, color: "#3B82F6", icon: <Dumbbell className="w-3.5 h-3.5" />, iconBg: "bg-blue-50 text-blue-400", result: results?.protein, onSlide: setProteinPct },
    ];

    return (
        <div className="h-full bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_4px_rgba(0,0,0,0.05),0_2px_10px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
            <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center shrink-0"><Wheat className="w-4 h-4" /></div>
                <h3 className="font-bold text-gray-900 text-sm">Macronutrientes</h3>
            </div>
            <div className="flex-1">
                <table className="w-full h-full">
                    <thead>
                        <tr className="bg-purple-50/50 border-b border-gray-100">
                            {["Indicador", "Fórmula", "Porcentaje", "Cantidad total", "Cantidad en g/kg de peso", "Estado"].map(h => (
                                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider first:pl-6 last:pr-6">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 [&>tr:last-child>td]:pb-5">
                        {rows.map((row, i) => (
                            <tr key={row.key} className="hover:bg-gray-50/40 transition-colors">
                                <td className="pl-6 pr-4 py-4">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${row.iconBg}`}>{row.icon}</div>
                                        <span className="text-xs font-semibold text-gray-800">{["Lípidos", "Hidratos de carbono", "Proteínas"][i]}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-4"><span className="text-xs text-gray-400">Porcentaje del GET</span></td>
                                <td className="px-4 py-4">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold w-8 text-right text-gray-700">{row.pct} %</span>
                                        <MacroSlider value={row.pct} onChange={row.onSlide} disabled={readOnly} color={row.color} max={100} />
                                    </div>
                                </td>
                                <td className="px-4 py-4"><span className="text-xs font-semibold text-gray-800">{formatGrams(row.result)}</span></td>
                                <td className="px-4 py-4"><span className="text-xs font-semibold text-gray-800">{row.result?.gramsPerKg != null ? `${row.result.gramsPerKg} g/kg` : "—"}</span></td>
                                <td className="pl-4 pr-6 py-4"><MacroStatusBadge result={row.result} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
