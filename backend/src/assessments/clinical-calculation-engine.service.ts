import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClinicalContext } from './context-resolver.service';
import { MeasurementRecordDto } from './dto/create-assessment.dto';
import { CalculatedResult, ResultStatus } from '@prisma/client';

export interface EngineResult {
    metricId: string;
    numericValue?: number;
    stringValue?: string;
    metadataAsJson?: any;
    status: ResultStatus;
    statusCode?: string;
    statusLabel?: string;
    formulaUsed?: string;
    formulaVersion?: string;
    referenceTableId?: string;
    engineVersion: string;
}

@Injectable()
export class ClinicalCalculationEngineService {
    private readonly logger = new Logger(ClinicalCalculationEngineService.name);
    private readonly ENGINE_VERSION = 'v1.0.0';

    constructor(private readonly prisma: PrismaService) { }

    async calculateAll(
        context: ClinicalContext,
        measurements: MeasurementRecordDto[]
    ): Promise<EngineResult[]> {
        const results: EngineResult[] = [];

        // 1. Setup Data Map for fast access
        const dataMap = new Map<string, number | string>();
        for (const m of measurements) {
            if (m.numericValue !== undefined && m.numericValue !== null) {
                dataMap.set(m.definitionId, m.numericValue);
            } else if (m.stringValue) {
                dataMap.set(m.definitionId, m.stringValue);
            }
        }

        // 2. BMI Calculation Logic Base Pipeline Example
        if (context.populationGroup === 'ADULT') {
            this.calculateAdultBMI(dataMap, results);
        } else if (context.populationGroup === 'PEDIATRIC') {
            // In pediatric it's Z-Scores. In phase 2 we mock missing rules.
            results.push({
                metricId: 'BMI',
                status: ResultStatus.PENDING_RULE,
                formulaUsed: undefined,
                formulaVersion: undefined,
                engineVersion: this.ENGINE_VERSION,
                statusCode: undefined,
                statusLabel: undefined,
            });
        }

        // We can add logic for TDEE, BodyFat etc dynamically here using Strategies if expanded.

        return results;
    }

    // --- BMI ADULT STRATEGY ---
    private calculateAdultBMI(dataMap: Map<string, number | string>, results: EngineResult[]) {
        const weight = dataMap.get('m_weight') as number;
        const heightCm = dataMap.get('m_height') as number;

        if (!weight || !heightCm) {
            results.push({
                metricId: 'BMI',
                status: ResultStatus.MISSING_DATA,
                formulaUsed: 'ADULT_BMI_STANDARD',
                formulaVersion: 'v1.0.0',
                engineVersion: this.ENGINE_VERSION,
            });
            return;
        }

        const heightM = heightCm / 100;
        const bmiValue = weight / (heightM * heightM);

        let statusCode = 'NORMAL';
        let statusLabel = 'Normal';

        if (bmiValue < 18.5) {
            statusCode = 'UNDERWEIGHT';
            statusLabel = 'Bajo peso';
        } else if (bmiValue >= 25 && bmiValue < 30) {
            statusCode = 'OVERWEIGHT';
            statusLabel = 'Sobrepeso';
        } else if (bmiValue >= 30) {
            statusCode = 'OBESE';
            statusLabel = 'Obesidad';
        }

        results.push({
            metricId: 'BMI',
            status: ResultStatus.CALCULATED,
            numericValue: parseFloat(bmiValue.toFixed(2)),
            statusCode: statusCode,
            statusLabel: statusLabel,
            formulaUsed: 'ADULT_BMI_STANDARD',
            formulaVersion: 'v1.0.0',
            referenceTableId: 'WHO_ADULT_CUTOFFS',
            engineVersion: this.ENGINE_VERSION,
        });
    }
}
