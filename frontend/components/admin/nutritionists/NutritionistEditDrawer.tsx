"use client"

import { useState, useEffect } from "react"
import { X, Loader2, AlertTriangle, KeyRound, UserX, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { Nutritionist, nutritionistsService } from "@/services/nutritionistsService"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface Props {
    isOpen: boolean
    nutritionist: Nutritionist | null
    onClose: () => void
    onSuccess: () => void
}

export function NutritionistEditDrawer({ isOpen, nutritionist, onClose, onSuccess }: Props) {
    const [fullName, setFullName] = useState("")
    const [status, setStatus] = useState<"ACTIVE" | "SUSPENDED">("ACTIVE")

    const [isLoading, setIsLoading] = useState(false)
    const [isResetting, setIsResetting] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    const [error, setError] = useState("")

    useEffect(() => {
        if (nutritionist) {
            setFullName(nutritionist.fullName)
            setStatus(nutritionist.status)
            setShowDeleteConfirm(false)
            setError("")
        }
    }, [nutritionist])

    if (!isOpen || !nutritionist) return null;

    const handleSave = async () => {
        setIsLoading(true)
        setError("")
        try {
            await nutritionistsService.update(nutritionist.id, { fullName, status })
            onSuccess()
            onClose()
        } catch (err: any) {
            setError(err.message || "Error al actualizar")
        } finally {
            setIsLoading(false)
        }
    }

    const handleResetPassword = async () => {
        if (!confirm("¿Estás seguro que deseas reiniciar la contraseña? Se enviará un enlace temporal.")) return;
        setIsResetting(true)
        try {
            await nutritionistsService.resetPassword(nutritionist.id)
            alert("Contraseña reiniciada. (Simulado)")
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsResetting(false)
        }
    }

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            await nutritionistsService.remove(nutritionist.id)
            onSuccess()
            onClose()
        } catch (err: any) {
            setError(err.message)
            setIsDeleting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Editar Nutricionista</h2>
                        <p className="text-sm text-gray-500">{nutritionist.email}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 font-bold rounded-full transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100 flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <h3 className="text-sm font-medium text-gray-900 mb-2">Resumen</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-gray-500">Pacientes activos</p>
                                <p className="font-medium text-gray-900">{nutritionist.patientsCount}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Fecha de registro</p>
                                <p className="font-medium text-gray-900">
                                    {format(new Date(nutritionist.createdAt), "dd MMM yyyy", { locale: es })}
                                </p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-gray-500">Último acceso</p>
                                <p className="font-medium text-gray-900">
                                    {nutritionist.lastLoginAt
                                        ? format(new Date(nutritionist.lastLoginAt), "dd MMM yyyy HH:mm", { locale: es })
                                        : "Nunca ha ingresado"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="editFullName">Nombre Completo</Label>
                        <Input
                            id="editFullName"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                        />
                    </div>

                    <div className="space-y-3">
                        <Label>Estado de la cuenta</Label>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setStatus("ACTIVE")}
                                className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${status === "ACTIVE" ? "bg-green-50 border-green-200 text-green-700" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                            >
                                {status === "ACTIVE" && <CheckCircle2 className="h-4 w-4" />}
                                Activo
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatus("SUSPENDED")}
                                className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${status === "SUSPENDED" ? "bg-red-50 border-red-200 text-red-700" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                            >
                                {status === "SUSPENDED" && <UserX className="h-4 w-4" />}
                                Suspendido
                            </button>
                        </div>
                        {status === "SUSPENDED" && (
                            <p className="text-xs text-red-600 mt-1">El nutricionista no podrá iniciar sesión mientras esté suspendido.</p>
                        )}
                    </div>

                    <div className="pt-6 space-y-3 border-t border-gray-100">
                        <h3 className="text-sm font-medium text-gray-900">Acciones de seguridad</h3>

                        <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-start text-gray-600"
                            onClick={handleResetPassword}
                            disabled={isResetting}
                        >
                            {isResetting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
                            Restablecer contraseña
                        </Button>

                        {!showDeleteConfirm ? (
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setShowDeleteConfirm(true)}
                            >
                                <UserX className="h-4 w-4 mr-2" />
                                Eliminar nutricionista
                            </Button>
                        ) : (
                            <div className="p-3 bg-red-50 rounded-lg border border-red-200 space-y-3">
                                <p className="text-sm text-red-800 font-medium tracking-tight">
                                    ¿Eliminar definitivamente a este nutricionista? Esta acción borrará todos sus pacientes y datos asociados.
                                </p>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(false)} className="flex-1 bg-white">Cancelar</Button>
                                    <Button size="sm" onClick={handleDelete} disabled={isDeleting} className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0">
                                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sí, eliminar"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
                    <Button variant="outline" onClick={onClose} className="flex-1 bg-white">
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={isLoading || fullName.trim() === ""} className="flex-1">
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar cambios"}
                    </Button>
                </div>
            </div>
        </div>
    )
}
