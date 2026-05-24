"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
}

const FIELD_GROUPS = [
    { label: "Energía (kcal)",         key: "energy"  },
    { label: "Proteínas (g)",          key: "protein" },
    { label: "H. Carbono (g)",         key: "carbs"   },
    { label: "Lípidos (g)",            key: "fat"     },
    { label: "Fibra (g)",              key: "fiber"   },
    { label: "Azúcar (g)",             key: "sugar"   },
    { label: "Sodio (mg)",             key: "sodium"  },
] as const;

type NutrientKey = (typeof FIELD_GROUPS)[number]["key"];

interface FormState {
    name: string;
    category: string;
    energy: string;
    protein: string;
    carbs: string;
    fat: string;
    fiber: string;
    sugar: string;
    sodium: string;
}

const EMPTY: FormState = {
    name: "", category: "",
    energy: "", protein: "", carbs: "",
    fat: "", fiber: "", sugar: "", sodium: "",
};

export function CreateFoodModal({ isOpen, onClose, onCreated }: Props) {
    const [form,    setForm]    = useState<FormState>(EMPTY);
    const [saving,  setSaving]  = useState(false);
    const [error,   setError]   = useState<string | null>(null);

    if (!isOpen) return null;

    const handleClose = () => {
        setForm(EMPTY);
        setError(null);
        onClose();
    };

    const parseNum = (v: string) => {
        const n = parseFloat(v.replace(",", "."));
        return isNaN(n) ? undefined : n;
    };

    const handleSubmit = async () => {
        if (!form.name.trim()) { setError("El nombre es obligatorio."); return; }
        setSaving(true);
        setError(null);
        try {
            await api.createFood({
                name:     form.name.trim(),
                nameEs:   form.name.trim(),
                category: form.category.trim() || undefined,
                energy:   parseNum(form.energy),
                protein:  parseNum(form.protein),
                carbs:    parseNum(form.carbs),
                fat:      parseNum(form.fat),
                fiber:    parseNum(form.fiber),
                sugar:    parseNum(form.sugar),
                sodium:   parseNum(form.sodium),
            });
            onCreated();
            handleClose();
        } catch (e: any) {
            setError(e.message ?? "Error al guardar");
        } finally {
            setSaving(false);
        }
    };

    const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(prev => ({ ...prev, [key]: e.target.value }));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-base font-bold text-[#3E4C59]">Nuevo alimento personalizado</h2>
                        <p className="text-xs text-gray-400 mt-0.5">Valores por cada 100 g / 100 ml</p>
                    </div>
                    <button onClick={handleClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form */}
                <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                    {/* Nombre */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre <span className="text-red-400">*</span></label>
                        <input
                            value={form.name}
                            onChange={set("name")}
                            placeholder="ej: Arroz integral cocido"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#3E4C59] outline-none focus:border-[#1DBF73] transition-colors"
                        />
                    </div>

                    {/* Categoría */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Categoría</label>
                        <input
                            value={form.category}
                            onChange={set("category")}
                            placeholder="ej: Cereales y legumbres"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#3E4C59] outline-none focus:border-[#1DBF73] transition-colors"
                        />
                    </div>

                    {/* Nutrientes */}
                    <div className="grid grid-cols-2 gap-3">
                        {FIELD_GROUPS.map(({ label, key }) => (
                            <div key={key}>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                                <input
                                    type="number"
                                    min={0}
                                    step="0.1"
                                    value={form[key]}
                                    onChange={set(key)}
                                    placeholder="—"
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#3E4C59] outline-none focus:border-[#1DBF73] transition-colors"
                                />
                            </div>
                        ))}
                    </div>

                    {error && <p className="text-xs text-red-500">{error}</p>}
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
                    <button
                        onClick={handleClose}
                        className="flex-1 py-2.5 text-xs font-bold text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="flex-1 py-2.5 text-xs font-bold text-white bg-[#1DBF73] rounded-xl hover:bg-[#19a863] disabled:opacity-60 transition-all cursor-pointer"
                    >
                        {saving ? "Guardando…" : "Guardar"}
                    </button>
                </div>
            </div>
        </div>
    );
}
