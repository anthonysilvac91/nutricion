"use client";

import { useState, useEffect, useRef } from "react";
import {
    Download, MoreHorizontal, ChevronUp, GripVertical,
    AlignJustify, Trash2, Plus, Zap, Droplets, Circle, Diamond, Leaf,
} from "lucide-react";
import { AddFoodModal } from "./AddFoodModal";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MealFoodEntry {
    entryId:    string;
    foodId:     string;
    foodName:   string;
    sourceCode: string;
    quantity:   number;
    unit:       string;
    grams:      number;
    energy:     number | null;
    fat:        number | null;
    carbs:      number | null;
    protein:    number | null;
    fiber:      number | null;
}

interface Props {
    patientId:          string;
    mealId:             string;
    mealLabel:          string;
    mealTime:           string;
    onTimeChange:       (time: string) => void;
    externalAddOpen?:   boolean;
    onExternalAddClose?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sumField = (entries: MealFoodEntry[], key: keyof MealFoodEntry): number =>
    entries.reduce((acc, e) => {
        const v = e[key];
        return acc + (typeof v === "number" ? v : 0);
    }, 0);

const roundN = (n: number) => Math.round(n * 10) / 10;

const formatEntry = (e: MealFoodEntry): string => {
    if (e.unit === "gramos") return `${e.grams} gramos de ${e.foodName}`;
    return `${e.quantity} ${e.unit} de ${e.foodName} (${e.grams} g)`;
};

// ─── Nutrient summary items ───────────────────────────────────────────────────

const NUTRIENTS = [
    { key: "energy"  as const, label: "Energía",          unit: "kcal", Icon: Zap,      color: "text-purple-500", iconBg: "bg-purple-100" },
    { key: "fat"     as const, label: "Grasa",             unit: "g",    Icon: Droplets, color: "text-amber-500",  iconBg: "bg-amber-100"  },
    { key: "carbs"   as const, label: "H. Carbono",        unit: "g",    Icon: Circle,   color: "text-orange-400", iconBg: "bg-orange-100" },
    { key: "protein" as const, label: "Proteína",          unit: "g",    Icon: Diamond,  color: "text-blue-400",   iconBg: "bg-blue-100"   },
    { key: "fiber"   as const, label: "Fibra alimentaria", unit: "g",    Icon: Leaf,     color: "text-green-500",  iconBg: "bg-green-100"  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function MealContent({ patientId, mealId, mealLabel, mealTime, onTimeChange, externalAddOpen, onExternalAddClose }: Props) {
    const entriesKey = `meal-foods-${patientId}-${mealId}`;
    const notesKey   = `meal-notes-${patientId}-${mealId}`;

    const [entries,     setEntries]     = useState<MealFoodEntry[]>([]);
    const [notes,       setNotes]       = useState("");
    const [addingFood,  setAddingFood]  = useState(false);
    const [editingTime, setEditingTime] = useState(false);
    const [timeValue,   setTimeValue]   = useState(mealTime);
    const timeRef = useRef<HTMLInputElement>(null);

    // Persist & load from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(entriesKey);
            if (saved) setEntries(JSON.parse(saved));
            const savedNotes = localStorage.getItem(notesKey);
            if (savedNotes) setNotes(savedNotes);
        } catch { /* ignore */ }
    }, [entriesKey, notesKey]);

    // Sync time from parent
    useEffect(() => { setTimeValue(mealTime); }, [mealTime]);

    useEffect(() => {
        if (editingTime) timeRef.current?.focus();
    }, [editingTime]);

    const saveEntries = (updated: MealFoodEntry[]) => {
        setEntries(updated);
        localStorage.setItem(entriesKey, JSON.stringify(updated));
    };

    const handleAddFood = (entry: MealFoodEntry) => {
        saveEntries([...entries, entry]);
        // Keep panel open so user can add more foods
    };

    const handleDelete = (entryId: string) => {
        saveEntries(entries.filter(e => e.entryId !== entryId));
    };

    const confirmTime = () => {
        const t = timeValue.trim();
        if (t) onTimeChange(t);
        setEditingTime(false);
    };

    const handleNotesChange = (val: string) => {
        setNotes(val);
        localStorage.setItem(notesKey, val);
    };

