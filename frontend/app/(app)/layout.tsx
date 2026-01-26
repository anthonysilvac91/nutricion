"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Sidebar from "@/components/layout/Sidebar"
import Topbar from "@/components/layout/Topbar"

export default function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        const token = localStorage.getItem("token")
        if (!token) {
            router.push("/login")
        }
    }, [router])

    if (!mounted) return null;

    return (
        <div className="min-h-screen bg-[#F3F6F8]">
            <Sidebar />
            <div className="flex flex-col md:pl-[220px] min-h-screen transition-all">
                <Topbar />
                <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-500">
                    {children}
                </main>
            </div>
        </div>
    )
}
