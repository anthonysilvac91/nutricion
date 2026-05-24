"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Users, Calendar as CalendarIcon, FileText, Activity, Clock } from "lucide-react"
import { api } from "@/lib/api"
import { Card } from "@/components/ui/Card"
import { useMockMode } from "@/lib/mock-mode-context"

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK = {
    stats: {
        totalPatients:       { value: 7,  trend: "+2 vs. el mes pasado",  spark: [3,4,3,5,4,6,7] },
        pendingAppointments: { value: 3,  trend: "Sin cambios",            spark: [3,3,3,3,3,3,3] },
        recipes:             { value: 24, trend: "+5 vs. el mes pasado",  spark: [10,12,14,16,18,22,24] },
        consultations:       { value: 12, trend: "+3 vs. el mes pasado",  spark: [5,6,7,8,9,10,12] },
    },
    patients: [
        { id: "1", name: "Juan Pérez",    date: "08 Ene, 2025" },
        { id: "2", name: "Ana Torres",    date: "07 Ene, 2025" },
        { id: "3", name: "Luis Martínez", date: "07 Ene, 2025" },
    ],
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
    const W = 80, H = 32
    const max = Math.max(...data), min = Math.min(...data)
    const range = max - min || 1
    const pts = data.map((v, i) => [
        (i / (data.length - 1)) * W,
        H - ((v - min) / range) * (H - 6) - 3,
    ])
    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")
    return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="opacity-70">
            <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })
}

const AVATAR_COLORS = [
    "bg-blue-50 text-blue-600",
    "bg-green-50 text-green-600",
    "bg-amber-50 text-amber-600",
    "bg-purple-50 text-purple-600",
]

// ─── Widget ───────────────────────────────────────────────────────────────────
interface WidgetProps {
    title: string
    value: string | number
    icon: React.ElementType
    colorClass: string
    bgClass: string
    accentColor?: string
    trend?: string
    spark?: number[]
    disabled?: boolean
}

