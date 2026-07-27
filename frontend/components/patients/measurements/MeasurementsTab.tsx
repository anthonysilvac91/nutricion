"use client";

import { useState, useEffect } from "react";
import {
    MeasurementGroup,
    MeasurementSummaryDto,
    GROUP_LABELS,
    measurementsService,
} from "@/services/measurementsService";
import { useMockMode } from "@/lib/mock-mode-context";
import { formatClinicalDate } from "@/lib/clinicalDate";
import { MeasureSummaryCard } from "@/components/patients/measurements/MeasureSummaryCard";
import { MeasurementDrawer } from "@/components/patients/measurements/MeasurementDrawer";
import { MeasurementSettingsModal } from "@/components/patients/measurements/MeasurementSettingsModal";
import { MeasurementQuickAddModal } from "@/components/patients/measurements/MeasurementQuickAddModal";
import { Loader2, Settings2, Zap, CheckCircle, Plus, ClipboardList } from "lucide-react";
import { createPortal } from "react-dom";

interface Props {
    patientId: string;
}

export function MeasurementsTab({ patientId }: Props) {
    const { isMock } = useMockMode();
    const [summary, setSummary] = useState<MeasurementSummaryDto | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    // UI State
    const [activeGroup, setActiveGroup] = useState<MeasurementGroup>('BASIC');
    const [activeMeasurementId, setActiveMeasurementId] = useState<string | null>(null);

    // Modals state
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

    // Visibility configuration (Persisted simple array of IDs)
    const [visibleMeasurementIds, setVisibleMeasurementIds] = useState<string[]>([]);

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

    const loadSummary = async () => {
        setLoading(true);
        try {
            const data = isMock ? measurementsService.getMockSummary() : await measurementsService.getSummary(patientId);
            setSummary(data);

            if (visibleMeasurementIds.length === 0) {
                const stored = localStorage.getItem("visibleMeasurements");
                if (!stored) {
                    const defaultVisibles = data.definitions.filter(d => d.group === 'BASIC').map(d => d.id);
                    setVisibleMeasurementIds(defaultVisibles);
                }
            }
        } catch (error) {
            console.error("Failed to load measurement summary", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSummary();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientId, isMock]);

    const activeDraft = summary?.activeDraft ?? null;
    const hasActiveDraft = activeDraft != null;

    const ensureDraft = async (date?: string): Promise<string> => {
        if (activeDraft) return activeDraft.id;
        const created = await measurementsService.createOrGetDraft(patientId, date);
        return created.id;
    };

    const handleSaveDraftValue = async (definitionId: string, value: number, date: string) => {
        if (isMock) return;
        const draftId = await ensureDraft(date);
        await measurementsService.upsertMeasurements(patientId, draftId, [{ definitionId, numericValue: value }]);
        await loadSummary();
    };

    const handleDeleteDraftValue = async (definitionId: string) => {
        if (isMock || !activeDraft) return;
        await measurementsService.removeMeasurement(patientId, activeDraft.id, definitionId);
        await loadSummary();
    };

    const handleBatchSave = async (records: { measurementId: string, value: number }[], date: string) => {
        if (isMock) return;
        const draftId = await ensureDraft(date);
        await measurementsService.upsertMeasurements(patientId, draftId, records.map(r => ({ definitionId: r.measurementId, numericValue: r.value })));
        await loadSummary();
    };

    const handleCreateDraft = async () => {
        if (isMock) return;
        setBusy(true);
        try {
            await measurementsService.createOrGetDraft(patientId);
            await loadSummary();
        } finally {
            setBusy(false);
        }
    };

    const handleCompleteDraft = async () => {
        if (isMock || !activeDraft) return;
        setBusy(true);
        try {
            await measurementsService.completeAssessment(patientId, activeDraft.id);
            await loadSummary();
        } catch (e: any) {
            alert(e.message || "No se pudo completar la evaluación");
        } finally {
            setBusy(false);
        }
    };

    const loadHistory = (definitionId: string) => (page: number) =>
        isMock ? Promise.resolve(measurementsService.getMockHistory(definitionId)) : measurementsService.getHistory(patientId, definitionId, page);

    const handleSaveSettings = (newVisibleIds: string[]) => {
        setVisibleMeasurementIds(newVisibleIds);
        if (!isMock) localStorage.setItem("visibleMeasurements", JSON.stringify(newVisibleIds));
        setIsSettingsOpen(false);
    };

    if (loading || !summary) {
        return (
            <div className="flex items-center justify-center min-h-100">
                <Loader2 className="w-8 h-8 animate-spin text-[#1DBF73]" />
            </div>
        );
    }

    const groups: MeasurementGroup[] = ['BASIC', 'COMPOSITION', 'SKINFOLD', 'GIRTH'];
    const activeDefs = summary.definitions.filter(d => d.group === activeGroup);
    const cardsByDefinition = new Map(summary.cards.map(c => [c.definitionId, c]));

    const activeDef = summary.definitions.find(d => d.id === activeMeasurementId);
    const activeCard = activeMeasurementId ? cardsByDefinition.get(activeMeasurementId) : undefined;

    return (
        <div className="h-full flex flex-col relative">
            {/* Header Area -> Draft bar or "Nueva evaluación" + Groups Tabs & Actions */}
            <div className="flex-none mb-4 flex flex-col gap-3">
                {hasActiveDraft ? (
                    <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-100">
                        <div className="flex items-center gap-2 text-amber-800">
                            <ClipboardList className="w-4 h-4" />
                            <span className="text-xs font-bold">
                                Evaluación del {formatClinicalDate(activeDraft!.date)} · BORRADOR · {activeDraft!.measurementCount} medición{activeDraft!.measurementCount !== 1 ? "es" : ""} registrada{activeDraft!.measurementCount !== 1 ? "s" : ""}
                            </span>
                        </div>
                        <button
                            onClick={handleCompleteDraft}
                            disabled={busy}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1DBF73] hover:bg-[#15965A] text-white rounded-lg text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                        >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Completar evaluación
                        </button>
                    </div>
                ) : (
                    <div>
                        <button
                            onClick={handleCreateDraft}
                            disabled={busy}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-dashed border-gray-300 hover:border-[#1DBF73] hover:text-[#1DBF73] text-gray-500 rounded-lg text-xs font-semibold shadow-sm transition-all"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Nueva evaluación
                        </button>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
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
            </div>

            {/* Cards grid */}
            <div className="flex-1 min-h-0 overflow-y-auto pb-4 pr-1">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                    {activeDefs.filter(d => visibleMeasurementIds.includes(d.id)).map(def => {
                        const card = cardsByDefinition.get(def.id);
                        return (
                            <MeasureSummaryCard
                                key={def.id}
                                definition={def}
                                draft={card?.draft ?? null}
                                latestCompleted={card?.latestCompleted ?? null}
                                previousCompleted={card?.previousCompleted ?? null}
                                change={card?.change ?? null}
                                hasActiveDraft={hasActiveDraft}
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
                    key={activeMeasurementId}
                    definition={activeDef}
                    draft={activeCard?.draft ?? null}
                    hasActiveDraft={hasActiveDraft}
                    draftDate={activeDraft?.date ?? null}
                    onClose={() => setActiveMeasurementId(null)}
                    onSaveDraftValue={(value, date) => handleSaveDraftValue(activeMeasurementId, value, date)}
                    onDeleteDraftValue={() => handleDeleteDraftValue(activeMeasurementId)}
                    loadHistory={loadHistory(activeMeasurementId)}
                />,
                document.body
            )}

            {/* Global Modals rendered via Portal */}
            <MeasurementSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                definitions={summary.definitions}
                visibleIds={visibleMeasurementIds}
                onSave={handleSaveSettings}
            />

            <MeasurementQuickAddModal
                isOpen={isQuickAddOpen}
                onClose={() => setIsQuickAddOpen(false)}
                visibleDefinitions={summary.definitions.filter(d => visibleMeasurementIds.includes(d.id))}
                hasActiveDraft={hasActiveDraft}
                draftDate={activeDraft?.date ?? null}
                onSaveAll={handleBatchSave}
            />
        </div>
    );
}
