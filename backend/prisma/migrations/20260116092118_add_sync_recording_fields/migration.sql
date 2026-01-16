/*
  Warnings:

  - A unique constraint covering the columns `[sessionId]` on the table `recordings` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "recordings" ADD COLUMN "manifestPath" TEXT;
ALTER TABLE "recordings" ADD COLUMN "masterTime" DATETIME;
ALTER TABLE "recordings" ADD COLUMN "sensorOffset" INTEGER;
ALTER TABLE "recordings" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "recordings" ADD COLUMN "videoOffset" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "recordings_sessionId_key" ON "recordings"("sessionId");

-- CreateIndex
CREATE INDEX "recordings_sessionId_idx" ON "recordings"("sessionId");
