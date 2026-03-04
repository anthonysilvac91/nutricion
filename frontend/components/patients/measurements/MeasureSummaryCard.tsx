"use client";

import { MeasurementDefinition, MeasurementRecord } from "@/services/measurementsService";
import { TrendingDown, TrendingUp, Minus, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
    definition: MeasurementDefinition;
    latestRecord?: MeasurementRecord;
    previousRecord?: MeasurementRecord;
    isActive: boolean;
    onClick: () => void;
}

export function MeasureSummaryCard({ definition, latestRecord, previousRecord, isActive, onClick }: Props) {

    let diff = 0;
    let isUp = false;
    let isDown = false;

    if (latestRecord && previousRecord) {
        diff = parseFloat((latestRecord.value - previousRecord.value).toFixed(2));
        isUp = diff > 0;
        isDown = diff < 0;
    }

    return (
        <div
            onClick={onClick}
            className={cn(
                "relative bg-white p-3.5 rounded-xl cursor-pointer transition-all duration-200 border-2 flex flex-col justify-between h-[100px]",
                isActive ? "border-[#1DBF73] shadow-md shadow-green-100/30 scale-[1.02] z-10 block" : "border-gray-100 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] hover:border-[#1DBF73]/50 hover:shadow-md"
            )}
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                    <div className={cn("p-1.5 rounded-md", isActive ? "bg-[#1DBF73]/10 text-[#1DBF73]" : "bg-gray-100 text-gray-500")}>
                        <Activity className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-bold text-gray-700 text-xs tracking-tight truncate max-w-[120px]" title={definition.name}>{definition.name}</span>
                </div>
            </div>

            <div className="flex items-end justify-between">
                <div>
                    {latestRecord ? (
                        <div className="flex items-baseline gap-0.5">
                            <span className="text-xl font-black tracking-tight text-gray-900 leading-none">{latestRecord.value}</span>
                            <span className="text-[10px] font-bold text-gray-400">{definition.unit}</span>
                        </div>
                    ) : (
                        <span className="text-[11px] font-medium text-gray-400">Sin datos</span>
                    )}
                </div>

                {latestRecord && previousRecord && (
                    <div className={cn(
                        "flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                        isUp ? "bg-red-50 text-red-600" : isDown ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-500"
                    )}>
                        {isUp ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : isDown ? <TrendingDown className="w-2.5 h-2.5 mr-0.5" /> : <Minus className="w-2.5 h-2.5 mr-0.5" />}
                        {diff > 0 ? '+' : ''}{diff}
                    </div>
                )}
            </div>
        </div>
    );
}
