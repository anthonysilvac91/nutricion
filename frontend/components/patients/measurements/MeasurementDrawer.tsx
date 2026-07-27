"use client";

import { useState, useEffect } from "react";
import { MeasurementDefinition, MeasurementValueDto, HistoryDto } from "@/services/measurementsService";
import { MeasurementChart } from "./MeasurementChart";
import { getMeasurementIcon } from "./MeasurementIcons";
import { X, Trash2, Save, Loader2 } from "lucide-react";
import { formatClinicalDate, todayClinicalDate } from "@/lib/clinicalDate";

interface Props {
    definition: MeasurementDefinition;
    draft: MeasurementValueDto | null;
    hasActiveDraft: boolean;
    draftDate: string | null;
    onClose: () => void;
    onSaveDraftValue: (value: number, date: string) => Promise<void>;
    onDeleteDraftValue: () => Promise<void>;
    loadHistory: (page: number) => Promise<HistoryDto>;
}

export function MeasurementDrawer({ definition, draft, hasActiveDraft, draftDate, onClose, onSaveDraftValue, onDeleteDraftValue, loadHistory }: Props) {
    const [date, setDate] = useState(hasActiveDraft && draftDate ? draftDate : todayClinicalDate());
    const [value, setValue] = useState(draft != null ? String(draft.value) : "");
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [history, setHistory] = useState<HistoryDto | null>(null);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [page, setPage] = useState(1);

    const Icon = getMeasurementIcon(definition.id);

    // La fecha siempre proviene del DRAFT activo (si existe) -- nunca la decide/edita el
    // frontend por su cuenta; se resincroniza si el borrador cambia mientras el drawer está abierto.
    useEffect(() => {
        setDate(hasActiveDraft && draftDate ? draftDate : todayClinicalDate());
    }, [hasActiveDraft, draftDate]);

    useEffect(() => {
        setHistoryLoading(true);
        loadHistory(1).then(h => { setHistory(h); setPage(1); }).finally(() => setHistoryLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [definition.id]);

    const handleLoadMore = async () => {
        const next = page + 1;
        setHistoryLoading(true);
        try {
            const h = await loadHistory(next);
            setHistory(prev => prev ? { ...h, data: [...prev.data, ...h.data] } : h);
            setPage(next);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!value || isNaN(Number(value))) return;
        setSaving(true);
        try {
            await onSaveDraftValue(Number(value), date);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("¿Eliminar este valor del borrador?")) return;
        setDeleting(true);
        try {
            await onDeleteDraftValue();
            setValue("");
        } finally {
            setDeleting(false);
        }
    };

    const chartPoints = (history?.data ?? [])
        .filter(d => typeof d.value === "number")
        .map(d => ({ date: d.date, value: d.value as number }));

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
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto">

                    {/* Draft form section */}
                    <section className="px-6 pt-6 pb-5">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
                            {hasActiveDraft ? "Valor en la evaluación en curso" : "Nueva evaluación"}
                        </p>
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Fecha</label>
                                    {hasActiveDraft ? (
                                        <div className="w-full h-10 border border-gray-100 bg-gray-50 rounded-xl px-3 flex items-center text-sm text-gray-500">
                                            {date}
                                        </div>
                                    ) : (
                                        <input
                                            type="date"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            required
                                            className="w-full h-10 border border-gray-200 rounded-xl px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1DBF73]/25 focus:border-[#1DBF73] transition-colors"
                                        />
                                    )}
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
                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 h-10 bg-[#1DBF73] hover:bg-[#15965A] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 shadow-sm shadow-[#1DBF73]/20"
                                >
                                    <Save className="w-4 h-4" />
                                    {saving ? "Guardando..." : "Guardar en el borrador"}
                                </button>
                                {draft != null && (
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        disabled={deleting}
                                        className="h-10 px-3 border border-gray-200 rounded-xl text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors disabled:opacity-60"
                                        title="Eliminar del borrador"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </form>
                    </section>

                    <div className="h-px bg-gray-100 mx-6" />

                    {/* Chart section */}
                    <section className="px-6 py-5">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Progreso (evaluaciones completadas)</p>
                        <MeasurementChart records={chartPoints} unit={definition.unit} heightClass="h-[190px]" />
                    </section>

                    <div className="h-px bg-gray-100 mx-6" />

                    {/* History section -- read-only, evaluaciones COMPLETED únicamente */}
                    <section className="px-6 py-5 pb-10">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Historial completado</p>
                        {historyLoading && !history ? (
                            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
                        ) : !history || history.data.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-8">Aún no hay evaluaciones completadas con este dato.</p>
                        ) : (
                            <div className="space-y-2">
                                {history.data.map((entry) => (
                                    <div
                                        key={entry.recordId}
                                        className="flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-gray-50 border border-transparent"
                                    >
                                        <span className="text-sm text-gray-500">
                                            {formatClinicalDate(entry.date, { day: "2-digit" })}
                                        </span>
                                        <span className="text-sm font-bold text-gray-900">
                                            {entry.value} <span className="text-xs text-gray-400 font-normal">{definition.unit}</span>
                                        </span>
                                    </div>
                                ))}
                                {history.meta.page < history.meta.totalPages && (
                                    <button
                                        type="button"
                                        onClick={handleLoadMore}
                                        disabled={historyLoading}
                                        className="w-full mt-2 text-xs font-semibold text-[#1DBF73] hover:text-[#15965A] py-2"
                                    >
                                        {historyLoading ? "Cargando..." : "Cargar más"}
                                    </button>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </>
    );
}
