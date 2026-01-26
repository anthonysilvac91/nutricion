"use client"
import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { X } from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { Select } from "@/components/ui/Select"
import { Textarea } from "@/components/ui/Textarea"

const schema = z.object({
    name: z.string().min(2, "El nombre es requerido"),
    birthDate: z.string().min(1, "Fecha de nacimiento requerida"),
    gender: z.enum(["male", "female"]),
    email: z.string().email().optional().or(z.literal("")),
    observations: z.string().optional(),
})

interface NewPatientModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    patientToEdit?: any
}

export function NewPatientModal({ isOpen, onClose, onSuccess, patientToEdit }: NewPatientModalProps) {
    const [loading, setLoading] = useState(false)
    const { register, handleSubmit, reset, formState: { errors } } = useForm({
        resolver: zodResolver(schema)
    })

    // Reset form when modal opens or patient changes
    useEffect(() => {
        if (isOpen) {
            if (patientToEdit) {
                reset({
                    name: patientToEdit.name,
                    birthDate: patientToEdit.birthDate,
                    gender: patientToEdit.gender,
                    email: patientToEdit.email || "",
                    observations: patientToEdit.observations || ""
                })
            } else {
                reset({
                    name: "",
                    birthDate: "",
                    gender: "male",
                    email: "",
                    observations: ""
                })
            }
        }
    }, [isOpen, patientToEdit, reset])

    const onSubmit = async (data: any) => {
        setLoading(true)
        try {
            if (patientToEdit) {
                await api.updatePatient(patientToEdit.id, data)
            } else {
                await api.createPatient(data)
            }
            onSuccess()
            onClose()
        } catch (error) {
            console.error(error)
            alert("Error al guardar paciente")
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-[#3E4C59]">{patientToEdit ? "Editar Paciente" : "Nuevo Paciente"}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nombre Completo *</Label>
                            <Input id="name" {...register("name")} placeholder="Ej: Juan Pérez" />
                            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message as string}</p>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="birthDate">Fecha de Nacimiento *</Label>
                                <Input id="birthDate" type="date" {...register("birthDate")} />
                                {errors.birthDate && <p className="text-red-500 text-xs mt-1">{errors.birthDate.message as string}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="gender">Sexo *</Label>
                                <Select id="gender" {...register("gender")}>
                                    <option value="male">Masculino</option>
                                    <option value="female">Femenino</option>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" {...register("email")} placeholder="ejemplo@correo.com" />
                            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message as string}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="observations">Observaciones</Label>
                            <Textarea id="observations" {...register("observations")} placeholder="Notas iniciales..." />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-50 mt-6">
                            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
                            <Button type="submit" disabled={loading} className="px-8 bg-[#1DBF73] hover:bg-[#15965A] text-white shadow-md shadow-green-100 font-bold">
                                {loading ? "Guardando..." : patientToEdit ? "Guardar Cambios" : "Guardar Paciente"}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
