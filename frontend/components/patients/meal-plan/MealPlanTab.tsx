"use client";

import { useState, useEffect } from "react";
import { Settings2, Plus } from "lucide-react";
import { MealConfigModal, Meal } from "./MealConfigModal";
import { MealContent } from "./MealContent";
import { AddFoodModal } from "./AddFoodModal";
import { NutritionalAnalysis } from "./NutritionalAnalysis";

const DEFAULT_MEALS: Meal[] = [
    { id: "desayuno", label: "Desayuno", time: "8:30"  },
    { id: "almuerzo", label: "Almuerzo", time: "13:00" },
    { id: "once",     label: "Once",     time: "17:00" },
    { id: "cena",     label: "Cena",     time: "20:00" },
];

interface Props {
    patientId: string;
}

export function MealPlanTab({ patientId }: Props) {
    const storageKey = `meal-config-${patientId}`;

    const [meals,        setMeals]        = useState<Meal[]>(DEFAULT_MEALS);
    const [activeMealId, setActiveMealId] = useState<string>(DEFAULT_MEALS[0].id);
    const [configOpen,   setConfigOpen]   = useState(false);
    const [addFoodOpen,  setAddFoodOpen]  = useState(false);
    const [hydrated,     setHydrated]     = useState(false);

    // Load persisted config from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed: Meal[] = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Fill in default times for meals that were saved before time was added
                    const migrated = parsed.map(m => ({
                        ...m,
                        time: m.time ?? DEFAULT_MEALS.find(d => d.id === m.id)?.time ?? "",
                    }));
                    setMeals(migrated);
                    setActiveMealId(migrated[0].id);
                }
            }
        } catch { /* ignore corrupt storage */ }
        setHydrated(true);
    }, [storageKey]);

    const persistMeals = (updated: Meal[]) => {
        setMeals(updated);
        localStorage.setItem(storageKey, JSON.stringify(updated));
    };

    const handleSaveMeals = (updated: Meal[]) => {
        persistMeals(updated);
        if (!updated.find(m => m.id === activeMealId)) {
            setActiveMealId(updated[0]?.id ?? "");
        }
    };

    const handleTimeChange = (mealId: string, time: string) => {
        persistMeals(meals.map(m => m.id === mealId ? { ...m, time } : m));
    };

    const activeMeal = meals.find(m => m.id === activeMealId);

    if (!hydrated) return null;

    return (
        <div className="flex flex-col gap-3">
            {/* Submenu bar */}
            <div className="flex items-center justify-between gap-3">
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

                <div className="flex items-center gap-2 flex-none">
                    <button
                        onClick={() => setAddFoodOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#1DBF73] text-white text-xs font-bold rounded-lg hover:bg-[#19a863] transition-all cursor-pointer shadow-sm shadow-green-100"
                        title="Agregar alimento"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Agregar alimento
                    </button>
                    <button
                        onClick={() => setConfigOpen(true)}
                        className="p-2 bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-[#1DBF73] hover:border-[#1DBF73] transition-all cursor-pointer"
                        title="Configurar tiempos de comida"
                    >
                        <Settings2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Two-column: meal content | nutritional analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                {/* Left — meal card (2/3) */}
                <div className="lg:col-span-2">
                    {activeMeal && (
                        <MealContent
                            key={activeMeal.id}
                            patientId={patientId}
                            mealId={activeMeal.id}
                            mealLabel={activeMeal.label}
                            mealTime={activeMeal.time ?? ""}
                            onTimeChange={time => handleTimeChange(activeMeal.id, time)}
                            externalAddOpen={addFoodOpen}
                            onExternalAddClose={() => setAddFoodOpen(false)}
                        />
                    )}
                </div>

                {/* Right — analysis panel (1/3, sticky) */}
                <div className="lg:col-span-1 sticky top-4">
                    <NutritionalAnalysis patientId={patientId} meals={meals} />
                </div>
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
