"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, GripVertical, Edit2, Check } from "lucide-react";

export interface Meal {
    id: string;
    label: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    meals: Meal[];
    onSave: (meals: Meal[]) => void;
}

export function MealConfigModal({ isOpen, onClose, meals, onSave }: Props) {
    const [localMeals, setLocalMeals] = useState<Meal[]>(meals);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingLabel, setEditingLabel] = useState("");
    const editInputRef = useRef<HTMLInputElement>(null);

    // Sync when modal opens
    useEffect(() => {
        if (isOpen) {
            setLocalMeals(meals);
            setEditingId(null);
            setEditingLabel("");
        }
    }, [isOpen, meals]);

    useEffect(() => {
        if (editingId) editInputRef.current?.focus();
    }, [editingId]);

    if (!isOpen) return null;

    const addMeal = () => {
        const newMeal: Meal = { id: `meal-${Date.now()}`, label: "Nueva comida" };
        setLocalMeals(prev => [...prev, newMeal]);
        setEditingId(newMeal.id);
        setEditingLabel("Nueva comida");
    };

    const deleteMeal = (id: string) => {
        setLocalMeals(prev => prev.filter(m => m.id !== id));
        if (editingId === id) {
            setEditingId(null);
            setEditingLabel("");
        }
    };

    const startEdit = (meal: Meal) => {
        setEditingId(meal.id);
        setEditingLabel(meal.label);
    };

    const confirmEdit = () => {
        const trimmed = editingLabel.trim();
        if (!editingId || !trimmed) return;
        setLocalMeals(prev => prev.map(m => m.id === editingId ? { ...m, label: trimmed } : m));
        setEditingId(null);
        setEditingLabel("");
    };

    const handleSave = () => {
        // Confirm any pending edit before saving
        const trimmed = editingLabel.trim();
        const finalMeals = editingId && trimmed
            ? localMeals.map(m => m.id === editingId ? { ...m, label: trimmed } : m)
            : localMeals;
        onSave(finalMeals);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-base font-bold text-[#3E4C59]">Configurar comidas</h2>
                        <p className="text-xs text-gray-400 mt-0.5">Edita, agrega o elimina tiempos de comida</p>
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Meal list */}
                <div className="px-6 py-4 space-y-2 max-h-72 overflow-y-auto">
                    {localMeals.length === 0 && (
                        <p className="text-center text-xs text-gray-400 py-4">Sin tiempos de comida. Agrega uno abajo.</p>
                    )}
                    {localMeals.map((meal, index) => (
                        <div key={meal.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl group">
                            <GripVertical className="h-4 w-4 text-gray-300 flex-none cursor-grab" />
                            <span className="text-xs text-gray-400 w-5 flex-none font-mono text-center">{index + 1}</span>

                            {editingId === meal.id ? (
                                <input
                                    ref={editInputRef}
                                    value={editingLabel}
                                    onChange={e => setEditingLabel(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === "Enter") confirmEdit();
                                        if (e.key === "Escape") { setEditingId(null); setEditingLabel(""); }
                                    }}
                                    className="flex-1 text-sm font-medium text-[#3E4C59] bg-white border border-[#1DBF73] rounded-lg px-2 py-0.5 outline-none"
                                />
                            ) : (
                                <span className="flex-1 text-sm font-medium text-[#3E4C59]">{meal.label}</span>
                            )}

                            <div className="flex items-center gap-1">
                                {editingId === meal.id ? (
                                    <button
                                        onClick={confirmEdit}
                                        className="p-1 text-[#1DBF73] hover:text-green-700 transition-colors"
                                        title="Confirmar"
                                    >
                                        <Check className="h-4 w-4" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => startEdit(meal)}
                                        className="p-1 text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-all"
                                        title="Renombrar"
                                    >
                                        <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                )}
                                <button
                                    onClick={() => deleteMeal(meal.id)}
                                    disabled={localMeals.length <= 1}
                                    className="p-1 text-gray-300 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100 transition-all"
                                    title="Eliminar"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Add button */}
                <div className="px-6 pb-4">
                    <button
                        onClick={addMeal}
                        className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-xs font-medium text-gray-400 hover:border-[#1DBF73] hover:text-[#1DBF73] transition-all"
                    >
                        <Plus className="h-4 w-4" />
                        Agregar tiempo de comida
                    </button>
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 text-xs font-bold text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 py-2.5 text-xs font-bold text-white bg-[#1DBF73] rounded-xl hover:bg-[#19a863] transition-all cursor-pointer"
                    >
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
}
