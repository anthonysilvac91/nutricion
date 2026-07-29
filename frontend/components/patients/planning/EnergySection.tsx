"use client";

import { useState, useEffect } from "react";
import { Activity, Flame, Zap } from "lucide-react";
import { Badge, StatusBadge, formatResultValue, StrategyResult } from "./ResultBadge";

export interface EnergyData {
    bmrFormulaId?: string;
    pal?: number;
}

interface FormulaOption { id: string; label: string; outputUnit: string; reference: { citation: string } }
interface PalOption { value: string; label: string; pal: number }

interface PlanningContext {
    activityLevel: string;
    calculatedResults: { BMR?: StrategyResult; TDEE?: StrategyResult };
    availableFormulas?: { bmr?: FormulaOption[]; palOptions?: PalOption[] };
}

interface Props {
    context: PlanningContext;
    results?: Record<string, StrategyResult>;
    defaultData?: Partial<EnergyData>;
    onChange?: (data: EnergyData) => void;
    readOnly?: boolean;
}

const selectCls = "h-8 border border-gray-200 rounded-lg px-3 pr-8 text-xs font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1DBF73]/25 focus:border-[#1DBF73] transition-colors cursor-pointer disabled:bg-gray-50 disabled:cursor-default";

export function EnergySection({ context, results, defaultData, onChange, readOnly = false }: Props) {
    const bmrOptions = context.availableFormulas?.bmr ?? [];
    const palOptions = context.availableFormulas?.palOptions ?? [];

    const [bmrFormulaId, setBmrFormulaId] = useState(defaultData?.bmrFormulaId ?? bmrOptions[0]?.id ?? "");
    const [pal, setPal] = useState<number>(defaultData?.pal ?? palOptions[0]?.pal ?? 0);

    const actualPalOption = palOptions.find(p => p.value === context.activityLevel);
    const bmrActual = context.calculatedResults?.BMR;
    const tdeeActual = context.calculatedResults?.TDEE;
    const bmrObjetivo = results?.bmrKcal;
    const tdeeObjetivo = results?.tdeeKcal;

    useEffect(() => {
        onChange?.({ bmrFormulaId, pal });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bmrFormulaId, pal]);

    return (
        <div className="h-full bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_4px_rgba(0,0,0,0.05),0_2px_10px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
            <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[#F0FDF4] text-[#1DBF73] flex items-center justify-center shrink-0"><Flame className="w-4 h-4" /></div>
                <h3 className="font-bold text-gray-900 text-sm">Cálculo energético</h3>
            </div>
            <div className="flex-1">
                <table className="w-full h-full">
                    <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-100">
                            {["Indicador", "Fórmula", "Actual", "Objetivo", "Valor de referencia"].map(h => (
                                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider first:pl-6 last:pr-6">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 [&>tr:last-child>td]:pb-5">
                        <tr className="hover:bg-gray-50/40 transition-colors">
                            <td className="pl-6 pr-4 py-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-7 w-7 rounded-lg bg-green-50 text-green-500 flex items-center justify-center shrink-0"><Activity className="w-3.5 h-3.5" /></div>
                                    <span className="text-xs font-semibold text-gray-800 leading-snug">Nivel de actividad<br />física</span>
                                </div>
                            </td>
                            <td className="px-4 py-4 text-xs text-gray-400">—</td>
                            <td className="px-4 py-4">
                                {actualPalOption ? (
                                    <Badge label={`${actualPalOption.label} · PAL ${actualPalOption.pal.toFixed(3)}`} bg="bg-blue-50" color="text-blue-600" />
                                ) : <span className="text-xs text-gray-400">—</span>}
                            </td>
                            <td className="px-4 py-4">
                                <div className="flex items-center gap-2">
                                    <select value={pal} disabled={readOnly} onChange={e => setPal(Number(e.target.value))} className={selectCls}>
                                        {palOptions.map(o => <option key={o.value} value={o.pal}>{o.label}</option>)}
                                    </select>
                                    <Badge label={`PAL ${pal.toFixed(3)}`} bg="bg-blue-50" color="text-blue-600" />
                                </div>
                            </td>
                            <td className="pl-4 pr-6 py-4 text-xs text-gray-400">—</td>
                        </tr>
                        <tr className="hover:bg-gray-50/40 transition-colors">
                            <td className="pl-6 pr-4 py-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-7 w-7 rounded-lg bg-orange-50 text-orange-400 flex items-center justify-center shrink-0"><Flame className="w-3.5 h-3.5" /></div>
                                    <span className="text-xs font-semibold text-gray-800">Metabolismo basal</span>
                                </div>
                            </td>
                            <td className="px-4 py-4">
                                <select value={bmrFormulaId} disabled={readOnly} onChange={e => setBmrFormulaId(e.target.value)} className={selectCls}>
                                    {bmrOptions.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                </select>
                            </td>
                            <td className="px-4 py-4">
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-xs font-semibold text-gray-800">{formatResultValue(bmrActual)}</span>
                                    <StatusBadge result={bmrActual} />
                                </div>
                            </td>
                            <td className="px-4 py-4">
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-xs font-semibold text-gray-800">{formatResultValue(bmrObjetivo)}</span>
                                    <StatusBadge result={bmrObjetivo} />
                                </div>
                            </td>
                            <td className="pl-4 pr-6 py-4 text-xs text-gray-400">—</td>
                        </tr>
                        <tr className="hover:bg-gray-50/40 transition-colors">
                            <td className="pl-6 pr-4 py-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-7 w-7 rounded-lg bg-purple-50 text-purple-400 flex items-center justify-center shrink-0"><Zap className="w-3.5 h-3.5" /></div>
                                    <span className="text-xs font-semibold text-gray-800 leading-snug">Necesidades<br />energéticas diarias</span>
                                </div>
                            </td>
                            <td className="px-4 py-4"><span className="text-xs font-medium text-gray-500">BMR × PAL</span></td>
                            <td className="px-4 py-4">
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-xs font-semibold text-gray-800">{formatResultValue(tdeeActual)}</span>
                                    <StatusBadge result={tdeeActual} />
                                </div>
                            </td>
                            <td className="px-4 py-4">
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-xs font-semibold text-gray-800">{formatResultValue(tdeeObjetivo)}</span>
                                    <StatusBadge result={tdeeObjetivo} />
                                </div>
                            </td>
                            <td className="pl-4 pr-6 py-4 text-xs text-gray-400">—</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
