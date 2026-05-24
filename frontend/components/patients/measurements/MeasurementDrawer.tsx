"use client";

import { useState } from "react";
import { MeasurementDefinition, MeasurementRecord } from "@/services/measurementsService";
import { MeasurementChart } from "./MeasurementChart";
import { getMeasurementIcon } from "./MeasurementIcons";
import { cn } from "@/lib/utils";
import { X, TrendingDown, TrendingUp, Minus, Trash2, Save } from "lucide-react";

interface Props {
    definition: MeasurementDefinition;
    records: MeasurementRecord[];
    onClose: () => void;
    onAddRecord: (value: number, date: string) => Promise<void>;
    onDeleteRecord: (id: string) => Promise<void>;
}

export function MeasurementDrawer({ definition, records, onClose, onAddRecord, onDeleteRecord }: Props) {
    const today = new Date().toISOString().split("T")[0];
    const [date, setDate] = useState(today);
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);

    const Icon = getMeasurementIcon(definition.id);
    const last5 = records.slice(0, 5);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!value || isNaN(Number(value))) return;
        setLoading(true);
        try {
            await onAddRecord(Number(value), date);
            setValue("");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-60 bg-black/25 backdrop-blur-[2px] animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="fixed right-0 top-0 bottom-0 z-70 w-full max-w-115 bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 shrink-0">
                    <div className="h-10 w-10 rounded-xl bg-[#F0FDF4] text-[#1DBF73] flex items-center justify-center shrink-0">
                        <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="font-bold text-gray-900 text-base truncate">{definition.name}</h2>
                        <p className="text-xs text-[#1DBF73] font-semibold">{definition.unit}</p>
                    </div>
                    {records.length > 0 && (
                        <div className="text-right shrink-0 mr-2">
                            <p className="text-xl font-black text-gray-900 leading-none">
                                {records[0].value}
                                <span className="text-xs font-semibold text-gray-400 ml-1">{definition.unit}</span>
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">último valor</p>
                        </div>
                    )}
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto">

                    {/* Form section */}
                    <section className="px-6 pt-6 pb-5">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Nuevo registro</p>
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Fecha</label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        required
                                        className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1DBF73]/25 focus:border-[#1DBF73] transition-colors"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                                        Valor <span className="text-[#1DBF73]">({definition.unit})</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={value}
                                            onChange={(e) => setValue(e.target.value)}
                                            required
                                            placeholder="0.00"
                                            className="w-full h-10 border border-gray-200 rounded-xl px-3 pr-10 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1DBF73]/25 focus:border-[#1DBF73] transition-colors placeholder:font-normal placeholder:text-gray-400"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">
                                            {definition.unit}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-10 bg-[#1DBF73] hover:bg-[#15965A] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 shadow-sm shadow-[#1DBF73]/20"
                            >
                                <Save className="w-4 h-4" />
                                {loading ? "Guardando..." : "Guardar registro"}
                            </button>
                        </form>
                    </section>

                    <div className="h-px bg-gray-100 mx-6" />

                    {/* Chart section */}
                    <section className="px-6 py-5">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Progreso</p>
                        <MeasurementChart records={records} unit={definition.unit} heightClass="h-[190px]" />
                    </section>

                    <div className="h-px bg-gray-100 mx-6" />

                    {/* History section */}
                    <section className="px-6 py-5 pb-10">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Últimas medidas</p>
                        {last5.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-8">Aún no hay registros.</p>
                        ) : (
                            <div className="space-y-2">
                                {last5.map((record, index) => {
                                    const prevRecord = records[index + 1];
                                    let diff = 0, isUp = false, isDown = false;
                                    if (prevRecord) {
                                        diff = parseFloat((record.value - prevRecord.value).toFixed(2));
                                        isUp = diff > 0;
                                        isDown = diff < 0;
                                    }
                                    return (
                                        <div
                                            key={record.id}
                                            className="flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-gray-50 hover:bg-white hover:shadow-[0_1px_6px_rgba(0,0,0,0.06)] border border-transparent hover:border-gray-100 transition-all group"
                                        >
                                            <span className="text-sm text-gray-500">
                                                {new Date(record.date).toLocaleDateString("es-ES", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric",
                                                })}
                                            </span>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <span className="text-sm font-bold text-gray-900">{record.value}</span>
                                                    <span className="text-xs text-gray-400 ml-1">{definition.unit}</span>
                                                    {prevRecord && (
                                                        <div className={cn(
                                                            "text-[11px] font-semibold flex items-center justify-end gap-0.5 mt-0.5",
                                                            isUp ? "text-red-500" : isDown ? "text-green-600" : "text-gray-400"
                                                        )}>
                                                            {isUp
                                                                ? <TrendingUp className="w-3 h-3" />
                                                                : isDown
                                                                    ? <TrendingDown className="w-3 h-3" />
                                                                    : <Minus className="w-3 h-3" />}
                                                            {diff > 0 ? "+" : ""}{diff}
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        if (confirm("¿Eliminar este registro?")) onDeleteRecord(record.id);
                                                    }}
                                                    className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </>
    );
}
