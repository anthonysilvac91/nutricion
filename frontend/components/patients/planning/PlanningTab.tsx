"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { PatientValuesSection } from "./PatientValuesSection";

type PlanningSection = "patient_values" | "energy" | "macros" | "micros";

const SECTIONS: { key: PlanningSection; label: string }[] = [
    { key: "patient_values", label: "Valores paciente" },
    { key: "energy",         label: "Cálculo energético" },
    { key: "macros",         label: "Macronutrientes" },
    { key: "micros",         label: "Micronutrientes" },
];

export function PlanningTab() {
    const [activeSection, setActiveSection] = useState<PlanningSection>("patient_values");

    return (
        <div className="h-full flex flex-col">
            {/* Submenu */}
            <div className="flex-none mb-3 overflow-x-auto pb-1 scrollbar-hide">
                <div className="flex gap-2">
                    {SECTIONS.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setActiveSection(key)}
                            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                                activeSection === key
                                    ? "bg-[#1DBF73] text-white shadow-md shadow-green-100"
                                    : "bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent hover:border-gray-200"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0">
                {activeSection === "patient_values" && <PatientValuesSection />}

                {activeSection !== "patient_values" && (
                    <Card className="border-none shadow-sm h-full flex items-center justify-center relative overflow-hidden bg-white min-h-64 overflow-y-auto">
                        <div className="absolute inset-0 bg-gray-50/50" />
                        <div className="z-10 bg-gray-900 text-white px-6 py-2 rounded-full font-bold shadow-xl text-sm transform -rotate-3 border-2 border-white">
                            🚀 Próximamente
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}
