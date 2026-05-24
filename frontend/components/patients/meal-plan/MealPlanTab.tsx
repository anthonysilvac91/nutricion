"use client";

import { useState, useEffect } from "react";
import { Settings2 } from "lucide-react";
import { MealConfigModal, Meal } from "./MealConfigModal";

const DEFAULT_MEALS: Meal[] = [
    { id: "desayuno", label: "Desayuno" },
    { id: "almuerzo", label: "Almuerzo" },
    { id: "once",     label: "Once" },
    { id: "cena",     label: "Cena" },
];

interface Props {
    patientId: string;
}

export function MealPlanTab({ patientId }: Props) {
    const storageKey = `meal-config-${patientId}`;

    const [meals,        setMeals]        = useState<Meal[]>(DEFAULT_MEALS);
    const [activeMealId, setActiveMealId] = useState<string>(DEFAULT_MEALS[0].id);
    const [configOpen,   setConfigOpen]   = useState(false);
    const [hydrated,     setHydrated]     = useState(false);

    // Load persisted config from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed: Meal[] = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setMeals(parsed);
                    setActiveMealId(parsed[0].id);
                }
            }
        } catch {
            // ignore corrupt storage
        }
        setHydrated(true);
    }, [storageKey]);

    const handleSaveMeals = (updated: Meal[]) => {
        setMeals(updated);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        // If the active meal was removed, fall back to the first one
        if (!updated.find(m => m.id === activeMealId)) {
            setActiveMealId(updated[0]?.id ?? "");
        }
    };

    const activeMeal = meals.find(m => m.id === activeMealId);

    if (!hydrated) return null;

    return (
        <div className="flex flex-col h-full gap-3">
            {/* Submenu bar */}
            <div className="flex-none flex items-center justify-between gap-3">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide shrink min-w-0">
                    {meals.map(meal => (
                        <button
                            key={meal.id}
                            onClick={() => setActiveMealId(meal.id)}
                            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                                activeMealId === meal.id
                                    ? "bg-[#1DBF73] text-white shadow-md shadow-green-100"
                                    : "bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent hover:border-gray-200"
                            }`}
                        >
                            {meal.label}
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => setConfigOpen(true)}
                    className="flex-none p-2 bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-[#1DBF73] hover:border-[#1DBF73] transition-all cursor-pointer"
                    title="Configurar tiempos de comida"
                >
                    <Settings2 className="h-4 w-4" />
                </button>
            </div>

            {/* Meal content area — placeholder for now */}
            <div className="flex-1 bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center gap-2 text-center px-6">
                <div className="h-12 w-12 rounded-full bg-[#E6FFFA] flex items-center justify-center text-2xl">
                    🍽️
                </div>
                <p className="text-sm font-semibold text-[#3E4C59]">{activeMeal?.label}</p>
                <p className="text-xs text-gray-400">El contenido de este tiempo de comida estará disponible próximamente.</p>
            </div>

            <MealConfigModal
                isOpen={configOpen}
                onClose={() => setConfigOpen(false)}
                meals={meals}
                onSave={handleSaveMeals}
            />
        </div>
    );
}
