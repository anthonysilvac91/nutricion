"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MeasurementDefinition, MeasurementGroup, GROUP_LABELS } from "@/services/measurementsService";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    visibleDefinitions: MeasurementDefinition[];
    onSaveAll: (records: { measurementId: string, value: number }[], date: string) => Promise<void>;
}

export function MeasurementQuickAddModal({ isOpen, onClose, visibleDefinitions, onSaveAll }: Props) {
    const today = new Date().toISOString().split('T')[0];
    const [date, setDate] = useState(today);

    // Contiene los valores numéricos ingresados { "m_weight": "80.5", ... }
    const [values, setValues] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen || typeof document === "undefined") return null;

    const handleValueChange = (id: string, val: string) => {
        setValues(prev => ({
            ...prev,
            [id]: val
        }));
    };

    const handleClear = () => {
        if (confirm("¿Estás seguro de que quieres limpiar todos los campos ingresados?")) {
            setValues({});
            setDate(today);
        }
    };

    const handleSave = async () => {
        // Find only inputs that have a valid number
        const recordsToSave: { measurementId: string, value: number }[] = [];

        Object.keys(values).forEach(id => {
            const val = parseFloat(values[id]);
            if (!isNaN(val)) {
                recordsToSave.push({ measurementId: id, value: val });
            }
        });

        if (recordsToSave.length === 0) {
            alert("No has ingresado ningún valor válido para guardar.");
            return;
        }

        setIsSaving(true);
        try {
            await onSaveAll(recordsToSave, date);
            // Si es exitoso, limpiamos y cerramos
            setValues({});
            onClose();
        } catch (error) {
            console.error("Error guardando lote de mediciones: ", error);
            alert("Ocurrió un error al guardar los registros.");
        } finally {
            setIsSaving(false);
        }
    };

    const groups: MeasurementGroup[] = ['BASIC', 'COMPOSITION', 'SKINFOLD', 'GIRTH'];

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex justify-center items-center py-6 px-4 sm:px-6 animate-in fade-in duration-200">
            <div className="w-full max-w-4xl max-h-full bg-white shadow-2xl rounded-2xl flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-2xl shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Toma rápida de datos</h2>
                        <p className="text-sm text-gray-500 mt-1">Registra múltiples mediciones en un solo paso.</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-700 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Date Selection Box (Sticky/Fixed below header) */}
                <div className="px-6 py-4 border-b border-gray-100 bg-white shrink-0 shadow-sm z-10">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <label className="text-sm font-bold text-gray-900 min-w-fit">Fecha del registro:</label>
                        <Input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                            className="h-10 bg-gray-50 w-full sm:w-[200px] rounded-lg border-gray-200"
                        />
                    </div>
                </div>

                {/* Content (Scrollable Grid of Inputs) */}
                <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar bg-white">
                    {visibleDefinitions.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">
                            No hay mediciones visibles configuradas para mostrar.
                        </div>
                    ) : (
                        <div className="space-y-10 border-b border-transparent">
                            {groups.map(group => {
                                const groupDefs = visibleDefinitions.filter(d => d.group === group);
                                if (groupDefs.length === 0) return null;

                                return (
                                    <section key={group} className="space-y-5">
                                        <h3 className="font-bold text-gray-900 uppercase text-xs tracking-wider border-b border-gray-100 pb-2">{GROUP_LABELS[group]}</h3>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
                                            {groupDefs.map(def => (
                                                <div key={def.id} className="relative group">
                                                    <label className="text-xs text-gray-600 font-semibold mb-1.5 block group-hover:text-[#1DBF73] transition-colors">{def.name}</label>
                                                    <div className="relative">
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            value={values[def.id] || ""}
                                                            onChange={(e) => handleValueChange(def.id, e.target.value)}
                                                            placeholder="0.00"
                                                            className={`h-11 bg-gray-50 hover:bg-white focus:bg-white pr-12 w-full rounded-xl text-base font-medium transition-all ${values[def.id] ? 'border-[#1DBF73] ring-1 ring-[#1DBF73]/20' : 'border-gray-200'}`}
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium pointer-events-none select-none">{def.unit}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer (Actions) */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between rounded-b-2xl shrink-0">
                    <button
                        onClick={handleClear}
                        className="text-sm font-semibold text-gray-500 hover:text-red-600 transition-colors hidden sm:block"
                    >
                        Limpiar campos
                    </button>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none h-11 px-6 rounded-xl">
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-[#1DBF73] hover:bg-[#15965A] text-white flex-1 sm:flex-none h-11 px-8 rounded-xl font-bold shadow-sm flex items-center gap-2 border-0"
                        >
                            {isSaving ? "Guardando..." : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Guardar todo
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