const Widget = ({ title, value, icon: Icon, colorClass, bgClass, accentColor, trend, spark, disabled }: WidgetProps) => (
    <Card className={`border-none shadow-sm relative overflow-hidden ${disabled ? "opacity-80" : ""}`}>
        <div className="p-5">
            <div className="flex items-start justify-between mb-3">
                <div>
                    <p className="text-[#5A6A85] text-sm font-semibold mb-1">{title}</p>
                    <h3 className="text-3xl font-bold text-[#2A3547]">{value}</h3>
                </div>
                <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${bgClass} ${colorClass}`}>
                    <Icon className="h-6 w-6" />
                </div>
            </div>
            <div className="flex items-end justify-between">
                {trend
                    ? <p className="text-xs text-gray-400">{trend}</p>
                    : <span />
                }
                {spark && accentColor && <Sparkline data={spark} color={accentColor} />}
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
    const { isMock }                      = useMockMode()
    const [realPatients, setRealPatients] = useState<any[]>([])
    const [realCount, setRealCount]       = useState(0)
    const [loading, setLoading]           = useState(true)

    useEffect(() => {
        api.getPatients()
            .then((p) => { setRealCount(p.length); setRealPatients(p.slice(0, 3)) })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const patients = isMock
        ? MOCK.patients
        : realPatients.map((p) => ({ id: p.id, name: p.name, date: formatDate(p.createdAt ?? "") }))

    const weekDays = [
        { abbr: "LUN", date: "10", active: true  },
        { abbr: "MAR", date: "11", active: false },
        { abbr: "MIÉ", date: "12", active: false },
        { abbr: "JUE", date: "13", active: false },
        { abbr: "VIE", date: "14", active: false },
        { abbr: "SÁB", date: "15", active: false },
        { abbr: "DOM", date: "16", active: false },
    ]

    return (
        <div className="flex flex-col gap-6">

            {/* Main grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* ── Left: Appointments ── */}
                <div className="flex flex-col gap-4">
                    <Card className="border-none shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-[#3E4C59] flex items-center gap-2 text-sm">
                                <CalendarIcon className="h-4 w-4 text-primary" /> Próximas consultas
                            </h3>
                            <span className="text-xs text-gray-400">Hoy, 10 Ene</span>
                        </div>

                        <div className="p-5 flex flex-col gap-5">
                            {/* Calendar strip */}
                            <div className="flex gap-2">
                                {weekDays.map((d, i) => (
                                    <div key={i} className={`flex flex-col items-center justify-center flex-1 h-14 rounded-xl border text-center
                                        ${d.active
                                            ? "bg-primary text-white border-primary shadow-md"
                                            : "bg-white text-gray-400 border-gray-100"}`}
                                    >
                                        <span className="text-[8px] font-semibold uppercase tracking-wider">{d.abbr}</span>
                                        <span className="text-base font-bold leading-tight">{d.date}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Appointment items */}
                            <div className="space-y-3">
                                {[
                                    { time: "10:00", title: "Consulta Primera Vez", patient: "Maria García",    timeBg: "bg-blue-100 text-blue-600" },
                                    { time: "11:30", title: "Control Mensual",      patient: "José Rodríguez", timeBg: "bg-orange-100 text-orange-600" },
                                ].map((appt) => (
                                    <div key={appt.time} className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`${appt.timeBg} h-9 w-14 rounded-full flex items-center justify-center text-xs font-bold shrink-0`}>
                                                {appt.time}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-700 text-sm">{appt.title}</p>
                                                <p className="text-xs text-gray-400">{appt.patient}</p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-semibold text-orange-500 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                                            🚀 Próximamente
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <button className="flex items-center gap-2 text-primary text-xs font-medium mx-auto opacity-40 cursor-default">
                                <CalendarIcon className="h-3.5 w-3.5" /> Ver calendario completo
                            </button>
                        </div>
                    </Card>

                    {/* Promo card */}
                    <div className="rounded-2xl bg-linear-to-br from-[#e8faf2] to-[#d1fae5] p-5 flex items-center gap-4 overflow-hidden relative">
                        <div className="flex-1">
                            <h3 className="font-bold text-[#1a6b44] text-base leading-snug">
                                Organiza tu día,<br />cuida a más personas
                            </h3>
                            <p className="text-xs text-[#2d9566] mt-1 mb-4 leading-relaxed">
                                Mantén tu agenda al día y brinda el mejor acompañamiento nutricional.
                            </p>
                            <button
                                type="button"
                                className="flex items-center gap-2 bg-[#1DBF73] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#18a862] transition-colors shadow-sm"
                            >
                                Ir a calendario <CalendarIcon className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        {/* Illustration */}
                        <div className="shrink-0 opacity-80 pointer-events-none select-none">
                            <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
                                {/* Bowl */}
                                <ellipse cx="45" cy="60" rx="30" ry="10" fill="#86efac" />
                                <path d="M15 55 Q15 80 45 80 Q75 80 75 55Z" fill="#4ade80" />
                                <ellipse cx="45" cy="55" rx="30" ry="10" fill="#86efac" />
                                {/* Leaves in bowl */}
                                <ellipse cx="35" cy="50" rx="10" ry="6" fill="#16a34a" transform="rotate(-20 35 50)" />
                                <ellipse cx="52" cy="48" rx="9" ry="5" fill="#15803d" transform="rotate(15 52 48)" />
                                <ellipse cx="44" cy="46" rx="8" ry="5" fill="#22c55e" transform="rotate(-5 44 46)" />
                                {/* Apple */}
                                <circle cx="68" cy="38" r="14" fill="#f87171" />
                                <path d="M68 24 Q72 18 76 20" stroke="#15803d" strokeWidth="2" strokeLinecap="round" fill="none" />
                                <ellipse cx="63" cy="33" rx="4" ry="6" fill="#fca5a5" opacity="0.6" />
                                {/* Heart */}
                                <path d="M44 22 C44 18 38 14 38 20 C38 24 44 28 44 28 C44 28 50 24 50 20 C50 14 44 18 44 22Z" fill="#f43f5e" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* ── Right: Stats + Patients ── */}
                <div className="flex flex-col gap-6">
                    <div>
                        <h3 className="text-base font-bold text-[#3E4C59] mb-4">Mis estadísticas mensuales</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <Widget
                                title="Pacientes"
                                value={isMock ? MOCK.stats.totalPatients.value : (loading ? "..." : realCount)}
                                icon={Users}
                                colorClass="text-[#1DBF73]"
                                bgClass="bg-[#E6FFFA]"
                                accentColor="#1DBF73"
                                trend={isMock ? MOCK.stats.totalPatients.trend : undefined}
                                spark={isMock ? MOCK.stats.totalPatients.spark : undefined}
                            />
                            <Widget
                                title="Citas pendientes"
                                value="3"
                                icon={Clock}
                                colorClass="text-[#FFAE1F]"
                                bgClass="bg-[#FEF5E5]"
                                accentColor="#FFAE1F"
                                trend={isMock ? MOCK.stats.pendingAppointments.trend : undefined}
                                spark={isMock ? MOCK.stats.pendingAppointments.spark : undefined}
                            />
                            <Widget
                                title="Recetas creadas"
                                value={isMock ? MOCK.stats.recipes.value : "-"}
                                icon={FileText}
                                colorClass="text-[#FA896B]"
                                bgClass="bg-[#FEECE5]"
                                accentColor="#FA896B"
                                trend={isMock ? MOCK.stats.recipes.trend : undefined}
                                spark={isMock ? MOCK.stats.recipes.spark : undefined}
                                disabled={!isMock}
                            />
                            <Widget
                                title="Consultas del mes"
                                value={isMock ? MOCK.stats.consultations.value : (loading ? "..." : 12)}
                                icon={Activity}
                                colorClass="text-[#5D87FF]"
                                bgClass="bg-[#ECF2FF]"
                                accentColor="#5D87FF"
                                trend={isMock ? MOCK.stats.consultations.trend : undefined}
                                spark={isMock ? MOCK.stats.consultations.spark : undefined}
                            />
                        </div>
                    </div>

                    {/* Recent patients */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-bold text-[#3E4C59]">Últimos pacientes registrados</h3>
                            <Link href="/patients" className="text-sm text-primary font-medium hover:underline">Ver todos</Link>
                        </div>
                        <Card className="border-none shadow-sm overflow-hidden">
                            <div className="divide-y divide-gray-50">
                                {!isMock && loading
                                    ? <p className="p-6 text-center text-gray-400 text-sm">Cargando...</p>
                                    : patients.length > 0
                                        ? patients.map((p, i) => (
                                            <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                                                <div className={`h-9 w-9 min-w-9 rounded-full flex items-center justify-center text-sm font-bold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                                                    {p.name.charAt(0)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-[#3E4C59] text-sm truncate">{p.name}</p>
                                                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                                        <CalendarIcon className="h-3 w-3 shrink-0" /> {p.date}
                                                    </p>
                                                </div>
                                                <span className="text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full shrink-0">Nuevo</span>
                                                <span className="text-gray-300 text-lg leading-none">›</span>
                                            </div>
                                        ))
                                        : <p className="p-6 text-center text-gray-400 text-sm">No hay pacientes recientes</p>
                                }
                            </div>
                        </Card>
                    </div>
                </div>

            </div>
        </div>
    )
}
