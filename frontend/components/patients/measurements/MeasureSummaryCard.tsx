"use client";

import { MeasurementDefinition, MeasurementValueDto, MeasurementChangeDto } from "@/services/measurementsService";
import { TrendingDown, TrendingUp, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClinicalDate as formatDate } from "@/lib/clinicalDate";
import { getMeasurementIcon } from "./MeasurementIcons";

interface Props {
    definition: MeasurementDefinition;
    draft: MeasurementValueDto | null;
    latestCompleted: MeasurementValueDto | null;
    previousCompleted: MeasurementValueDto | null;
    change: MeasurementChangeDto | null;
    hasActiveDraft: boolean;
    isActive: boolean;
    onClick: () => void;
}

/**
 * Solo representa dirección matemática (el backend nunca decide si subir o
 * bajar es clínicamente bueno o malo, así que el frontend tampoco lo pinta
 * como tal) -- mismo color neutral para UP y DOWN, solo cambia el ícono.
 */
function ChangeBadge({ change }: { change: MeasurementChangeDto }) {
    const isFlat = change.trend === "FLAT";
    return (
        <div className={cn(
            "inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md mt-1",
            isFlat ? "bg-gray-50 text-gray-400" : "bg-blue-50 text-blue-600"
        )}>
            {change.trend === "UP" ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : change.trend === "DOWN" ? <TrendingDown className="w-2.5 h-2.5 mr-0.5" /> : <Minus className="w-2.5 h-2.5 mr-0.5" />}
            {change.difference > 0 ? "+" : ""}{change.difference}
        </div>
    );
}

export function MeasureSummaryCard({ definition, draft, latestCompleted, change, hasActiveDraft, isActive, onClick }: Props) {
    const Icon = getMeasurementIcon(definition.id);

    return (
        <div
            onClick={onClick}
            className={cn(
                "relative bg-white rounded-2xl border p-4 cursor-pointer transition-all duration-200 flex flex-col gap-3",
                isActive
                    ? "border-[#1DBF73]/55 shadow-[0_0_0_3px_rgba(29,191,115,0.1),0_4px_14px_rgba(29,191,115,0.12)] scale-[1.01]"
                    : "border-gray-200/70 shadow-[0_1px_4px_rgba(0,0,0,0.05),0_2px_10px_rgba(0,0,0,0.04)] hover:border-[#1DBF73]/30 hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)]"
            )}
        >
            {/* Top row: icon + name/unit */}
            <div className="flex items-start gap-3">
                <div className={cn(
                    "h-9 w-9 shrink-0 rounded-xl flex items-center justify-center transition-colors",
                    isActive ? "bg-[#1DBF73]/15 text-[#1DBF73]" : "bg-[#F0FDF4] text-[#1DBF73]"
                )}>
                    <Icon size={18} />
                </div>
                <div>
                    <p className="font-bold text-gray-800 text-sm leading-snug">
                        {definition.name}
                    </p>
                    <p className="text-[#1DBF73] text-[11px] font-semibold mt-0.5">{definition.unit}</p>
                </div>
            </div>

            {/* Bottom: value(s) + "+" */}
            <div className="flex items-end justify-between">
                <div>
                    {hasActiveDraft && draft && (
                        <>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <div className="flex items-baseline gap-0.5">
                                    <span className="text-lg font-black tracking-tight text-gray-900 leading-none">{draft.value}</span>
                                    <span className="text-[10px] font-semibold text-gray-400 ml-0.5">{definition.unit}</span>
                                </div>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">BORRADOR</span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(draft.date)}</p>
                            {latestCompleted && (
                                <p className="text-[10px] text-gray-400 mt-1">Último completado: {latestCompleted.value} {definition.unit} · {formatDate(latestCompleted.date)}</p>
                            )}
                        </>
                    )}

                    {hasActiveDraft && !draft && (
                        <>
                            <span className="text-xs text-gray-400">Sin registrar en esta evaluación</span>
                            {latestCompleted && (
                                <p className="text-[10px] text-gray-400 mt-1">Último completado: {latestCompleted.value} {definition.unit} · {formatDate(latestCompleted.date)}</p>
                            )}
                        </>
                    )}

                    {!hasActiveDraft && latestCompleted && (
                        <>
                            <div className="flex items-baseline gap-0.5">
                                <span className="text-lg font-black tracking-tight text-gray-900 leading-none">{latestCompleted.value}</span>
                                <span className="text-[10px] font-semibold text-gray-400 ml-0.5">{definition.unit}</span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(latestCompleted.date)}</p>
                            {change && <ChangeBadge change={change} />}
                        </>
                    )}

                    {!hasActiveDraft && !latestCompleted && (
                        <span className="text-xs text-gray-400">Sin datos</span>
                    )}
                </div>

                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onClick(); }}
                    className="h-7 w-7 rounded-full bg-[#E6FFFA] text-[#1DBF73] flex items-center justify-center hover:bg-[#1DBF73] hover:text-white transition-colors shrink-0 border border-[#1DBF73]/20"
                >
                    <Plus className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}
