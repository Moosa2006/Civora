-- CreateTable
CREATE TABLE "user_accessibility_preferences" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "textSize" VARCHAR(20) NOT NULL DEFAULT 'normal',
    "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
    "highContrast" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_accessibility_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_accessibility_preferences_userId_key" ON "user_accessibility_preferences"("userId");

-- AddForeignKey
ALTER TABLE "user_accessibility_preferences" ADD CONSTRAINT "user_accessibility_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
