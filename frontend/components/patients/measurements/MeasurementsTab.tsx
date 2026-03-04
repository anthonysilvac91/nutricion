"use client";

import { useState, useEffect } from "react";
import {
    MeasurementGroup,
    MeasurementDefinition,
    MeasurementRecord,
    measurementsService,
    GROUP_LABELS
} from "@/services/measurementsService";
import { MeasureSummaryCard } from "@/components/patients/measurements/MeasureSummaryCard";
import { MeasureDetailPanel } from "@/components/patients/measurements/MeasureDetailPanel";
import { MeasurementSettingsModal } from "@/components/patients/measurements/MeasurementSettingsModal";
import { MeasurementQuickAddModal } from "@/components/patients/measurements/MeasurementQuickAddModal";
import { Loader2, Settings2, Zap } from "lucide-react";
import { createPortal } from "react-dom";

interface Props {
    patientId: string;
}

export function MeasurementsTab({ patientId }: Props) {
    const [definitions, setDefinitions] = useState<MeasurementDefinition[]>([]);
    const [records, setRecords] = useState<MeasurementRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [activeGroup, setActiveGroup] = useState<MeasurementGroup>('BASIC');
    const [activeMeasurementId, setActiveMeasurementId] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false); // New explicit expand mode

    // Modals state
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

    // Visibility configuration (Persisted simple array of IDs)
    const [visibleMeasurementIds, setVisibleMeasurementIds] = useState<string[]>([]);

    // Attempt local storage load
    useEffect(() => {
        const stored = localStorage.getItem("visibleMeasurements");
        if (stored) {
            try {
                setVisibleMeasurementIds(JSON.parse(stored));
            } catch (e) {
                console.error("Error parsing visible measurements from localStorage", e);
            }
        }
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [defs, recs] = await Promise.all([
                measurementsService.getDefinitions(),
                measurementsService.getPatientRecords(patientId)
            ]);
            setDefinitions(defs);
            setRecords(recs);

            // Si es la primera vez que entramos y visibleMeasurementIds está vacío, mostrar las básicas por defecto
            if (visibleMeasurementIds.length === 0) {
                const stored = localStorage.getItem("visibleMeasurements");
                if (!stored) {
                    const defaultVisibles = defs.filter(d => d.group === 'BASIC').map(d => d.id);
                    setVisibleMeasurementIds(defaultVisibles);
                }
            }

        } catch (error) {
            console.error("Failed to load measurements data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [patientId]);

    const handleAddRecord = async (value: number, date: string) => {
        if (!activeMeasurementId) return;
        await measurementsService.addRecord(patientId, activeMeasurementId, value, date);
        const updatedRecs = await measurementsService.getPatientRecords(patientId);
        setRecords(updatedRecs);
    };

    const handleDeleteRecord = async (recordId: string) => {
        await measurementsService.deleteRecord(recordId);
        const updatedRecs = await measurementsService.getPatientRecords(patientId);
        setRecords(updatedRecs);
    };

    const handleBatchAddRecords = async (newRecords: { measurementId: string, value: number }[], date: string) => {
        await measurementsService.batchAddRecords(patientId, newRecords, date);
        const updatedRecs = await measurementsService.getPatientRecords(patientId);
        setRecords(updatedRecs);
    };

    const handleSaveSettings = (newVisibleIds: string[]) => {
        setVisibleMeasurementIds(newVisibleIds);
        localStorage.setItem("visibleMeasurements", JSON.stringify(newVisibleIds));
        setIsSettingsOpen(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#1DBF73]" />
            </div>
        );
    }

    const groups: MeasurementGroup[] = ['BASIC', 'COMPOSITION', 'SKINFOLD', 'GIRTH'];
    const activeDefs = definitions.filter(d => d.group === activeGroup);

    // Get active definition for the side panel
    const activeDef = definitions.find(d => d.id === activeMeasurementId);
    // Get records for the active definition
    const activeDefRecords = activeMeasurementId ? records.filter(r => r.measurementId === activeMeasurementId) : [];

    return (
        <div className="h-full flex flex-col relative">
            {/* Header Area -> Groups Tabs & Actions */}
            <div className="flex-none mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
                <div className="overflow-x-auto pb-1 scrollbar-hide flex-1">
                    <div className="flex gap-2">
                        {groups.map((group) => (
                            <button
                                key={group}
                                onClick={() => {
                                    setActiveGroup(group);
                                    setActiveMeasurementId(null);
                                    setIsExpanded(false); // Reset expanded state on group change
                                }}
                                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${activeGroup === group
                                    ? "bg-[#1DBF73] text-white shadow-md shadow-green-100"
                                    : "bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent hover:border-gray-200"
                                    }`}
                            >
                                {GROUP_LABELS[group]}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-xs font-semibold shadow-sm transition-all"
                    >
                        <Settings2 className="w-3.5 h-3.5" />
                        Configurar
                    </button>
                    <button
                        onClick={() => setIsQuickAddOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#1DBF73] hover:bg-[#15965A] text-white rounded-lg text-xs font-bold shadow-sm shadow-[#1DBF73]/20 transition-all border-0"
                    >
                        <Zap className="w-3.5 h-3.5 fill-white/80" />
                        Toma rápida
                    </button>
                </div>
            </div>

            {/* Layout Wrapper: Grid vs Panel */}
            <div className="flex-1 flex gap-4 min-h-0 relative">

                {/* Main Content (Left Grid) */}
                <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
                    <div className="flex-1 overflow-y-auto pr-2 pb-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                            {activeDefs.filter(d => visibleMeasurementIds.includes(d.id)).map(def => {
                                const defRecords = records.filter(r => r.measurementId === def.id);
                                const latestRecord = defRecords[0]; // records are sorted desc
                                const previousRecord = defRecords[1];

                                return (
                                    <MeasureSummaryCard
                                        key={def.id}
                                        definition={def}
                                        latestRecord={latestRecord}
                                        previousRecord={previousRecord}
                                        isActive={activeMeasurementId === def.id}
                                        onClick={() => {
                                            setActiveMeasurementId(def.id);
                                            // Optional: unfold panel immediately if not open
                                        }}
                                    />
                                );
                            })}

                            {activeDefs.filter(d => visibleMeasurementIds.includes(d.id)).length === 0 && (
                                <div className="col-span-full py-12 text-center text-gray-400">
                                    No hay mediciones visibles en esta categoría. Puedes activarlas en "Configurar".
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Detail Panel (Right) NORMAL MODE - xl only */}
                {!isExpanded && activeMeasurementId && activeDef && (
                    <div className="transition-all duration-300 static right-0 top-0 bottom-0 z-20 xl:block hidden w-[400px] shrink-0 animate-in slide-in-from-right-8">
                        <MeasureDetailPanel
                            definition={activeDef}
                            records={activeDefRecords}
                            onClose={() => {
                                setActiveMeasurementId(null);
                            }}
                            onAddRecord={handleAddRecord}
                            onDeleteRecord={handleDeleteRecord}
                            isExpanded={false}
                            onToggleExpand={() => setIsExpanded(true)}
                        />
                    </div>
                )}
            </div>

            {/* EXPANDED MODE OVERLAY (Desktop only) rendered via Portal to escape stacking context */}
            {isExpanded && activeMeasurementId && activeDef && typeof document !== "undefined" && createPortal(
                <div className="hidden xl:flex fixed inset-0 z-[9999] bg-black/20 backdrop-blur-sm justify-center items-center py-10 px-6 animate-in fade-in duration-200">
                    <div className="w-full max-w-5xl h-[85vh] max-h-[85vh] shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <MeasureDetailPanel
                            definition={activeDef}
                            records={activeDefRecords}
                            onClose={() => {
                                setActiveMeasurementId(null);
                                setIsExpanded(false);
                            }}
                            onAddRecord={handleAddRecord}
                            onDeleteRecord={handleDeleteRecord}
                            isExpanded={true}
                            onToggleExpand={() => setIsExpanded(false)}
                        />
                    </div>
                </div>,
                document.body
            )}
            {/* Mobile/Tablet Detail Overlay (Shows if screen is < xl) */}
            {activeMeasurementId && activeDef && (
                <div className="xl:hidden fixed inset-0 z-[100] bg-black/20 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
                    <div className="w-full max-w-md h-full bg-white shadow-2xl animate-in slide-in-from-right-8 duration-300">
                        <MeasureDetailPanel
                            definition={activeDef}
                            records={activeDefRecords}
                            onClose={() => {
                                setActiveMeasurementId(null);
                                setIsExpanded(false);
                            }}
                            onAddRecord={handleAddRecord}
                            onDeleteRecord={handleDeleteRecord}
                            isExpanded={false}
                            onToggleExpand={() => { }} // Disabled on mobile
                        />
                    </div>
                </div>
            )}

            {/* Global Modals rendered via Portal */}
            <MeasurementSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                definitions={definitions}
                visibleIds={visibleMeasurementIds}
                onSave={handleSaveSettings}
            />

            <MeasurementQuickAddModal
                isOpen={isQuickAddOpen}
                onClose={() => setIsQuickAddOpen(false)}
                visibleDefinitions={definitions.filter(d => visibleMeasurementIds.includes(d.id))}
                onSaveAll={handleBatchAddRecords}
            />
        </div>
    );
}
