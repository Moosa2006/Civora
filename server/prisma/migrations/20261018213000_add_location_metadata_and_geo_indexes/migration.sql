-- AlterTable complaints with location metadata and privacy flag
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "locationSource" VARCHAR(50);
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "locationAccuracy" DOUBLE PRECISION;
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "isLocationPublic" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "complaints_locality_idx" ON "complaints"("locality");
CREATE INDEX IF NOT EXISTS "complaints_ward_idx" ON "complaints"("ward");
CREATE INDEX IF NOT EXISTS "complaints_latitude_longitude_idx" ON "complaints"("latitude", "longitude");
CREATE INDEX IF NOT EXISTS "complaints_isLocationPublic_idx" ON "complaints"("isLocationPublic");
