"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Sidebar from "@/components/layout/Sidebar"
import Topbar from "@/components/layout/Topbar"
import { MockModeProvider } from "@/lib/mock-mode-context"
import { SidebarProvider, useSidebar } from "@/lib/sidebar-context"

function AppLayoutContent({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const [mounted, setMounted] = useState(false)
    const { collapsed } = useSidebar()

    useEffect(() => {
        setMounted(true)
        const token = localStorage.getItem("token")
        if (!token) router.push("/login")
    }, [router])

    if (!mounted) return null

    return (
        <div className="min-h-screen bg-[#F3F6F8]">
            <Sidebar />
            <div className={`flex flex-col min-h-screen transition-all duration-300 ${collapsed ? "md:pl-16" : "md:pl-55"}`}>
                <Topbar />
                <main className="flex-1 p-6 w-full animate-in fade-in duration-500">
                    {children}
                </main>
            </div>
        </div>
    )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <MockModeProvider>
                <AppLayoutContent>{children}</AppLayoutContent>
            </MockModeProvider>
        </SidebarProvider>
    )
}
