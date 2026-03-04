"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MeasurementDefinition, MeasurementGroup, GROUP_LABELS } from "@/services/measurementsService";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    definitions: MeasurementDefinition[];
    visibleIds: string[];
    onSave: (newVisibleIds: string[]) => void;
}

export function MeasurementSettingsModal({ isOpen, onClose, definitions, visibleIds, onSave }: Props) {
    // Local state for toggles before saving
    const [localVisibleIds, setLocalVisibleIds] = useState<Set<string>>(new Set(visibleIds));

    if (!isOpen || typeof document === "undefined") return null;

    const handleToggle = (id: string) => {
        const next = new Set(localVisibleIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setLocalVisibleIds(next);
    };

    const handleSelectAll = (groupDefs: MeasurementDefinition[]) => {
        const next = new Set(localVisibleIds);
        groupDefs.forEach(d => next.add(d.id));
        setLocalVisibleIds(next);
    };

    const handleDeselectAll = (groupDefs: MeasurementDefinition[]) => {
        const next = new Set(localVisibleIds);
        groupDefs.forEach(d => next.delete(d.id));
        setLocalVisibleIds(next);
    };

    const handleRestoreDefault = () => {
        // En este caso "por defecto" = todas visibles
        setLocalVisibleIds(new Set(definitions.map(d => d.id)));
    };

    const handleSave = () => {
        onSave(Array.from(localVisibleIds));
    };

    // Agrupamos definiciones
    const groups: MeasurementGroup[] = ['BASIC', 'COMPOSITION', 'SKINFOLD', 'GIRTH'];

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex justify-center items-center py-6 px-4 sm:px-6 animate-in fade-in duration-200">
            <div className="w-full max-w-3xl max-h-full bg-white shadow-2xl rounded-2xl flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-2xl shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Configurar mediciones</h2>
                        <p className="text-sm text-gray-500 mt-1">Selecciona qué tarjetas deseas visualizar en el panel principal.</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-700 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content (Scrollable list of toggles) */}
                <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar bg-white">
                    <div className="space-y-8">
                        {groups.map(group => {
                            const groupDefs = definitions.filter(d => d.group === group);
                            if (groupDefs.length === 0) return null;

                            const allSelected = groupDefs.every(d => localVisibleIds.has(d.id));

                            return (
                                <section key={group} className="space-y-4">
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                        <h3 className="font-bold text-gray-900 uppercase text-xs tracking-wider">{GROUP_LABELS[group]}</h3>
                                        <button
                                            onClick={() => allSelected ? handleDeselectAll(groupDefs) : handleSelectAll(groupDefs)}
                                            className="text-xs font-semibold text-[#1DBF73] hover:text-[#15965A] transition-colors"
                                        >
                                            {allSelected ? "Ocultar todas" : "Seleccionar todas"}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {groupDefs.map(def => {
                                            const isSelected = localVisibleIds.has(def.id);
                                            return (
                                                <label
                                                    key={def.id}
                                                    className={`
                                                        flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all
                                                        ${isSelected ? 'border-[#1DBF73] bg-[#f0fcf6]' : 'border-gray-200 bg-white hover:bg-gray-50'}
                                                    `}
                                                >
                                                    <span className={`text-sm font-medium ${isSelected ? 'text-[#15965A]' : 'text-gray-700'}`}>
                                                        {def.name} <span className="text-xs font-normal opacity-70 ml-1">({def.unit})</span>
                                                    </span>

                                                    {/* Custom Checkbox/Toggle visual */}
                                                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${isSelected ? 'bg-[#1DBF73] border-[#1DBF73]' : 'bg-white border-gray-300'}`}>
                                                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                                    </div>

                                                    {/* Hidden actual checkbox for accessibility */}
                                                    <input
                                                        type="checkbox"
                                                        className="hidden"
                                                        checked={isSelected}
                                                        onChange={() => handleToggle(def.id)}
                                                    />
                                                </label>
                                            );
                                        })}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                </div>

                {/* Footer (Actions) */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between rounded-b-2xl shrink-0">
                    <button
                        onClick={handleRestoreDefault}
                        className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors hidden sm:block"
                    >
                        Restaurar por defecto
                    </button>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} className="bg-[#1DBF73] hover:bg-[#15965A] text-white flex-1 sm:flex-none">
                            Guardar cambios
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
