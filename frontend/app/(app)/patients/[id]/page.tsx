"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Edit2, Pencil, TrendingUp, Calendar, Activity, Target, Clock, AlertCircle, Dumbbell, Layers } from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { NewPatientModal } from "@/components/patients/NewPatientModal"

export default function PatientProfilePage() {
    const params = useParams()
    const id = params.id as string
    const searchParams = useSearchParams()

    // Tabs configuration
    const TAB_KEYS = {
        INFO: "info",
        ANAMNESIS: "anamnesis",
        MEASUREMENTS: "measurements",
        PLANNING: "planning",
        MEAL_PLAN: "meal_plan",
        REPORTS: "reports"
    }

    const initialTab = searchParams.get("tab") || TAB_KEYS.INFO
    const [activeTab, setActiveTab] = useState(initialTab)
    const [patient, setPatient] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)

    const loadPatient = async () => {
        try {
            const p = await api.getPatient(id)
            setPatient(p)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (id) loadPatient()
    }, [id])

    useEffect(() => {
        if (searchParams.get("tab")) {
            setActiveTab(searchParams.get("tab")!)
        }
    }, [searchParams])

    if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando perfil...</div>
    if (!patient) return <div className="p-8 text-center text-muted-foreground">Paciente no encontrado</div>

    // Calculations
    const currentYear = new Date().getFullYear()
    const birthYear = new Date(patient.birthDate).getFullYear()
    const age = currentYear - birthYear

    const lastMeasurement = patient.measurements && patient.measurements.length > 0
        ? patient.measurements[patient.measurements.length - 1]
        : null

    const getImcStatus = (imc: number) => {
        if (!imc) return { label: "-", color: "text-gray-400", bg: "bg-gray-100" }
        if (imc < 18.5) return { label: "Bajo peso", color: "text-blue-600", bg: "bg-blue-100" }
        if (imc < 25) return { label: "Peso normal", color: "text-green-600", bg: "bg-green-100" }
        if (imc < 30) return { label: "Sobrepeso", color: "text-orange-600", bg: "bg-orange-100" }
        return { label: "Obesidad", color: "text-red-600", bg: "bg-red-100" }
    }

    const imcStatus = lastMeasurement ? getImcStatus(parseFloat(lastMeasurement.imc)) : getImcStatus(0)

    // Sub-components for modules
    const InfoTab = () => (
        <div className="space-y-3 h-full flex flex-col">

            {/* Vitals / Status Row */}
            <div className="flex-none grid grid-cols-1 lg:grid-cols-3 gap-3">

                {/* Metrics Grid (Takes 2/3 space) */}
                <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                    {/* Weight */}
                    <Card className="border-none shadow-sm p-3 bg-white flex flex-col justify-center gap-1 h-full">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Peso</p>
                            <div className="h-6 w-6 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                                <Activity className="h-3 w-3" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-bold text-gray-800">{lastMeasurement ? lastMeasurement.weight : "--"}</span>
                            <span className="text-xs text-gray-500">kg</span>
                        </div>
                    </Card>

                    {/* Muscle Mass */}
                    <Card className="border-none shadow-sm p-3 bg-white flex flex-col justify-center gap-1 h-full">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">% Masa</p>
                            <div className="h-6 w-6 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
                                <Dumbbell className="h-3 w-3" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-bold text-gray-800">32.5</span>
                            <span className="text-xs text-gray-500">%</span>
                        </div>
                    </Card>

                    {/* Body Fat */}
                    <Card className="border-none shadow-sm p-3 bg-white flex flex-col justify-center gap-1 h-full">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">% Grasa</p>
                            <div className="h-6 w-6 rounded-full bg-cyan-50 text-cyan-500 flex items-center justify-center">
                                <Layers className="h-3 w-3" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-bold text-gray-800">24.8</span>
                            <span className="text-xs text-gray-500">%</span>
                        </div>
                    </Card>

                    {/* BMI */}
                    <Card className="border-none shadow-sm p-3 bg-white flex flex-col justify-center gap-1 h-full">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">IMC</p>
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center ${imcStatus.bg} ${imcStatus.color}`}>
                                <TrendingUp className="h-3 w-3" />
                            </div>
                        </div>
                        <div className="flex flex-col leading-none">
                            <span className="text-lg font-bold text-gray-800">{lastMeasurement ? lastMeasurement.imc : "--"}</span>
                            <span className={`text-[9px] font-bold uppercase truncate ${imcStatus.color}`}>
                                {imcStatus.label}
                            </span>
                        </div>
                    </Card>
                </div>

                {/* Appointment Card (Takes 1/3) */}
                <Card className="border-none shadow-sm p-3 bg-white flex items-center gap-3 h-full">
                    <div className="h-10 w-10 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center flex-none">
                        <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Próxima Consulta</p>
                        <span className="text-sm font-medium text-gray-500 italic">No programada</span>
                    </div>
                </Card>
            </div>

            {/* Main Content Grid */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-3">

                {/* Clinical Context & Objectives (2/3) */}
                <Card className="lg:col-span-2 border-none shadow-sm p-4 bg-white overflow-y-auto">
                    <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                        <Target className="h-4 w-4 text-[#1DBF73]" />
                        <h3 className="text-base font-bold text-[#3E4C59]">Objetivos y Contexto</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <h4 className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-2">
                                <span className="w-1 h-1 rounded-full bg-[#1DBF73]"></span> Motivo de consulta
                            </h4>
                            <p className="text-gray-600 text-xs leading-relaxed pl-3 border-l-2 border-gray-100">
                                {patient.observations ? "Referido por interés personal en mejorar hábitos alimenticios." : "Sin registrar."}
                            </p>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-2">
                                <span className="w-1 h-1 rounded-full bg-[#1DBF73]"></span> Objetivos Clínicos
                            </h4>
                            <div className="flex flex-wrap gap-1.5 pl-3">
                                {patient.measurements.length > 0 ? (
                                    <>
                                        <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">Control peso</span>
                                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">Composición corporal</span>
                                    </>
                                ) : (
                                    <span className="text-gray-400 text-xs italic">Pendiente de definición</span>
                                )}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-2">
                                <span className="w-1 h-1 rounded-full bg-[#1DBF73]"></span> Observaciones
                            </h4>
                            <p className="text-gray-600 text-xs leading-relaxed pl-3 bg-gray-50 p-2 rounded">
                                {patient.observations || "No hay observaciones registradas en la ficha."}
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Consultations History (1/3) */}
                <Card className="border-none shadow-sm p-0 bg-white overflow-hidden flex flex-col h-full">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-none">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <h3 className="text-base font-bold text-[#3E4C59]">Historial</h3>
                        </div>
                    </div>
                    <div className="flex-1 p-4 bg-gray-50/50 overflow-y-auto">
                        {patient.measurements && patient.measurements.length > 0 ? (
                            <div className="relative border-l-2 border-gray-200 ml-2 space-y-4 py-1">
                                {[...patient.measurements].reverse().slice(0, 3).map((m: any, idx) => (
                                    <div key={m.id} className="relative pl-4">
                                        <div className={`absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-white shadow-sm ${idx === 0 ? 'bg-[#1DBF73]' : 'bg-gray-300'}`}></div>
                                        <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">{new Date(m.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold text-gray-800 text-xs">Consulta Control</span>
                                                <span className="text-xs font-bold text-[#1DBF73]">{m.weight} kg</span>
                                            </div>
                                            <div className="text-[10px] text-gray-500 flex gap-2">
                                                <span>IMC: {m.imc}</span>
                                                <span>Talla: {m.height} cm</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                                <AlertCircle className="h-6 w-6 opacity-20" />
                                <p className="text-xs">Sin consultas previas</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    )

    const PlaceholderTab = ({ label }: { label: string }) => (
        <Card className="border-none shadow-sm h-full flex items-center justify-center relative overflow-hidden bg-white min-h-[300px]">
            <div className="absolute inset-0 bg-gray-50/50"></div>
            <div className="z-10 bg-gray-900 text-white px-6 py-2 rounded-full font-bold shadow-xl text-sm transform -rotate-3 border-2 border-white">
                {label}
            </div>
        </Card>
    )

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col space-y-3">
            {/* Header */}
            <div className="flex-none flex items-center gap-4 pt-1">
                <div className="h-16 w-16 rounded-full bg-[#E6FFFA] text-[#1DBF73] flex items-center justify-center text-2xl font-bold border-4 border-white shadow-sm">
                    {patient.name.charAt(0)}
                </div>
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-bold text-[#3E4C59]">{patient.name}</h1>
                        <button onClick={() => setIsEditModalOpen(true)} className="p-1 bg-white shadow-sm border border-gray-100 hover:border-[#1DBF73] rounded-full text-gray-400 hover:text-[#1DBF73] transition-all cursor-pointer">
                            <Pencil className="h-3 w-3" />
                        </button>
                    </div>
                    <p className="text-gray-500 font-medium text-xs mt-0.5">{age} años</p>
                </div>
            </div>

            {/* Horizontal Menu */}
            <div className="flex-none border-b border-gray-200">
                <nav className="flex space-x-6">
                    {[
                        { key: TAB_KEYS.INFO, label: "Información" },
                        { key: TAB_KEYS.ANAMNESIS, label: "Anamnesis" },
                        { key: TAB_KEYS.MEASUREMENTS, label: "Mediciones" },
                        { key: TAB_KEYS.PLANNING, label: "Planificación" },
                        { key: TAB_KEYS.MEAL_PLAN, label: "Plan de alimentación" },
                        { key: TAB_KEYS.REPORTS, label: "Informes" },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`pb-2 text-xs font-bold border-b-2 transition-colors uppercase tracking-wide cursor-pointer ${activeTab === tab.key
                                    ? "border-[#1DBF73] text-[#1DBF73]"
                                    : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200"
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0 overflow-y-auto animate-in fade-in duration-300 pb-2 pr-1">
                {activeTab === TAB_KEYS.INFO && <InfoTab />}
                {(activeTab === TAB_KEYS.ANAMNESIS || activeTab === TAB_KEYS.MEAL_PLAN) && <PlaceholderTab label="🚀 Próximamente" />}
                {(activeTab === TAB_KEYS.MEASUREMENTS || activeTab === TAB_KEYS.PLANNING || activeTab === TAB_KEYS.REPORTS) && (
                    <PlaceholderTab label="🛠️ En desarrollo" />
                )}
            </div>

            {/* Edit Modal */}
            <NewPatientModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSuccess={loadPatient}
                patientToEdit={patient} // Pass current patient data
            />
        </div>
    )
}
