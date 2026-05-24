"use client";

import { useState, useEffect } from "react";
import {
    MeasurementGroup,
    MeasurementDefinition,
    MeasurementRecord,
    measurementsService,
    GROUP_LABELS,
    mockDefinitions,
    generateAllMockRecords,
} from "@/services/measurementsService";
import { useMockMode } from "@/lib/mock-mode-context";
import { MeasureSummaryCard } from "@/components/patients/measurements/MeasureSummaryCard";
import { MeasurementDrawer } from "@/components/patients/measurements/MeasurementDrawer";
import { MeasurementSettingsModal } from "@/components/patients/measurements/MeasurementSettingsModal";
import { MeasurementQuickAddModal } from "@/components/patients/measurements/MeasurementQuickAddModal";
import { Loader2, Settings2, Zap } from "lucide-react";
import { createPortal } from "react-dom";

interface Props {
    patientId: string;
}

export function MeasurementsTab({ patientId }: Props) {
    const { isMock } = useMockMode();
    const [definitions, setDefinitions] = useState<MeasurementDefinition[]>([]);
    const [records, setRecords] = useState<MeasurementRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [activeGroup, setActiveGroup] = useState<MeasurementGroup>('BASIC');
    const [activeMeasurementId, setActiveMeasurementId] = useState<string | null>(null);

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
        if (isMock) {
            setDefinitions(mockDefinitions);
            setRecords(generateAllMockRecords("mock-patient"));
            setVisibleMeasurementIds(mockDefinitions.map(d => d.id));
            setLoading(false);
            return;
        }
        loadData();
    }, [patientId, isMock]);

    const handleAddRecord = async (value: number, date: string) => {
        if (isMock || !activeMeasurementId) return;
        await measurementsService.addRecord(patientId, activeMeasurementId, value, date);
        const updatedRecs = await measurementsService.getPatientRecords(patientId);
        setRecords(updatedRecs);
    };

    const handleDeleteRecord = async (recordId: string) => {
        if (isMock) return;
        await measurementsService.deleteRecord(recordId);
        const updatedRecs = await measurementsService.getPatientRecords(patientId);
        setRecords(updatedRecs);
    };

    const handleBatchAddRecords = async (newRecords: { measurementId: string, value: number }[], date: string) => {
        if (isMock) return;
        await measurementsService.batchAddRecords(patientId, newRecords, date);
        const updatedRecs = await measurementsService.getPatientRecords(patientId);
        setRecords(updatedRecs);
    };

    const handleSaveSettings = (newVisibleIds: string[]) => {
        setVisibleMeasurementIds(newVisibleIds);
        if (!isMock) localStorage.setItem("visibleMeasurements", JSON.stringify(newVisibleIds));
        setIsSettingsOpen(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-100">
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

            {/* Cards grid */}
            <div className="flex-1 min-h-0 overflow-y-auto pb-4 pr-1">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                    {activeDefs.filter(d => visibleMeasurementIds.includes(d.id)).map(def => {
                        const defRecords = records.filter(r => r.measurementId === def.id);
                        return (
                            <MeasureSummaryCard
                                key={def.id}
                                definition={def}
                                latestRecord={defRecords[0]}
                                previousRecord={defRecords[1]}
                                isActive={activeMeasurementId === def.id}
                                onClick={() => setActiveMeasurementId(def.id)}
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

            {/* Measurement Drawer */}
            {activeMeasurementId && activeDef && typeof document !== "undefined" && createPortal(
                <MeasurementDrawer
                    definition={activeDef}
                    records={activeDefRecords}
                    onClose={() => setActiveMeasurementId(null)}
                    onAddRecord={handleAddRecord}
                    onDeleteRecord={handleDeleteRecord}
                />,
                document.body
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
