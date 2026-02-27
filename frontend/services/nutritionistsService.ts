export interface Nutritionist {
    id: string;
    fullName: string;
    email: string;
    status: "ACTIVE" | "SUSPENDED";
    patientsCount: number;
    createdAt: string;
    lastLoginAt?: string | null;
}

// In-memory mock database
let dbNutritionists: Nutritionist[] = [
    {
        id: "1",
        fullName: "Dr. Ana Silva",
        email: "ana.silva@demo.com",
        status: "ACTIVE",
        patientsCount: 45,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        lastLoginAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: "2",
        fullName: "Carlos Mendoza",
        email: "cmendoza@nutri.cl",
        status: "ACTIVE",
        patientsCount: 120,
        createdAt: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
        lastLoginAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: "3",
        fullName: "Laura Gutiérrez",
        email: "laura.g@demo.com",
        status: "SUSPENDED",
        patientsCount: 5,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        lastLoginAt: null,
    }
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const nutritionistsService = {
    async list(params: { q?: string; status?: string; page?: number; pageSize?: number }): Promise<{ data: Nutritionist[]; total: number }> {
        await delay(600);
        let result = [...dbNutritionists];

        if (params.q) {
            const query = params.q.toLowerCase();
            result = result.filter(n => n.fullName.toLowerCase().includes(query) || n.email.toLowerCase().includes(query));
        }

        if (params.status && params.status !== "ALL") {
            result = result.filter(n => n.status === params.status);
        }

        const page = params.page || 1;
        const pageSize = params.pageSize || 10;
        const total = result.length;

        const start = (page - 1) * pageSize;
        const data = result.slice(start, start + pageSize);

        return { data, total };
    },

    async create(payload: { fullName: string; email: string; password?: string }): Promise<Nutritionist> {
        await delay(800);
        const newDoc: Nutritionist = {
            id: Math.random().toString(36).substring(7),
            fullName: payload.fullName,
            email: payload.email,
            status: "ACTIVE",
            patientsCount: 0,
            createdAt: new Date().toISOString(),
            lastLoginAt: null,
        };
        dbNutritionists = [newDoc, ...dbNutritionists];
        return newDoc;
    },

    async update(id: string, payload: { fullName?: string; status?: "ACTIVE" | "SUSPENDED" }): Promise<Nutritionist> {
        await delay(500);
        const idx = dbNutritionists.findIndex(n => n.id === id);
        if (idx === -1) throw new Error("Nutritionist not found");

        const updated = { ...dbNutritionists[idx], ...payload };
        dbNutritionists[idx] = updated;
        return updated;
    },

    async resetPassword(id: string): Promise<void> {
        await delay(600);
        const exists = dbNutritionists.some(n => n.id === id);
        if (!exists) throw new Error("Nutritionist not found");
        // Simulate password reset logic (could send email internally)
    },

    async remove(id: string): Promise<void> {
        await delay(700);
        dbNutritionists = dbNutritionists.filter(n => n.id !== id);
    }
};
