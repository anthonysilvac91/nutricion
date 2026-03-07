import { Injectable } from '@nestjs/common';
import { Patient } from '@prisma/client';

export interface ClinicalContext {
    ageAtAssessmentMonths: number;
    populationGroup: string;
    specialProfile: string;
    clinicalProtocol: string;
}

@Injectable()
export class ContextResolverService {
    resolveContext(patient: Patient, assessmentDate: Date): ClinicalContext {
        // 1. Calculate precise age in months
        const ageInMonths = this.calculateAgeInMonths(patient.birthDate, assessmentDate);

        // 2. Base Population Group
        let populationGroup = 'ADULT';
        if (ageInMonths < 18 * 12) {
            populationGroup = 'PEDIATRIC';
        } else if (ageInMonths >= 60 * 12) {
            // 60 years+ as geriatric line for standard WHO, adjust if needed
            populationGroup = 'GERIATRIC';
        }

        // 3. Special Profile (Can be expanded if the Patient model receives conditions)
        // For now, we assume all default to STANDARD unless they have specific flags
        // Let's grab activityLevel as a baseline signal
        let specialProfile = 'STANDARD';
        if (patient.activityLevel === 'VERY_ACTIVE' || patient.activityLevel === 'ACTIVE') {
            specialProfile = 'HIGH_PERFORMANCE';
        }

        // 4. Determine applied protocol
        let clinicalProtocol = 'DEFAULT_ADULT_V1';
        if (populationGroup === 'PEDIATRIC') {
            clinicalProtocol = 'WHO_GROWTH_STANDARDS_V1';
        }

        return {
            ageAtAssessmentMonths: ageInMonths,
            populationGroup,
            specialProfile,
            clinicalProtocol,
        };
    }

    private calculateAgeInMonths(birthDate: Date, targetDate: Date): number {
        const yearsDiff = targetDate.getFullYear() - birthDate.getFullYear();
        const monthsDiff = targetDate.getMonth() - birthDate.getMonth();
        return yearsDiff * 12 + monthsDiff;
    }
}
