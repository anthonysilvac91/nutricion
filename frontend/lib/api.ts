const STORAGE_KEY = "nutri_mock_db";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const getDb = () => {
    if (typeof window === "undefined") return { patients: [] };
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    const initial = {
        patients: [
            {
                id: "1",
                name: "Maria Garcia",
                email: "maria@example.com",
                birthDate: "1985-04-12",
                gender: "female",
                observations: "Objetivo: Bajar peso de forma saludable.",
                measurements: [
                    { id: "m1", date: "2025-01-10", weight: 65, height: 165, imc: "23.88" },
                ],
            },
            {
                id: "2",
                name: "Jose Rodriguez",
                email: "jose@test.com",
                birthDate: "1990-02-20",
                gender: "male",
                observations: "Deportista de alto rendimiento.",
                measurements: [],
            },
        ],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
};

const saveDb = (db: any) => {
    if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    }
};

export const api = {
    login: async (email: string, password: string) => {
        await delay(1000);
        if (email) {
            return { token: "mock-token-123", user: { name: "Dr. Nutricionista" } };
        }
        throw new Error("Invalid credentials");
    },

    getPatients: async () => {
        await delay(600);
        const db = getDb();
        return db.patients.map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            lastMeasurement:
                u.measurements.length > 0
                    ? u.measurements[u.measurements.length - 1].date
                    : "—",
        }));
    },

    getPatient: async (id: string) => {
        await delay(400);
        const db = getDb();
        const user = db.patients.find((u: any) => u.id === id);
        if (!user) throw new Error("Patient not found");
        return user;
    },

    createPatient: async (data: any) => {
        await delay(1000);
        const db = getDb();
        const newUser = {
            ...data,
            id: Math.random().toString(36).substr(2, 9),
            measurements: [],
        };
        db.patients.push(newUser);
        saveDb(db);
        return newUser;
    },

    updatePatient: async (id: string, data: any) => {
        await delay(1000);
        const db = getDb();
        const idx = db.patients.findIndex((u: any) => u.id === id);
        if (idx === -1) throw new Error("Patient not found");
        db.patients[idx] = { ...db.patients[idx], ...data };
        saveDb(db);
        return db.patients[idx];
    },

    createMeasurement: async (id: string, data: any) => {
        await delay(800);
        const db = getDb();
        const user = db.patients.find((u: any) => u.id === id);
        if (!user) throw new Error("Patient not found");

        // Calculate IMC
        const heightM = data.height / 100;
        const imc = heightM > 0 ? (data.weight / (heightM * heightM)).toFixed(2) : "0";

        const newM = {
            ...data,
            id: Math.random().toString(36).substr(2, 9),
            imc,
        };
        user.measurements.push(newM);
        saveDb(db);
        return newM;
    },
};
