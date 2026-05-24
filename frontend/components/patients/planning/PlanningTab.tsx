"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Save, CheckCircle, RotateCcw, FileText, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { PatientValuesSection, PatientValuesData } from "./PatientValuesSection";
import { EnergySection, EnergyData } from "./EnergySection";
import { MacrosSection, MacrosData } from "./MacrosSection";
import { MicrosSection, MicrosData } from "./MicrosSection";

type PlanningSection = "patient_values" | "energy" | "macros" | "micros";

const SECTIONS: { key: PlanningSection; label: string }[] = [
    { key: "patient_values", label: "Valores paciente"   },
    { key: "energy",         label: "Cálculo energético" },
    { key: "macros",         label: "Macronutrientes"    },
    { key: "micros",         label: "Micronutrientes"    },
];

interface PlanMeta {
    id:          string;
    status:      "DRAFT" | "FINALIZED";
    date:        string;
    finalizedAt: string | null;
}

interface PlanData {
    patientValues?: PatientValuesData;
    energyCalc?:    EnergyData;
    macros?:        MacrosData;
    micros?:        MicrosData;
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

interface Props { patientId: string }

export function PlanningTab({ patientId }: Props) {
    const [activeSection, setActiveSection] = useState<PlanningSection>("patient_values");
    const [plans,         setPlans]         = useState<PlanMeta[]>([]);
    const [selectedId,    setSelectedId]    = useState<string | null>(null);
    const [planData,      setPlanData]      = useState<PlanData>({});
    const [loading,       setLoading]       = useState(true);
    const [saving,        setSaving]        = useState(false);
    const [selectorOpen,  setSelectorOpen]  = useState(false);
    const selectorRef = useRef<HTMLDivElement>(null);

    const pendingData = useRef<PlanData>({});

    const selectedPlan = plans.find(p => p.id === selectedId) ?? null;
    const isReadOnly   = selectedPlan?.status === "FINALIZED";
    const isDraft      = selectedPlan?.status === "DRAFT";

    // Load plan list
    const loadPlans = useCallback(async () => {
        try {
            const list: PlanMeta[] = await api.getPlans(patientId);
            setPlans(list);
            // Auto-select: prefer DRAFT, then latest FINALIZED
            const draft = list.find(p => p.status === "DRAFT");
            const first = draft ?? list[0] ?? null;
            if (first && !selectedId) setSelectedId(first.id);
        } catch {
            // no plans yet
        } finally {
            setLoading(false);
        }
    }, [patientId]);

    useEffect(() => { loadPlans(); }, [loadPlans]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
                setSelectorOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Load full plan data when selection changes
    useEffect(() => {
        if (!selectedId) { setPlanData({}); return; }
        api.getPlan(patientId, selectedId).then((p: any) => {
            setPlanData({
                patientValues: p.patientValues ?? undefined,
                energyCalc:    p.energyCalc    ?? undefined,
                macros:        p.macros        ?? undefined,
                micros:        p.micros        ?? undefined,
            });
            pendingData.current = {};
        }).catch(() => setPlanData({}));
    }, [selectedId, patientId]);

    const handleSectionChange = useCallback((section: keyof PlanData, data: any) => {
        pendingData.current = { ...pendingData.current, [section]: data };
    }, []);

    // Create new draft
    const handleNewPlan = async () => {
        setSaving(true);
        try {
            const plan = await api.createOrGetDraft(patientId);
            await loadPlans();
            setSelectedId(plan.id);
        } finally {
            setSaving(false);
        }
    };

    // Save draft
    const handleSave = async () => {
        if (!selectedId) return;
        setSaving(true);
        try {
            await api.savePlan(patientId, selectedId, {
                patientValues: pendingData.current.patientValues,
                energyCalc:    pendingData.current.energyCalc,
                macros:        pendingData.current.macros,
                micros:        pendingData.current.micros,
            });
            pendingData.current = {};
        } finally {
            setSaving(false);
        }
    };

    // Finalize
    const handleFinalize = async () => {
        if (!selectedId) return;
        setSaving(true);
        try {
            await handleSave();
            await api.finalizePlan(patientId, selectedId);
            await loadPlans();
        } finally {
            setSaving(false);
        }
    };

    // Reopen
    const handleReopen = async () => {
        if (!selectedId) return;
        setSaving(true);
        try {
            await api.reopenPlan(patientId, selectedId);
            await loadPlans();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-6 text-xs text-gray-400">Cargando planificaciones...</div>;

    return (
        <div className="h-full flex flex-col">

            {/* Nueva planificación — solo si no hay borrador activo */}
            {!selectedId && !plans.some(p => p.status === "DRAFT") && (
                <div className="flex-none mb-3">
                    <button type="button" onClick={handleNewPlan} disabled={saving}
                        className="flex items-center gap-1.5 h-8 px-3 bg-white border border-dashed border-gray-300 rounded-lg text-xs font-semibold text-gray-500 hover:border-[#1DBF73] hover:text-[#1DBF73] transition-colors">
                        <Plus className="h-3.5 w-3.5" /> Nueva planificación
                    </button>
                </div>
            )}

            {/* No plan state */}
            {!selectedId && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
                    <FileText className="h-10 w-10 opacity-20" />
                    <p className="text-sm font-medium">No hay planificaciones para este paciente</p>
                    <button type="button" onClick={handleNewPlan} disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[#1DBF73] text-white rounded-lg text-xs font-bold shadow-sm hover:bg-[#18a863] transition-colors">
                        <Plus className="h-3.5 w-3.5" /> Crear primera planificación
                    </button>
                </div>
            )}

            {/* Sub-menu pills + action buttons en la misma fila */}
            {selectedId && (
                <>
                    <div className="flex-none mb-3 flex items-center justify-between gap-3">
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide shrink min-w-0">
                            {SECTIONS.map(({ key, label }) => (
                                <button key={key} onClick={() => setActiveSection(key)}
                                    className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${activeSection === key ? "bg-[#1DBF73] text-white shadow-md shadow-green-100" : "bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent hover:border-gray-200"}`}>
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Botones de acción + selector */}
                        <div className="flex items-center gap-2 shrink-0">
                            {isDraft && (
                                <>
                                    <button type="button" onClick={handleSave} disabled={saving}
                                        className="flex items-center gap-1.5 h-8 px-3 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-600 hover:border-gray-300 shadow-sm transition-colors disabled:opacity-50">
                                        <Save className="h-3.5 w-3.5" />
                                        {saving ? "Guardando..." : "Guardar borrador"}
                                    </button>
                                    <button type="button" onClick={handleFinalize} disabled={saving}
                                        className="flex items-center gap-1.5 h-8 px-4 bg-[#1DBF73] text-white rounded-full text-xs font-bold shadow-sm hover:bg-[#18a863] transition-colors disabled:opacity-50">
                                        <CheckCircle className="h-3.5 w-3.5" />
                                        Finalizar
                                    </button>
                                </>
                            )}
                            {isReadOnly && (
                                <button type="button" onClick={handleReopen} disabled={saving}
                                    className="flex items-center gap-1.5 h-8 px-3 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-600 hover:border-amber-400 hover:text-amber-600 shadow-sm transition-colors disabled:opacity-50">
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Editar
                                </button>
                            )}

                            {/* Selector de planificaciones */}
                            {plans.length > 0 && (
                                <div className="relative" ref={selectorRef}>
                                    <button type="button" onClick={() => setSelectorOpen(v => !v)}
                                        className="flex items-center gap-1.5 h-8 px-3 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-600 hover:border-gray-300 shadow-sm transition-colors">
                                        <FileText className="h-3.5 w-3.5 text-gray-400" />
                                        {selectedPlan?.status === "DRAFT"
                                            ? "Borrador"
                                            : selectedPlan ? formatDate(selectedPlan.finalizedAt ?? selectedPlan.date)
                                            : "Planificaciones"}
                                        <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${selectorOpen ? "rotate-180" : ""}`} />
                                    </button>
                                    {selectorOpen && (
                                        <div className="absolute right-0 top-full mt-1 z-20 w-60 bg-white border border-gray-100 rounded-xl shadow-lg py-1.5 text-xs">
                                            {plans.map(p => (
                                                <button key={p.id} type="button"
                                                    onClick={() => { setSelectedId(p.id); setSelectorOpen(false); }}
                                                    className={`w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors ${p.id === selectedId ? "text-[#1DBF73] font-bold" : "text-gray-700"}`}>
                                                    <span>{p.status === "DRAFT" ? "Borrador" : `Plan ${formatDate(p.finalizedAt ?? p.date)}`}</span>
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${p.status === "DRAFT" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                                                        {p.status === "DRAFT" ? "BORRADOR" : "FINALIZADO"}
                                                    </span>
                                                </button>
                                            ))}
                                            {!plans.some(p => p.status === "DRAFT") && (
                                                <button type="button" onClick={() => { handleNewPlan(); setSelectorOpen(false); }}
                                                    className="w-full flex items-center gap-1.5 px-3 py-2 text-[#1DBF73] hover:bg-green-50 transition-colors border-t border-gray-100 mt-1 pt-2">
                                                    <Plus className="h-3 w-3" /> Nueva planificación
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto">
                        {activeSection === "patient_values" && (
                            <PatientValuesSection
                                key={`pv-${selectedId}`}
                                defaultData={planData.patientValues}
                                onChange={d => handleSectionChange("patientValues", d)}
                                readOnly={isReadOnly}
                            />
                        )}
                        {activeSection === "energy" && (
                            <EnergySection
                                key={`en-${selectedId}`}
                                defaultData={planData.energyCalc}
                                onChange={d => handleSectionChange("energyCalc", d)}
                                readOnly={isReadOnly}
                            />
                        )}
                        {activeSection === "macros" && (
                            <MacrosSection
                                key={`ma-${selectedId}`}
                                defaultData={planData.macros}
                                onChange={d => handleSectionChange("macros", d)}
                                readOnly={isReadOnly}
                            />
                        )}
                        {activeSection === "micros" && (
                            <MicrosSection
                                key={`mi-${selectedId}`}
                                defaultData={planData.micros}
                                onChange={d => handleSectionChange("micros", d)}
                                readOnly={isReadOnly}
                            />
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
