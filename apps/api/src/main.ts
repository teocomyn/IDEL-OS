import { randomBytes } from "node:crypto";

import { createDatabase, EncryptionService, LocalKeyProvider } from "@idel-os/db";

import { BetterAuthProvider } from "./auth/better-auth-provider.js";
import { createBetterAuth } from "./auth/better-auth.js";
import { parseEnvironment } from "./env.js";
import { createServer } from "./server.js";
import {
  DrizzleAuditSink,
  DrizzleCarePlanRepository,
  DrizzlePatientRepository,
  DrizzleTransmissionRepository,
} from "./services/drizzle-repositories.js";
import { PatientService } from "./services/patient-service.js";
import { PrivacyService } from "./services/privacy-service.js";
import { TransmissionService } from "./services/transmission-service.js";
import { CarePlanService } from "./services/care-plan-service.js";

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
const patientService = new PatientService(
  patientRepository,
  auditSink,
  encryptionService,
);
const auth = createBetterAuth({
  database: authDatabase,
  secret: environment.BETTER_AUTH_SECRET,
  baseUrl: environment.BETTER_AUTH_URL,
  trustedOrigin: environment.WEB_ORIGIN,
  sendEmail: async () => {
    // The production adapter must target an HDS-compatible transactional email route.
  },
});
const server = createServer({
  authProvider: new BetterAuthProvider(auth, authDatabase),
  authHandler: auth.handler,
  services: {
    patientService,
    carePlanService: new CarePlanService(new DrizzleCarePlanRepository(db), auditSink),
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
  },
});

await server.listen({ port: environment.PORT, host: "0.0.0.0" });
