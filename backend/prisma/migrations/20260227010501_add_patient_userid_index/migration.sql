-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'EXPIRED', 'BLOCKED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Patient_userId_idx" ON "Patient"("userId");
