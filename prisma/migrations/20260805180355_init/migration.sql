-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('INVOICE_FINANCING', 'PO_FINANCING', 'CONTRACT_FINANCING', 'GUARANTEE', 'SUPPLY_CHAIN');

-- CreateEnum
CREATE TYPE "ClientSegment" AS ENUM ('SME', 'CORPORATE', 'GLC_VENDOR', 'GOVERNMENT_CONTRACTOR');

-- CreateEnum
CREATE TYPE "ApplicationStage" AS ENUM ('ENQUIRY', 'QUALIFIED', 'DOCUMENTS_RECEIVED', 'UNDER_REVIEW', 'APPROVED', 'DISBURSED', 'DECLINED');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WEB_CONCIERGE', 'WHATSAPP_CAMPAIGN', 'RELATIONSHIP_MANAGER', 'SEEDED_HISTORICAL');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('INVOICE', 'PURCHASE_ORDER', 'PROGRESS_CLAIM', 'LETTER_OF_AWARD');

-- CreateEnum
CREATE TYPE "ExtractionVerdict" AS ENUM ('PENDING', 'ANOMALY_FREE', 'MISMATCH_FLAGGED', 'UNREADABLE');

-- CreateEnum
CREATE TYPE "CampaignChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'SMS', 'VOICE');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DETECTED', 'DRAFTED', 'APPROVED', 'SENT', 'DECLINED');

-- CreateEnum
CREATE TYPE "SecuritySeverity" AS ENUM ('BASELINE', 'NOTICE', 'ANOMALY', 'BLOCKED');

-- CreateEnum
CREATE TYPE "SecurityResponse" AS ENUM ('NONE', 'STEP_UP_AUTH', 'API_THROTTLE', 'SESSION_LOCK');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "shortPitch" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "triggerSignals" TEXT[],
    "requiredDocs" TEXT[],
    "typicalTenor" TEXT NOT NULL,
    "facilityRange" TEXT NOT NULL,
    "requiresAwardingBody" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registrationNo" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "segment" "ClientSegment" NOT NULL,
    "geography" TEXT NOT NULL DEFAULT 'Malaysia',
    "relationshipMonths" INTEGER NOT NULL DEFAULT 0,
    "approvedLimitSen" BIGINT NOT NULL DEFAULT 0,
    "isDemoFixture" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "productId" TEXT,
    "stage" "ApplicationStage" NOT NULL DEFAULT 'ENQUIRY',
    "source" "LeadSource" NOT NULL DEFAULT 'SEEDED_HISTORICAL',
    "declaredAmountSen" BIGINT,
    "awardingBody" TEXT,
    "contractReference" TEXT,
    "enquiryNote" TEXT,
    "matchRationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRecord" (
    "id" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "applicationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "assetPath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "isDeliberateMismatch" BOOLEAN NOT NULL DEFAULT false,
    "verdict" "ExtractionVerdict" NOT NULL DEFAULT 'PENDING',
    "verdictRationale" TEXT,
    "extractedAt" TIMESTAMP(3),
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedField" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "extractedText" TEXT NOT NULL,
    "crmValue" TEXT,
    "matches" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,

    CONSTRAINT "ExtractedField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditHistory" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "transactionsObserved" INTEGER NOT NULL DEFAULT 0,
    "totalDisbursedSen" BIGINT NOT NULL DEFAULT 0,
    "onTimeSettlementPct" INTEGER NOT NULL DEFAULT 0,
    "avgDaysToSettle" INTEGER NOT NULL DEFAULT 0,
    "worstArrearsDays" INTEGER NOT NULL DEFAULT 0,
    "distinctCounterparties" INTEGER NOT NULL DEFAULT 0,
    "disputeRatePct" INTEGER NOT NULL DEFAULT 0,
    "observedFrom" TIMESTAMP(3) NOT NULL,
    "observedTo" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashflowPoint" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "monthIndex" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "netPositionSen" BIGINT NOT NULL,

    CONSTRAINT "CashflowPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "channel" "CampaignChannel" NOT NULL DEFAULT 'WHATSAPP',
    "status" "CampaignStatus" NOT NULL DEFAULT 'DETECTED',
    "triggerMonth" TEXT NOT NULL,
    "triggerRationale" TEXT NOT NULL,
    "offerHeadline" TEXT NOT NULL,
    "offerBody" TEXT NOT NULL,
    "offerAmountSen" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "actor" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "geoLabel" TEXT NOT NULL,
    "deviceLabel" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "severity" "SecuritySeverity" NOT NULL DEFAULT 'BASELINE',
    "response" "SecurityResponse" NOT NULL DEFAULT 'NONE',
    "anomalyScore" INTEGER NOT NULL DEFAULT 0,
    "anomalyReason" TEXT,
    "recordsTouched" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "surface" TEXT NOT NULL DEFAULT '',
    "mode" TEXT NOT NULL DEFAULT 'simulated',
    "model" TEXT,
    "promptVersion" TEXT,
    "inputDigest" TEXT NOT NULL DEFAULT '',
    "outputDigest" TEXT NOT NULL DEFAULT '',
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "latencyMs" INTEGER,
    "costMicros" INTEGER,
    "outcome" TEXT,
    "meta" JSONB,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Client_registrationNo_key" ON "Client"("registrationNo");

-- CreateIndex
CREATE INDEX "Client_segment_idx" ON "Client"("segment");

-- CreateIndex
CREATE UNIQUE INDEX "Application_reference_key" ON "Application"("reference");

-- CreateIndex
CREATE INDEX "Application_clientId_idx" ON "Application"("clientId");

-- CreateIndex
CREATE INDEX "Application_stage_idx" ON "Application"("stage");

-- CreateIndex
CREATE INDEX "Application_source_idx" ON "Application"("source");

-- CreateIndex
CREATE INDEX "DocumentRecord_applicationId_idx" ON "DocumentRecord"("applicationId");

-- CreateIndex
CREATE INDEX "ExtractedField_documentId_idx" ON "ExtractedField"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditHistory_clientId_key" ON "CreditHistory"("clientId");

-- CreateIndex
CREATE INDEX "CashflowPoint_clientId_idx" ON "CashflowPoint"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "CashflowPoint_clientId_monthIndex_key" ON "CashflowPoint"("clientId", "monthIndex");

-- CreateIndex
CREATE INDEX "Campaign_clientId_idx" ON "Campaign"("clientId");

-- CreateIndex
CREATE INDEX "SecurityEvent_occurredAt_idx" ON "SecurityEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_severity_idx" ON "SecurityEvent"("severity");

-- CreateIndex
CREATE INDEX "AuditEntry_sessionId_idx" ON "AuditEntry"("sessionId");

-- CreateIndex
CREATE INDEX "AuditEntry_scenario_idx" ON "AuditEntry"("scenario");

-- CreateIndex
CREATE INDEX "AuditEntry_createdAt_idx" ON "AuditEntry"("createdAt");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRecord" ADD CONSTRAINT "DocumentRecord_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedField" ADD CONSTRAINT "ExtractedField_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditHistory" ADD CONSTRAINT "CreditHistory_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashflowPoint" ADD CONSTRAINT "CashflowPoint_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
