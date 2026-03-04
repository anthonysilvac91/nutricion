"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ExternalLink, Plus, Edit, Trash, Eye, Mail, ShieldAlert } from "lucide-react"
import { api } from "@/lib/api"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { NewPatientModal } from "@/components/patients/NewPatientModal"
import { getUserFromToken } from "@/lib/auth"

export default function PatientsPage() {
    const router = useRouter()
    const [patients, setPatients] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [role, setRole] = useState<string | null>(null)
    const [isRoleChecked, setIsRoleChecked] = useState(false)

    const loadData = async () => {
        try {
            const data = await api.getPatients()
            setPatients(data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const user = getUserFromToken()
        if (user) {
            setRole(user.role)
        }
        setIsRoleChecked(true)
        // If it's an admin, we don't even call loadData
        if (user?.role !== "ADMIN") {
            loadData()
        }
    }, [])

    if (!isRoleChecked) return null;

    if (role === "ADMIN") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-md mx-auto">
                <div className="h-16 w-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
                    <ShieldAlert className="h-8 w-8" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h1>
                <p className="text-gray-500 mb-8">Los administradores no tienen acceso al módulo de pacientes de los nutricionistas.</p>
                <Button onClick={() => router.push("/dashboard")} className="w-full">
                    Volver al inicio
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">

            {/* Action Bar */}
            <div className="flex items-center justify-end mb-6">
                <Button onClick={() => setIsModalOpen(true)} className="bg-[#1DBF73] hover:bg-[#15965A] text-white shadow-md shadow-green-100 font-bold px-6 h-10 rounded-md flex items-center gap-2 cursor-pointer">
                    Agregar +
                </Button>
            </div>

            {/* Table */}
            <Card className="overflow-hidden shadow-sm border-none bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-white text-gray-400 text-xs uppercase font-semibold border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 w-16"></th>
                                <th className="px-4 py-4">Nombre</th>
                                <th className="px-4 py-4">Email</th>
                                <th className="px-4 py-4">Última consulta</th>
                                <th className="px-4 py-4">Próxima consulta</th>
                                <th className="px-4 py-4 text-center">Estado</th>
                                <th className="px-4 py-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">Cargando pacientes...</td></tr>
                            ) : patients.length > 0 ? (
                                patients.map((patient) => (
                                    <tr key={patient.id} className="hover:bg-gray-50/80 transition-colors group">
                                        <td className="pl-6 py-4">
                                            <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
                                                {patient.name.charAt(0)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="font-medium text-gray-700 text-sm hover:text-primary transition-colors cursor-pointer" onClick={() => window.location.href = `/patients/${patient.id}`}>{patient.name}</span>
                                        </td>
                                        <td className="px-4 py-4 text-gray-500 text-sm">{patient.email || "—"}</td>
                                        <td className="px-4 py-4 text-gray-500 text-sm">
                                            {patient.lastMeasurement ? patient.lastMeasurement : "Sin visitas"}
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="inline-block bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide">
                                                No programado
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide">
                                                Activo
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <Link href={`/patients/${patient.id}`}>
                                                    <button className="p-1.5 text-gray-400 hover:text-[#1DBF73] transition-colors" title="Ver">
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                </Link>
                                                <Link href={`/patients/${patient.id}/edit`}>
                                                    <button className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors" title="Editar">
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                </Link>
                                                <button
                                                    onClick={async () => {
                                                        if (confirm("¿Estás seguro de eliminar este paciente?")) {
                                                            try {
                                                                await api.deletePatient(patient.id);
                                                                loadData();
                                                            } catch (e) {
                                                                alert("Error al eliminar");
                                                            }
                                                        }
                                                    }}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                                        No se encontraron pacientes
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <NewPatientModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={loadData}
            />
        </div>
    )
}
