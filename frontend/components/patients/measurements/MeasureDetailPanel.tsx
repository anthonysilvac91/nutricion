"use client";

import { MeasurementDefinition, MeasurementRecord } from "@/services/measurementsService";
import { MeasurementChart } from "./MeasurementChart";
import { MeasurementHistory } from "./MeasurementHistory";
import { MeasurementQuickForm } from "./MeasurementQuickForm";
import { X, Activity, Maximize2, Minimize2 } from "lucide-react";

interface Props {
    definition: MeasurementDefinition;
    records: MeasurementRecord[]; // Sorted desc
    onClose: () => void;
    onAddRecord: (value: number, date: string) => Promise<void>;
    onDeleteRecord: (id: string) => Promise<void>;
    isExpanded: boolean;
    onToggleExpand: () => void;
}

export function MeasureDetailPanel({ definition, records, onClose, onAddRecord, onDeleteRecord, isExpanded, onToggleExpand }: Props) {
    return (
        <div className={`bg-white flex flex-col h-full w-full overflow-hidden rounded-2xl ${isExpanded ? 'border-none shadow-none' : 'border border-gray-100 shadow-xl animate-in slide-in-from-right-8 duration-300'}`}>
            {/* Header */}
            <div className={`px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 ${isExpanded ? 'md:px-8' : ''}`}>
                <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 text-[#1DBF73]">
                        <Activity className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-4">
                        <div>
                            <h3 className="font-bold text-gray-900 text-sm">{definition.name}</h3>
                            <p className="text-[11px] text-gray-500 font-medium">Unidad principal: {definition.unit}</p>
                        </div>
                        {isExpanded && records.length > 0 && (
                            <div className="hidden sm:block ml-4 text-2xl font-bold text-[#1DBF73]">
                                {records[0].value} <span className="text-sm font-semibold">{definition.unit}</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {/* Placeholder Exportar Button */}
                    {isExpanded && (
                        <button disabled className="mr-2 px-3 py-1.5 text-xs font-bold text-gray-400 bg-white border border-gray-200 rounded-md cursor-not-allowed opacity-60 flex items-center gap-1" title="Próximamente">
                            Exportar
                        </button>
                    )}
                    <button onClick={onToggleExpand} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors" title={isExpanded ? "Reducir" : "Expandir"}>
                        {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors" title="Cerrar">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content Scrollable */}
            <div className={`flex-1 overflow-y-auto ${isExpanded ? 'p-8 flex flex-col gap-8' : 'px-5 py-5 space-y-6'}`}>
                {!isExpanded ? (
                    <>
                        {/* Quick Add */}
                        <section>
                            <h4 className="text-xs font-bold text-gray-900 mb-2 tracking-tight uppercase">Nuevo Registro</h4>
                            <MeasurementQuickForm unit={definition.unit} onSubmit={onAddRecord} />
                        </section>

                        {/* Progress Chart */}
                        <section>
                            <h4 className="text-xs font-bold text-gray-900 mb-2 tracking-tight uppercase">Progreso</h4>
                            <MeasurementChart records={records} unit={definition.unit} />
                        </section>

                        {/* History */}
                        <section>
                            <h4 className="text-xs font-bold text-gray-900 mb-2 tracking-tight uppercase">Historial</h4>
                            <MeasurementHistory records={records} unit={definition.unit} onDelete={onDeleteRecord} />
                        </section>
                    </>
                ) : (
                    <>
                        {/* Expanded Progress Chart */}
                        <section className="w-full shrink-0">
                            <h4 className="text-xs font-bold text-gray-900 mb-2 tracking-tight uppercase">Progreso</h4>
                            <MeasurementChart records={records} unit={definition.unit} heightClass="h-[350px]" />
                        </section>

                        {/* Expanded Bottom Area (2 columns 65/35 ratio) */}
                        <div className="grid grid-cols-[1fr] md:grid-cols-[65%_1fr] md:gap-8 flex-1 min-h-[300px] gap-6">
                            {/* History */}
                            <section className="flex flex-col h-full bg-white border border-gray-100 p-5 rounded-2xl shadow-sm">
                                <h4 className="text-xs font-bold text-gray-900 mb-4 tracking-tight uppercase">Historial</h4>
                                <div className="flex-1 min-h-0 relative">
                                    <div className="absolute inset-0">
                                        <MeasurementHistory records={records} unit={definition.unit} onDelete={onDeleteRecord} maxHeightClass="h-full max-h-full" />
                                    </div>
                                </div>
                            </section>

                            {/* Quick Add */}
                            <section className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm flex flex-col justify-start">
                                <h4 className="text-xs font-bold text-gray-900 mb-4 tracking-tight uppercase">Nuevo Registro</h4>
                                <div>
                                    <MeasurementQuickForm unit={definition.unit} onSubmit={onAddRecord} isVertical={true} />
                                </div>
                            </section>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
