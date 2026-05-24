// SVG icons for measurement cards — outline style, uses currentColor
import { SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement> & { size?: number }
const base = (size = 22) => ({
    width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: 1.6,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
})

// ── Individual icons ────────────────────────────────────────────────────────

export const IconWeight = ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
        <path d="M12 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/>
        <path d="M6.5 8h11l-2 13h-7L6.5 8z"/>
        <path d="M9.5 12h5"/>
    </svg>
)

export const IconRuler = ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
        <rect x="4" y="3" width="4" height="18" rx="1"/>
        <line x1="8" y1="6" x2="11" y2="6"/>
        <line x1="8" y1="10" x2="12" y2="10"/>
        <line x1="8" y1="14" x2="11" y2="14"/>
        <line x1="8" y1="18" x2="12" y2="18"/>
        <path d="M14 8l4 4-4 4" strokeWidth="1.4"/>
    </svg>
)

export const IconGirth = ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
        <ellipse cx="12" cy="12" rx="7" ry="5"/>
        <path d="M5 12c0-2 3-5 7-5s7 3 7 5"/>
        <line x1="2" y1="12" x2="5" y2="12"/>
        <line x1="19" y1="12" x2="22" y2="12"/>
        <line x1="3" y1="9" x2="5.5" y2="10.5"/>
        <line x1="3" y1="15" x2="5.5" y2="13.5"/>
    </svg>
)

export const IconSkinfold = ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
        <path d="M8 6c0 0 1 3 4 3s4-3 4-3"/>
        <path d="M7 6 C6 9 6 15 9 18"/>
        <path d="M17 6 C18 9 18 15 15 18"/>
        <path d="M9 18 h6"/>
        <path d="M10 10 l1.5 4 1.5-4"/>
        <line x1="12" y1="14" x2="12" y2="17"/>
    </svg>
)

export const IconMuscle = ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
        <path d="M6 15c0-3 2-6 6-6s6 3 6 6"/>
        <path d="M6 15c0 2 1.5 3 3 3"/>
        <path d="M18 15c0 2-1.5 3-3 3"/>
        <path d="M9 18 h6"/>
        <path d="M12 9 V6"/>
        <circle cx="12" cy="5" r="1.5"/>
    </svg>
)

export const IconBone = ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
        <circle cx="6" cy="6" r="2"/>
        <circle cx="18" cy="6" r="2"/>
        <circle cx="6" cy="18" r="2"/>
        <circle cx="18" cy="18" r="2"/>
        <path d="M8 6h8M6 8v8M18 8v8M8 18h8"/>
    </svg>
)

export const IconFat = ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
        <circle cx="12" cy="12" r="7"/>
        <path d="M9 9 l6 6M15 9 l-6 6" strokeWidth="1.3"/>
        <path d="M12 5 v1M12 18 v1M5 12 h1M18 12 h-1"/>
    </svg>
)

export const IconWater = ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
        <path d="M12 3 C12 3 5 11 5 15a7 7 0 0 0 14 0C19 11 12 3 12 3z"/>
        <path d="M9 17 C9 18.5 10.5 19.5 12 19.5" strokeWidth="1.3"/>
    </svg>
)

export const IconFlame = ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
        <path d="M12 2c0 0-4 4-4 9a4 4 0 0 0 8 0c0-2-1-4-2-5 0 2-1 3-2 3-1 0-2-1-2-3 0 0 2-2 2-4z"/>
        <path d="M10 17 a3 3 0 0 0 4 0"/>
    </svg>
)

export const IconIndex = ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <path d="M10 17.5 H12 Q21 17.5 17.5 10"/>
    </svg>
)

export const IconDiameter = ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
        <circle cx="12" cy="12" r="8"/>
        <line x1="4" y1="12" x2="20" y2="12"/>
        <line x1="4" y1="10" x2="4" y2="14"/>
        <line x1="20" y1="10" x2="20" y2="14"/>
    </svg>
)

export const IconSum = ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
        <path d="M6 4h12"/>
        <path d="M6 4 l5 8 -5 8"/>
        <path d="M6 20h12"/>
    </svg>
)

export const IconGeneric = ({ size, ...p }: IconProps) => (
    <svg {...base(size)} {...p}>
        <path d="M3 12h4l3-8 4 16 3-8h4"/>
    </svg>
)

// ── Mapping: measurement ID → icon component ─────────────────────────────────
import { ComponentType } from "react"

const MAP: Record<string, ComponentType<IconProps>> = {
    // Basic
    m_weight:          IconWeight,
    m_height:          IconRuler,
    m_hip:             IconGirth,
    m_waist:           IconGirth,
    // Composition
    m_visceral_fat:    IconFat,
    m_fat_mass:        IconFat,
    m_fat_free_mass:   IconMuscle,
    m_lean_mass:       IconMuscle,
    m_muscle_mass:     IconMuscle,
    m_bone_mass:       IconBone,
    m_fat_percent:     IconFat,
    m_water:           IconWater,
    m_bmr:             IconFlame,
    m_bmi:             IconIndex,
    // Skinfold
    sf_abdominal:      IconSkinfold,
    sf_mid_axillary:   IconSkinfold,
    sf_bicep:          IconSkinfold,
    sf_calf:           IconSkinfold,
    sf_iliocristale:   IconSkinfold,
    sf_pectoral:       IconSkinfold,
    sf_subscapular:    IconSkinfold,
    sf_supraspinale:   IconSkinfold,
    sf_suprailiac:     IconSkinfold,
    sf_tricep:         IconSkinfold,
    sf_front_thigh:    IconSkinfold,
    sf_sum_5:          IconSum,
    sf_sum_8:          IconSum,
    // Girth
    m_dia_femur:       IconDiameter,
    m_dia_wrist:       IconDiameter,
    m_dia_elbow:       IconDiameter,
    m_dia_ankle:       IconDiameter,
    m_circ_neck:       IconGirth,
    m_circ_wrist:      IconGirth,
    m_circ_arm:        IconGirth,
    m_circ_arm_flex:   IconMuscle,
    m_circ_forearm:    IconGirth,
    m_circ_chest:      IconGirth,
    m_circ_abdomen:    IconGirth,
    m_circ_waist:      IconGirth,
    m_circ_hip:        IconGirth,
    m_circ_thigh:      IconGirth,
    m_circ_calf:       IconGirth,
    m_circ_ankle:      IconGirth,
    m_circ_head:       IconGirth,
    m_whr:             IconIndex,
    m_wh_ratio:        IconIndex,
    m_cmb:             IconMuscle,
}

export function getMeasurementIcon(id: string): ComponentType<IconProps> {
    return MAP[id] ?? IconGeneric
}
