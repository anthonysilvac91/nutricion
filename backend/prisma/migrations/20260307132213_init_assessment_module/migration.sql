-- CreateEnum
CREATE TYPE "MeasurementGroup" AS ENUM ('BASIC', 'COMPOSITION', 'SKINFOLD', 'GIRTH', 'CLINICAL_MARKER');

-- CreateEnum
CREATE TYPE "MetricCategory" AS ENUM ('COMPOSITION', 'INDEX', 'DIAGNOSTIC', 'ENERGY_REQUIREMENT');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('CALCULATED', 'MISSING_DATA', 'NOT_APPLICABLE', 'PENDING_RULE');

-- CreateTable
CREATE TABLE "MeasurementDefinition" (
    "id" TEXT NOT NULL,
    "group" "MeasurementGroup" NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MeasurementDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "MetricCategory" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MetricDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "ageAtAssessmentMonths" INTEGER,
    "populationGroup" TEXT,
    "specialProfile" TEXT,
    "clinicalProtocol" TEXT,
    "protocolVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeasurementRecord" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "numericValue" DOUBLE PRECISION,
    "stringValue" TEXT,
    "metadataAsJson" JSONB,
    "measuredBy" TEXT,
    "deviceUsed" TEXT,

    CONSTRAINT "MeasurementRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalculatedResult" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "numericValue" DOUBLE PRECISION,
    "stringValue" TEXT,
    "metadataAsJson" JSONB,
    "status" "ResultStatus" NOT NULL DEFAULT 'CALCULATED',
    "statusCode" TEXT,
    "statusLabel" TEXT,
    "formulaUsed" TEXT,
    "formulaVersion" TEXT,
    "referenceTableId" TEXT,
    "engineVersion" TEXT,

    CONSTRAINT "CalculatedResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeasurementRecord_assessmentId_definitionId_key" ON "MeasurementRecord"("assessmentId", "definitionId");

-- CreateIndex
CREATE UNIQUE INDEX "CalculatedResult_assessmentId_metricId_key" ON "CalculatedResult"("assessmentId", "metricId");

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementRecord" ADD CONSTRAINT "MeasurementRecord_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementRecord" ADD CONSTRAINT "MeasurementRecord_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "MeasurementDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculatedResult" ADD CONSTRAINT "CalculatedResult_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculatedResult" ADD CONSTRAINT "CalculatedResult_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "MetricDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
