"use client"

import { MoreHorizontal, Users, Calendar, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Nutritionist } from "@/services/nutritionistsService"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface Props {
    data: Nutritionist[];
    onEdit: (n: Nutritionist) => void;
}

export function NutritionistsTable({ data, onEdit }: Props) {
    if (data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center border rounded-xl bg-white border-dashed border-gray-300">
                <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <EyeOff className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Sin resultados</h3>
                <p className="text-gray-500 max-w-sm">No encontramos nutricionistas que coincidan con tus filtros.</p>
            </div>
        )
    }

    return (
        <>
            {/* Desktop View */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
                            <tr>
                                <th className="px-6 py-4 whitespace-nowrap">Nutricionista</th>
                                <th className="px-6 py-4 whitespace-nowrap">Estado</th>
                                <th className="px-6 py-4 whitespace-nowrap text-center">Pacientes</th>
                                <th className="px-6 py-4 whitespace-nowrap">Registro</th>
                                <th className="px-6 py-4 whitespace-nowrap">Último Acceso</th>
                                <th className="px-6 py-4 whitespace-nowrap text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{item.fullName}</div>
                                        <div className="text-gray-500 text-xs mt-0.5">{item.email}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${item.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                            {item.status === "ACTIVE" ? "Activo" : "Suspendido"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-1.5 text-gray-600">
                                            <Users className="h-4 w-4 text-gray-400" />
                                            <span className="font-medium">{item.patientsCount}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                                        {format(new Date(item.createdAt), "dd MMM yyyy", { locale: es })}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                                        {item.lastLoginAt ? format(new Date(item.lastLoginAt), "dd MMM yyyy", { locale: es }) : "—"}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Button variant="ghost" size="sm" onClick={() => onEdit(item)} className="h-8 text-gray-500 hover:text-gray-900">
                                            Ver detalle
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4">
                {data.map((item) => (
                    <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3">
                        <div className="flex justify-between items-start gap-4">
                            <div>
                                <h3 className="font-medium text-gray-900">{item.fullName}</h3>
                                <p className="text-sm text-gray-500">{item.email}</p>
                            </div>
                            <span className={`shrink-0 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${item.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                {item.status === "ACTIVE" ? "Activo" : "Suspendido"}
                            </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 pt-2 border-t border-gray-50">
                            <div className="flex items-center gap-1.5">
                                <Users className="h-4 w-4 text-gray-400" />
                                <span>{item.patientsCount} pacientes</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <span>{format(new Date(item.createdAt), "dd MMM yyyy", { locale: es })}</span>
                            </div>
                        </div>

                        <Button variant="outline" className="w-full mt-2" onClick={() => onEdit(item)}>
                            Administrar
                        </Button>
                    </div>
                ))}
            </div>
        </>
    )
}
