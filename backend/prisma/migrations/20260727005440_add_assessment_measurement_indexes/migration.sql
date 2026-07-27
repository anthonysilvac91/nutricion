-- CreateIndex
CREATE INDEX "Assessment_patientId_status_date_completedAt_idx" ON "Assessment"("patientId", "status", "date", "completedAt");

-- CreateIndex
CREATE INDEX "MeasurementRecord_definitionId_assessmentId_createdAt_idx" ON "MeasurementRecord"("definitionId", "assessmentId", "createdAt");
