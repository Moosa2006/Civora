-- CreateTable: platform_settings
CREATE TABLE "platform_settings" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "category" VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: configuration_change_logs
CREATE TABLE "configuration_change_logs" (
    "id" UUID NOT NULL,
    "settingId" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT NOT NULL,
    "reason" TEXT,
    "changedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuration_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: operational_incidents
CREATE TABLE "operational_incidents" (
    "id" UUID NOT NULL,
    "incidentNumber" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "severity" VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    "subsystem" VARCHAR(100) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    "reportedById" UUID,
    "assignedToId" UUID,
    "resolutionNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: platform_settings
CREATE UNIQUE INDEX "platform_settings_key_key" ON "platform_settings"("key");
CREATE INDEX "platform_settings_category_idx" ON "platform_settings"("category");

-- CreateIndex: configuration_change_logs
CREATE INDEX "configuration_change_logs_key_idx" ON "configuration_change_logs"("key");
CREATE INDEX "configuration_change_logs_createdAt_idx" ON "configuration_change_logs"("createdAt");

-- CreateIndex: operational_incidents
CREATE UNIQUE INDEX "operational_incidents_incidentNumber_key" ON "operational_incidents"("incidentNumber");
CREATE INDEX "operational_incidents_status_idx" ON "operational_incidents"("status");
CREATE INDEX "operational_incidents_severity_idx" ON "operational_incidents"("severity");
CREATE INDEX "operational_incidents_createdAt_idx" ON "operational_incidents"("createdAt");

-- AddForeignKey: platform_settings
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: configuration_change_logs
ALTER TABLE "configuration_change_logs" ADD CONSTRAINT "configuration_change_logs_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "platform_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "configuration_change_logs" ADD CONSTRAINT "configuration_change_logs_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: operational_incidents
ALTER TABLE "operational_incidents" ADD CONSTRAINT "operational_incidents_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operational_incidents" ADD CONSTRAINT "operational_incidents_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operational_incidents" ADD CONSTRAINT "operational_incidents_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