    return (
        <div className="flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden">

            {/* ── Card header ── */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                {/* Editable time */}
                {editingTime ? (
                    <input
                        ref={timeRef}
                        value={timeValue}
                        onChange={e => setTimeValue(e.target.value)}
                        onBlur={confirmTime}
                        onKeyDown={e => {
                            if (e.key === "Enter") confirmTime();
                            if (e.key === "Escape") { setTimeValue(mealTime); setEditingTime(false); }
                        }}
                        placeholder="8:30"
                        className="w-16 text-sm font-bold text-[#3E4C59] border border-[#1DBF73] rounded-lg px-2 py-0.5 outline-none text-center"
                    />
                ) : (
                    <button
                        onClick={() => setEditingTime(true)}
                        title="Editar hora"
                        className="text-sm font-bold text-[#3E4C59] hover:text-[#1DBF73] transition-colors cursor-pointer"
                    >
                        {mealTime || "—"}
                    </button>
                )}

                <h3 className="flex-1 text-sm font-bold text-[#3E4C59]">{mealLabel}</h3>

                <div className="flex items-center gap-0.5">
                    <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors cursor-pointer" title="Exportar">
                        <Download className="h-4 w-4" />
                    </button>
                    <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors cursor-pointer" title="Más opciones">
                        <MoreHorizontal className="h-4 w-4" />
                    </button>
                    <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors cursor-pointer" title="Colapsar">
                        <ChevronUp className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <AddFoodModal
                isOpen={addingFood || !!externalAddOpen}
                mealLabel={mealLabel}
                onAdd={handleAddFood}
                onClose={() => { setAddingFood(false); onExternalAddClose?.(); }}
            />

            {/* ── Food list ── */}
            <div className="flex flex-col">
                {entries.map(entry => (
                    <div
                        key={entry.entryId}
                        className="flex items-center gap-3 px-4 py-3 group hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                    >
                        <GripVertical className="h-4 w-4 text-gray-300 flex-none cursor-grab" />
                        <span className="flex-1 text-xs text-[#3E4C59] leading-snug">
                            {formatEntry(entry)}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer rounded-lg"
                                title="Ver detalle"
                            >
                                <AlignJustify className="h-3.5 w-3.5" />
                            </button>
                            <button
                                onClick={() => handleDelete(entry.entryId)}
                                className="p-1.5 text-gray-400 hover:text-red-400 transition-colors cursor-pointer rounded-lg"
                                title="Eliminar"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                ))}

                {/* Add food button */}
                <button
                    onClick={() => setAddingFood(true)}
                    className="flex items-center justify-center gap-2 w-full py-3 text-xs font-semibold text-[#1DBF73] hover:bg-green-50 transition-colors cursor-pointer border-t border-gray-50"
                >
                    Agregar nuevo alimento
                    <Plus className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* ── Notes ── */}
            <div className="px-5 py-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-[#3E4C59] mb-2">Notas</p>
                <textarea
                    value={notes}
                    onChange={e => handleNotesChange(e.target.value)}
                    rows={2}
                    placeholder="Escribe una nota para este tiempo de comida (opcional)"
                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 text-[#3E4C59] placeholder:text-gray-300 outline-none focus:border-[#1DBF73] resize-none transition-colors"
                />
            </div>

            {/* ── Nutritional summary ── */}
            <div className="flex border-t border-gray-100">
                {NUTRIENTS.map(({ key, label, unit, Icon, color, iconBg }, i) => {
                    const total = roundN(sumField(entries, key));
                    return (
                        <div
                            key={key}
                            className={`flex-1 flex flex-col gap-1.5 px-5 py-4 ${i > 0 ? "border-l border-gray-100" : ""}`}
                        >
                            <div className="flex items-center gap-2">
                                <span className={`flex items-center justify-center h-6 w-6 rounded-full ${iconBg}`}>
                                    <Icon className={`h-3 w-3 ${color}`} />
                                </span>
                                <span className="text-xs font-semibold text-[#3E4C59]">{label}</span>
                            </div>
                            <span className="text-base font-bold text-[#3E4C59] pl-0.5">
                                {total} <span className="text-xs font-normal text-gray-400">{unit}</span>
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
