"use client"
import { createContext, useContext, useState, ReactNode } from "react"

interface MockModeCtx { isMock: boolean; toggle: () => void }

const MockModeContext = createContext<MockModeCtx>({ isMock: false, toggle: () => {} })

export function MockModeProvider({ children }: { children: ReactNode }) {
    const [isMock, setIsMock] = useState(false)
    return (
        <MockModeContext.Provider value={{ isMock, toggle: () => setIsMock((v) => !v) }}>
            {children}
        </MockModeContext.Provider>
    )
}

export const useMockMode = () => useContext(MockModeContext)
