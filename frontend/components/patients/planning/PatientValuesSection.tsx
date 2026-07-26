"use client";

import { useState, useEffect } from "react";
import { Scale, Percent, BarChart2 } from "lucide-react";
import { Badge, StatusBadge, formatResultValue, StrategyResult } from "./ResultBadge";

export interface PatientValuesData {
    targetWeightKg?: number;
}

interface PlanningContext {
    weightKg: number | null;
    fatPercentMeasured: number | null;
    calculatedResults: { BMI?: StrategyResult; BODY_FAT_PERCENTAGE?: StrategyResult };
    availableFormulas?: { bmi?: { id: string; label: string; reference: { citation: string } }[] };
}

interface Props {
    context: PlanningContext;
    results?: Record<string, StrategyResult>;
    defaultData?: Partial<PatientValuesData>;
    onChange?: (data: PatientValuesData) => void;
    readOnly?: boolean;
}

function InputCell({ value, onChange, unit, wide = false, readOnly = false }: {
    value: string; onChange: (v: string) => void; unit: string; wide?: boolean; readOnly?: boolean;
}) {
    return (
        <div className="relative inline-flex items-center">
            <input
                type="number" step="0.1" value={value} readOnly={readOnly}
                onChange={e => onChange(e.target.value)}
                className={`${wide ? "w-32" : "w-24"} h-8 border border-gray-200 rounded-lg px-3 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1DBF73]/25 focus:border-[#1DBF73] transition-colors ${readOnly ? "bg-gray-50 cursor-default" : ""}`}
                style={{ paddingRight: `${unit.length * 7 + 12}px` }}
            />
            <span className="absolute right-2.5 text-xs text-gray-400 pointer-events-none">{unit}</span>
        </div>
    );
}

function classificationBadge(result?: StrategyResult) {
    if (!result || result.status !== "CALCULATED" || !result.statusCode) return null;
    const map: Record<string, { bg: string; color: string }> = {
        UNDERWEIGHT: { bg: "bg-blue-100", color: "text-blue-700" },
        NORMAL: { bg: "bg-green-100", color: "text-green-700" },
        OVERWEIGHT: { bg: "bg-orange-100", color: "text-orange-700" },
        OBESE: { bg: "bg-red-100", color: "text-red-700" },
    };
    const style = map[result.statusCode] ?? { bg: "bg-gray-100", color: "text-gray-600" };
    return <Badge label={result.statusLabel ?? result.statusCode} {...style} />;
}

export function PatientValuesSection({ context, results, defaultData, onChange, readOnly = false }: Props) {
    const [targetWeightKg, setTargetWeightKg] = useState(
        defaultData?.targetWeightKg != null ? String(defaultData.targetWeightKg) : ""
    );

    const bmiActual = context.calculatedResults?.BMI;
    const fatActual = context.calculatedResults?.BODY_FAT_PERCENTAGE;
    const bmiObjetivo = results?.BMI;

    const weightDiff = (() => {
        const target = parseFloat(targetWeightKg);
        if (isNaN(target) || context.weightKg == null) return null;
        return parseFloat((target - context.weightKg).toFixed(1));
    })();

    useEffect(() => {
        const parsed = parseFloat(targetWeightKg);
        onChange?.({ targetWeightKg: isNaN(parsed) ? undefined : parsed });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetWeightKg]);

    return (
        <div className="h-full bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_4px_rgba(0,0,0,0.05),0_2px_10px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
            <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-[#F0FDF4] text-[#1DBF73] flex items-center justify-center shrink-0">
                        <BarChart2 className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-gray-900 text-sm">Valores del paciente</h3>
                </div>
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
                                    <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-400 flex items-center justify-center shrink-0"><Scale className="w-3.5 h-3.5" /></div>
                                    <span className="text-xs font-semibold text-gray-800">Peso</span>
                                </div>
                            </td>
                            <td className="px-4 py-4 text-xs text-gray-400">—</td>
                            <td className="px-4 py-4">
                                <span className="text-xs font-semibold text-gray-800">{context.weightKg != null ? `${context.weightKg} kg` : "—"}</span>
                            </td>
                            <td className="px-4 py-4"><InputCell value={targetWeightKg} onChange={setTargetWeightKg} unit="kg" readOnly={readOnly} /></td>
                            <td className="pl-4 pr-6 py-4">
                                <div className="flex flex-col gap-1.5">
                                    {weightDiff !== null && weightDiff !== 0 ? (
                                        <Badge
                                            label={weightDiff < 0 ? `Reducción de ${Math.abs(weightDiff)} kg` : `Aumento de ${Math.abs(weightDiff)} kg`}
                                            bg={weightDiff < 0 ? "bg-purple-100" : "bg-orange-100"}
                                            color={weightDiff < 0 ? "text-purple-700" : "text-orange-700"}
                                        />
                                    ) : <span className="text-xs text-gray-400">—</span>}
                                </div>
                            </td>
                        </tr>
                        <tr className="hover:bg-gray-50/40 transition-colors">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-7 w-7 rounded-lg bg-cyan-50 text-cyan-500 flex items-center justify-center shrink-0"><Percent className="w-3.5 h-3.5" /></div>
                                    <span className="text-xs font-semibold text-gray-800 leading-snug">Porcentaje de<br />masa grasa</span>
                                </div>
                            </td>
                            <td className="px-4 py-4 text-xs text-gray-400">Medición directa</td>
                            <td className="px-4 py-4">
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-xs font-semibold text-gray-800">{formatResultValue(fatActual, "%")}</span>
                                    <StatusBadge result={fatActual} />
                                </div>
                            </td>
                            <td className="px-4 py-4 text-xs text-gray-400">—</td>
                            <td className="pl-4 pr-6 py-4 text-xs text-gray-400">—</td>
                        </tr>
                        <tr className="hover:bg-gray-50/40 transition-colors">
                            <td className="pl-6 pr-4 py-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-7 w-7 rounded-lg bg-orange-50 text-orange-400 flex items-center justify-center shrink-0"><BarChart2 className="w-3.5 h-3.5" /></div>
                                    <span className="text-xs font-semibold text-gray-800 leading-snug">Índice de masa<br />corporal</span>
                                </div>
                            </td>
                            <td className="px-4 py-4 text-xs text-gray-400">—</td>
                            <td className="px-4 py-4">
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-xs font-semibold text-gray-800">{formatResultValue(bmiActual, "kg/m²")}</span>
                                    {classificationBadge(bmiActual) ?? <StatusBadge result={bmiActual} />}
                                </div>
                            </td>
                            <td className="px-4 py-4">
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-xs font-semibold text-gray-800">{formatResultValue(bmiObjetivo, "kg/m²")}</span>
                                    {classificationBadge(bmiObjetivo) ?? <StatusBadge result={bmiObjetivo} />}
                                </div>
                            </td>
                            <td className="pl-4 pr-6 py-4">
                                <span className="text-[11px] text-gray-500 leading-snug">
                                    {context.availableFormulas?.bmi?.[0]?.reference?.citation ?? "—"}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
