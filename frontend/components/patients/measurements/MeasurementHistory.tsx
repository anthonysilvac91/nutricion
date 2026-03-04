"use client";

import { MeasurementRecord } from "@/services/measurementsService";
import { Trash2, TrendingDown, TrendingUp, Minus } from "lucide-react";

interface Props {
    records: MeasurementRecord[];
    unit: string;
    onDelete: (id: string) => void;
    maxHeightClass?: string;
}

export function MeasurementHistory({ records, unit, onDelete, maxHeightClass = "max-h-[300px]" }: Props) {
    if (records.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500 text-sm">
                Aún no hay registros en el historial.
            </div>
        );
    }

    // records are expected to be sorted desc (newest first)
    return (
        <div className={`mt-4 space-y-2 ${maxHeightClass} overflow-y-auto pr-2 custom-scrollbar`}>
            {records.map((record, index) => {
                const previousRecord = records[index + 1];
                let diff = 0;
                let isUp = false;
                let isDown = false;

                if (previousRecord) {
                    diff = parseFloat((record.value - previousRecord.value).toFixed(2));
                    isUp = diff > 0;
                    isDown = diff < 0;
                }

                return (
                    <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 transition-all">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">{new Date(record.date).toLocaleDateString()}</span>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end">
                                <span className="font-bold text-gray-900">{record.value} <span className="text-xs font-normal text-gray-500">{unit}</span></span>
                                {previousRecord && (
                                    <div className={`flex items-center text-[11px] font-medium ${isUp ? 'text-red-500' : isDown ? 'text-green-500' : 'text-gray-400'}`}>
                                        {isUp ? <TrendingUp className="w-3 h-3 mr-0.5" /> : isDown ? <TrendingDown className="w-3 h-3 mr-0.5" /> : <Minus className="w-3 h-3 mr-0.5" />}
                                        {diff > 0 ? '+' : ''}{diff}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => {
                                    if (confirm("¿Eliminar registro?")) onDelete(record.id);
                                }}
                                className="p-1.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 hover:bg-red-50 rounded-md"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )
            })}
        </div>
    );
}
