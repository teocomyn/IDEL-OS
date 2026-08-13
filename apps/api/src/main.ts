import { randomBytes, randomUUID } from "node:crypto";

import { createDatabase, EncryptionService, LocalKeyProvider } from "@idel-os/db";
import { OsrmHttpClient, VroomHttpClient } from "@idel-os/routing";

import { BetterAuthProvider } from "./auth/better-auth-provider.js";
import { createBetterAuth } from "./auth/better-auth.js";
import { parseEnvironment } from "./env.js";
import { createServer } from "./server.js";
import {
  DrizzleAuditSink,
  DrizzleCarePlanRepository,
  DrizzlePatientRepository,
  DrizzlePrescriptionRepository,
  DrizzleFieldRepository,
  DrizzleDeviceRepository,
  DrizzleTransmissionRepository,
  DrizzleVisitLifecycleRepository,
} from "./services/drizzle-repositories.js";
import { PatientService } from "./services/patient-service.js";
import { PrivacyService } from "./services/privacy-service.js";
import { TransmissionService } from "./services/transmission-service.js";
import { CarePlanService } from "./services/care-plan-service.js";
import { VisitService } from "./services/visit-service.js";
import { PrescriptionService } from "./services/prescription-service.js";
import { FieldService } from "./services/field-service.js";
import { DeviceService } from "./services/device-service.js";
import { OptimizationService } from "./services/optimization-service.js";
import { DrizzleOptimizationRepository } from "./services/optimization-repository.js";
import { CockpitService } from "./services/cockpit-service.js";
import { CabinetService } from "./services/cabinet-service.js";
import { DrizzleCabinetRepository, DrizzleCockpitRepository } from "./services/cabinet-repositories.js";

const environment = parseEnvironment(process.env);
const { db } = createDatabase(environment.DATABASE_URL);
const { db: authDatabase } = createDatabase(environment.DATABASE_AUTH_URL);
const masterKey =
  environment.NODE_ENV === "production"
    ? Buffer.from(environment.IDEL_MASTER_KEY_BASE64, "base64")
    : Buffer.from(environment.IDEL_MASTER_KEY_BASE64, "base64").length === 32
      ? Buffer.from(environment.IDEL_MASTER_KEY_BASE64, "base64")
      : randomBytes(32);
const patientRepository = new DrizzlePatientRepository(db);
const auditSink = new DrizzleAuditSink(db);
const encryptionService = new EncryptionService(new LocalKeyProvider(masterKey));
const cockpitRepository = new DrizzleCockpitRepository(db, encryptionService);
const cabinetRepository = new DrizzleCabinetRepository(db, encryptionService);
const patientService = new PatientService(
  patientRepository,
  auditSink,
  encryptionService,
);
const auth = createBetterAuth({
  database: authDatabase,
  secret: environment.BETTER_AUTH_SECRET,
  baseUrl: environment.BETTER_AUTH_URL,
  trustedOrigins: [
    environment.WEB_ORIGIN,
    "idel-os://",
    "idel-os://*",
    ...(environment.NODE_ENV === "development" ? ["exp://", "exp://**"] : []),
  ],
  sendEmail: async () => {
    // The production adapter must target an HDS-compatible transactional email route.
  },
});
const authProvider = new BetterAuthProvider(auth, authDatabase);
const server = createServer({
  authProvider,
  authHandler: auth.handler,
  services: {
    patientService,
    carePlanService: new CarePlanService(new DrizzleCarePlanRepository(db), auditSink),
    visitService: new VisitService(new DrizzleVisitLifecycleRepository(db), auditSink),
    transmissionService: new TransmissionService(
      new DrizzleTransmissionRepository(db),
      auditSink,
      encryptionService,
    ),
    privacyService: new PrivacyService({
      get: (organizationId, patientId) => patientService.get(organizationId, patientId),
      deactivate: async (organizationId, patientId, actor) => {
        await patientService.deactivate(organizationId, patientId, actor);
      },
    }),
    prescriptionService: new PrescriptionService(
      new DrizzlePrescriptionRepository(db),
      auditSink,
      encryptionService,
    ),
    fieldService: new FieldService(
      new DrizzleFieldRepository(db),
      auditSink,
      encryptionService,
    ),
    deviceService: new DeviceService(
      new DrizzleDeviceRepository(db),
      auditSink,
      () => new Date(),
      (userId) => authProvider.revokeUserSessions(userId),
    ),
    optimizationService: new OptimizationService(
      new DrizzleOptimizationRepository(db),
      new OsrmHttpClient(environment.OSRM_URL),
      new VroomHttpClient(environment.VROOM_URL),
      randomUUID,
    ),
    cockpitService: new CockpitService(cockpitRepository, auditSink, encryptionService),
    cabinetService: new CabinetService(cabinetRepository, auditSink),
  },
});

await server.listen({ port: environment.PORT, host: "0.0.0.0" });
