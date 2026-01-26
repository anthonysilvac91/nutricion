"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Users, Calendar as CalendarIcon, FileText, Activity, Clock } from "lucide-react"
import { api } from "@/lib/api"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"

// Widget Component
const Widget = ({ title, value, icon: Icon, colorClass, bgClass, disabled }: any) => (
    <Card className={`border-none shadow-sm h-full relative overflow-hidden ${disabled ? 'opacity-80' : ''}`}>
        <div className={`p-6 flex items-center justify-between`}>
            <div>
                <p className="text-[#5A6A85] font-semibold mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-[#2A3547]">{value}</h3>
            </div>
            <div className={`h-12 w-12 rounded-full flex items-center justify-center ${bgClass} ${colorClass}`}>
                <Icon className="h-6 w-6" />
            </div>
        </div>
        {disabled && (
            <div className="absolute inset-0 bg-white/60 z-20 flex items-center justify-center backdrop-blur-[1px]">
                <div className="bg-gray-900 text-white px-3 py-1 rounded-full font-bold shadow-xl text-xs transform -rotate-3 border-2 border-white whitespace-nowrap">
                    🚀 Próximamente
                </div>
            </div>
        )}
    </Card>
)

export default function DashboardPage() {
    const [stats, setStats] = useState({ totalPatients: 0, measurementsThisMonth: 0 })
    const [recentPatients, setRecentPatients] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadData() {
            try {
                const patients = await api.getPatients()
                setStats({
                    totalPatients: patients.length,
                    measurementsThisMonth: 12 // Mock
                })
                setRecentPatients(patients.slice(0, 5))
            } catch (error) {
                console.error(error)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [])

    // Days mock for calendar
    const weekDays = [
        { day: "Lunes", date: "10", active: true },
        { day: "Martes", date: "11", active: false },
        { day: "Miércoles", date: "12", active: false },
        { day: "Jueves", date: "13", active: false },
        { day: "Viernes", date: "14", active: false },
        { day: "Sábado", date: "15", active: false },
    ]

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col">
            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-8 h-full pt-6">

                {/* Left Column: Calendar / Appointments (Disabled) */}
                <div className="flex flex-col h-full">
                    <h3 className="flex-none text-lg font-bold text-[#3E4C59] mb-4 h-7">Próximas consultas</h3>
                    <Card className="flex-1 border-none shadow-sm relative overflow-hidden flex flex-col">
                        <div className="flex-none p-6 border-b border-gray-100 flex justify-between items-center opacity-60">
                            <h3 className="font-bold text-[#3E4C59] flex items-center gap-2">
                                <CalendarIcon className="h-5 w-5 text-primary" /> Calendario
                            </h3>
                            <span className="text-sm text-gray-400">Hoy, 10 Ene</span>
                        </div>
                        <div className="flex-1 p-6 opacity-60 pointer-events-none overflow-hidden">
                            {/* Calendar Strip */}
                            <div className="flex justify-between mb-8 overflow-x-auto pb-2">
                                {weekDays.map((d, i) => (
                                    <div key={i} className={`flex flex-col items-center justify-center min-w-[50px] h-[70px] rounded-xl border ${d.active ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-gray-400 border-gray-100'}`}>
                                        <span className="text-[10px] font-medium uppercase tracking-wider mb-1">{d.day.substring(0, 3)}</span>
                                        <span className="text-xl font-bold">{d.date}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Empty State / List */}
                            <div className="space-y-4">
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex gap-4 items-center">
                                    <div className="bg-blue-100 text-blue-600 h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold">10:00</div>
                                    <div>
                                        <h5 className="font-bold text-gray-700">Consulta Primera Vez</h5>
                                        <p className="text-xs text-gray-500">Maria Garcia</p>
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex gap-4 items-center">
                                    <div className="bg-orange-100 text-orange-600 h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold">11:30</div>
                                    <div>
                                        <h5 className="font-bold text-gray-700">Control Mensual</h5>
                                        <p className="text-xs text-gray-500">Jose Rodriguez</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Overlay Badge */}
                        <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center backdrop-blur-[1px]">
                            <div className="bg-gray-900 text-white px-6 py-2 rounded-full font-bold shadow-xl text-sm transform -rotate-3 border-2 border-white">
                                🚀 Próximamente
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Right Column: Stats + Recent List */}
                <div className="flex flex-col h-full gap-6">
                    {/* Stats Grid */}
                    <div className="flex-none">
                        <h3 className="text-lg font-bold text-[#3E4C59] mb-4 h-7">Mis estadísticas mensuales</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <Widget
                                title="Pacientes"
                                value={loading ? "..." : stats.totalPatients}
                                icon={Users}
                                colorClass="text-[#1DBF73]"
                                bgClass="bg-[#E6FFFA]"
                            />
                            <Widget
                                title="Citas pendientes"
                                value="3"
                                icon={Clock}
                                colorClass="text-[#FFAE1F]"
                                bgClass="bg-[#FEF5E5]"
                            />
                            <Widget
                                title="Recetas"
                                value="-"
                                icon={FileText}
                                colorClass="text-[#FA896B]"
                                bgClass="bg-[#FEECE5]"
                                disabled={true}
                            />
                            <Widget
                                title="Consultas del Mes"
                                value={loading ? "..." : stats.measurementsThisMonth}
                                icon={Activity}
                                colorClass="text-[#5D87FF]"
                                bgClass="bg-[#ECF2FF]"
                            />
                        </div>
                    </div>

                    {/* Recent Patients */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <h3 className="flex-none text-lg font-bold text-[#3E4C59] mb-4">Últimos pacientes registrados</h3>
                        <Card className="flex-1 border-none shadow-sm overflow-hidden flex flex-col">
                            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                                {loading ? <p className="p-6 text-center text-gray-400">Cargando...</p> :
                                    recentPatients.length > 0 ? recentPatients.map((p, i) => (
                                        <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
                                            <div className={`h-10 w-10 min-w-[40px] rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${i % 2 === 0 ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                                                }`}>
                                                {p.name.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h5 className="font-semibold text-[#3E4C59] truncate text-sm">{p.name}</h5>
                                                <p className="text-xs text-gray-400 truncate">{p.email}</p>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="p-6 text-center text-gray-400 text-sm">No hay pacientes recientes</div>
                                    )}
                            </div>
                        </Card>
                    </div>
                </div>

            </div>
        </div>
    )
}
