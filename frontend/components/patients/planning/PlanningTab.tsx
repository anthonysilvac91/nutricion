"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Save, CheckCircle, RotateCcw, FileText, ChevronDown, ClipboardList } from "lucide-react";
import { api } from "@/lib/api";
import { formatClinicalDate } from "@/lib/clinicalDate";
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
    assessmentId: string;
}

interface CompletedAssessment {
    id: string;
    date: string;
    status: string;
    populationGroup: string | null;
}

interface PendingInputs {
    targetWeightKg?: number;
    bmrFormulaId?: string;
    pal?: number;
    proteinPct?: number;
    lipidPct?: number;
    carbPct?: number;
    fiberSourceId?: string;
    waterSourceId?: string;
}

// Para NutritionalPlan.date/finalizedAt (instantes reales, no fechas clínicas) -- la hora local
// del visor es lo correcto aquí, a diferencia de Assessment.date (ver formatClinicalDate).
function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

interface NewPlanPickerProps {
    patientId: string;
    variant: "ghost" | "solid";
    disabled?: boolean;
    onCreated: (planId: string) => void;
}

/** Self-contained: owns its own open/loading state so multiple instances (top-bar ghost button + empty-state CTA) never fight over shared state. */
function NewPlanPicker({ patientId, variant, disabled, onCreated }: NewPlanPickerProps) {
    const [open, setOpen] = useState(false);
    const [assessments, setAssessments] = useState<CompletedAssessment[] | null>(null);
    const [picking, setPicking] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    const toggle = async () => {
        setOpen(v => !v);
        if (assessments === null) {
            try {
                setAssessments(await api.getCompletedAssessments(patientId));
            } catch {
                setAssessments([]);
            }
        }
    };

    const pick = async (assessmentId: string) => {
        setPicking(true);
        setOpen(false);
        try {
            const created = await api.createOrGetDraft(patientId, assessmentId);
            onCreated(created.id);
        } finally {
            setPicking(false);
        }
    };

    return (
        <div className="relative" ref={ref}>
            <button type="button" onClick={toggle} disabled={disabled || picking}
                className={variant === "ghost"
                    ? "flex items-center gap-1.5 h-8 px-3 bg-white border border-dashed border-gray-300 rounded-lg text-xs font-semibold text-gray-500 hover:border-[#1DBF73] hover:text-[#1DBF73] transition-colors"
                    : "flex items-center gap-1.5 px-4 py-2 bg-[#1DBF73] text-white rounded-lg text-xs font-bold shadow-sm hover:bg-[#18a863] transition-colors"}>
                <Plus className="h-3.5 w-3.5" /> {variant === "ghost" ? "Nueva planificación" : "Crear primera planificación"}
            </button>
            {open && (
                <div className="absolute left-0 top-full mt-1 z-20 w-72 bg-white border border-gray-100 rounded-xl shadow-lg py-1.5 text-xs">
                    <p className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Elegir evaluación</p>
                    {assessments === null && <p className="px-3 py-2 text-gray-400">Cargando evaluaciones...</p>}
                    {assessments?.length === 0 && (
                        <p className="px-3 py-2 text-gray-500 leading-snug">No hay evaluaciones completadas para este paciente. Completa una evaluación en la pestaña Mediciones primero.</p>
                    )}
                    {assessments?.map(a => (
                        <button key={a.id} type="button" onClick={() => pick(a.id)}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors text-gray-700">
                            <span>Evaluación del {formatClinicalDate(a.date)}</span>
                            <span className="text-[9px] font-bold text-gray-400 uppercase">{a.populationGroup ?? "ADULT"}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function seedFromCalculationResults(results: Record<string, any> | undefined) {
    return {
        patientValues: { targetWeightKg: results?.TARGET_WEIGHT_KG?.numericValue } as Partial<PatientValuesData>,
        energy: { bmrFormulaId: results?.BMR?.formulaUsed, pal: results?.TDEE?.metadataAsJson?.palValue } as Partial<EnergyData>,
        macros: { proteinPct: results?.PROTEIN_G?.metadataAsJson?.percent, lipidPct: results?.FAT_G?.metadataAsJson?.percent } as Partial<MacrosData>,
        micros: { fiberSourceId: results?.FIBER_G?.formulaUsed, waterSourceId: results?.WATER_ML?.formulaUsed } as Partial<MicrosData>,
    };
}

interface Props { patientId: string }

export function PlanningTab({ patientId }: Props) {
    const [activeSection, setActiveSection] = useState<PlanningSection>("patient_values");
    const [plans,         setPlans]         = useState<PlanMeta[]>([]);
    const [selectedId,    setSelectedId]    = useState<string | null>(null);
    const [plan,          setPlan]          = useState<any>(null);
    const [context,       setContext]       = useState<any>(null);
    const [loading,       setLoading]       = useState(true);
    const [saving,        setSaving]        = useState(false);
    const [selectorOpen,  setSelectorOpen]  = useState(false);
    const selectorRef = useRef<HTMLDivElement>(null);

    const pendingInputs = useRef<PendingInputs>({});

    const selectedPlan = plans.find(p => p.id === selectedId) ?? null;
    const isReadOnly   = selectedPlan?.status === "FINALIZED";
    const isDraft      = selectedPlan?.status === "DRAFT";

    const seeds = seedFromCalculationResults(plan?.calculationResults);

    const loadPlans = useCallback(async () => {
        try {
            const list: PlanMeta[] = await api.getPlans(patientId);
            setPlans(list);
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
            if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) setSelectorOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Load the full plan + its planning context (Assessment-derived baseline + available formula catalogs)
    useEffect(() => {
        if (!selectedId) { setPlan(null); setContext(null); return; }
        let cancelled = false;
        (async () => {
            try {
                const p = await api.getPlan(patientId, selectedId);
                if (cancelled) return;
                setPlan(p);
                pendingInputs.current = {};
                const ctx = await api.getPlanningContext(patientId, p.assessmentId);
                if (cancelled) return;
                setContext(ctx);
            } catch {
                if (!cancelled) { setPlan(null); setContext(null); }
            }
        })();
        return () => { cancelled = true; };
    }, [selectedId, patientId]);

    const handleSectionChange = useCallback((slice: Partial<PendingInputs>) => {
        pendingInputs.current = { ...pendingInputs.current, ...slice };
    }, []);

    const handlePlanCreated = async (planId: string) => {
        await loadPlans();
        setSelectedId(planId);
    };

    const buildRecalculatePayload = () => {
        const pi = pendingInputs.current;
        const proteinPct = pi.proteinPct ?? seeds.macros.proteinPct ?? 15;
        const lipidPct = pi.lipidPct ?? seeds.macros.lipidPct ?? 28;
        return {
            bmrFormulaId: pi.bmrFormulaId ?? seeds.energy.bmrFormulaId ?? context.availableFormulas?.bmr?.[0]?.id ?? "",
            pal: pi.pal ?? seeds.energy.pal ?? context.availableFormulas?.palOptions?.[0]?.pal ?? 1.2,
            targetWeightKg: pi.targetWeightKg ?? seeds.patientValues.targetWeightKg,
            macroMethod: "PERCENT" as const,
            macroPercents: {
                PROTEIN: proteinPct,
                FAT: lipidPct,
                CARBS: 100 - proteinPct - lipidPct,
            },
            fiberSourceId: pi.fiberSourceId ?? seeds.micros.fiberSourceId ?? context.availableFormulas?.fiberSources?.[0]?.id ?? "",
            waterSourceId: pi.waterSourceId ?? seeds.micros.waterSourceId ?? context.availableFormulas?.waterSources?.[0]?.id ?? "",
        };
    };

    const handleSave = async () => {
        if (!selectedId) return;
        setSaving(true);
        try {
            const updated = await api.recalculatePlan(patientId, selectedId, buildRecalculatePayload());
            setPlan(updated);
        } finally {
            setSaving(false);
        }
    };

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

            {!selectedId && !plans.some(p => p.status === "DRAFT") && (
                <div className="flex-none mb-3">
                    <NewPlanPicker patientId={patientId} variant="ghost" disabled={saving} onCreated={handlePlanCreated} />
                </div>
            )}

            {!selectedId && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
                    <FileText className="h-10 w-10 opacity-20" />
                    <p className="text-sm font-medium">No hay planificaciones para este paciente</p>
                    <NewPlanPicker patientId={patientId} variant="solid" disabled={saving} onCreated={handlePlanCreated} />
                </div>
            )}

            {selectedId && (!plan || !context) && (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400">Cargando planificación...</div>
            )}

            {selectedId && plan && context && (
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
                                                <div className="border-t border-gray-100 mt-1 pt-2 px-1">
                                                    <NewPlanPicker patientId={patientId} variant="ghost" disabled={saving} onCreated={id => { setSelectorOpen(false); handlePlanCreated(id); }} />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {context.clinicalAlerts?.length > 0 && (
                        <div className="flex-none mb-3 flex flex-col gap-1.5">
                            {context.clinicalAlerts.map((alert: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium">
                                    <ClipboardList className="h-3.5 w-3.5 shrink-0" /> {alert.message}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex-1 min-h-0 overflow-y-auto">
                        {activeSection === "patient_values" && (
                            <PatientValuesSection
                                key={`pv-${selectedId}`}
                                context={context}
                                results={plan.calculationResults}
                                defaultData={seeds.patientValues}
                                onChange={d => handleSectionChange(d)}
                                readOnly={isReadOnly}
                            />
                        )}
                        {activeSection === "energy" && (
                            <EnergySection
                                key={`en-${selectedId}`}
                                context={context}
                                results={plan.calculationResults}
                                defaultData={seeds.energy}
                                onChange={d => handleSectionChange(d)}
                                readOnly={isReadOnly}
                            />
                        )}
                        {activeSection === "macros" && (
                            <MacrosSection
                                key={`ma-${selectedId}`}
                                results={plan.calculationResults}
                                defaultData={seeds.macros}
                                onChange={d => handleSectionChange(d)}
                                readOnly={isReadOnly}
                            />
                        )}
                        {activeSection === "micros" && (
                            <MicrosSection
                                key={`mi-${selectedId}`}
                                results={plan.calculationResults}
                                availableFormulas={context.availableFormulas}
                                defaultData={seeds.micros}
                                onChange={d => handleSectionChange(d)}
                                readOnly={isReadOnly}
                            />
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
