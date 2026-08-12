import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  patientInputSchema,
  patientPatchSchema,
  privacyRequestSchema,
  transmissionDraftInputSchema,
  transmissionReferenceSchema,
  carePlanActivationInputSchema,
  visitActCompletionSchema,
  visitReferenceSchema,
  prescriptionDraftInputSchema,
  prescriptionReferenceSchema,
  prescriptionValidationInputSchema,
  todayVisitsInputSchema,
  visitExceptionInputSchema,
  mobileDeviceRegistrationSchema,
  mobileDeviceReferenceSchema,
} from "@idel-os/shared";

import type { AppContext } from "./context/app-context.js";

const t = initTRPC.context<AppContext>().create();

const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (ctx.professional === null || !ctx.professional.twoFactorVerified) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentification renforcée requise." });
  }
  return next({ ctx: { ...ctx, professional: ctx.professional } });
});

const patientRouter = t.router({
  get: protectedProcedure.input(z.object({ patientId: z.uuid() })).query(({ ctx, input }) =>
    ctx.patientService.get(ctx.professional.organizationId, input.patientId),
  ),
  create: protectedProcedure
    .input(z.object({ patientId: z.uuid(), patient: patientInputSchema }))
    .mutation(({ ctx, input }) =>
      ctx.patientService.create({
        organizationId: ctx.professional.organizationId,
        actor: { userId: ctx.professional.userId, role: ctx.professional.role },
        patientId: input.patientId,
        input: input.patient,
      }),
    ),
  update: protectedProcedure
    .input(z.object({ patientId: z.uuid(), patch: patientPatchSchema }))
    .mutation(({ ctx, input }) =>
      ctx.patientService.update({
        organizationId: ctx.professional.organizationId,
        actor: { userId: ctx.professional.userId, role: ctx.professional.role },
        patientId: input.patientId,
        patch: input.patch,
      }),
    ),
});

const privacyRouter = t.router({
  exportJson: protectedProcedure
    .input(privacyRequestSchema.pick({ patientId: true }))
    .query(({ ctx, input }) =>
      ctx.privacyService.exportJson(ctx.professional.organizationId, input.patientId),
    ),
  exportPdf: protectedProcedure
    .input(privacyRequestSchema.pick({ patientId: true }))
    .query(({ ctx, input }) =>
      ctx.privacyService.exportPdf(ctx.professional.organizationId, input.patientId),
    ),
  requestErasure: protectedProcedure
    .input(privacyRequestSchema.pick({ patientId: true }))
    .mutation(({ ctx, input }) =>
      ctx.privacyService.requestErasure(
        ctx.professional.organizationId,
        input.patientId,
        { userId: ctx.professional.userId, role: ctx.professional.role },
      ),
    ),
});

const transmissionRouter = t.router({
  listByPatient: protectedProcedure
    .input(z.object({ patientId: z.uuid() }))
    .query(({ ctx, input }) =>
      ctx.transmissionService.listByPatient(ctx.professional.organizationId, input.patientId),
    ),
  createDraft: protectedProcedure
    .input(transmissionDraftInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.transmissionService.createDraft({
        organizationId: ctx.professional.organizationId,
        actor: { userId: ctx.professional.userId, role: ctx.professional.role },
        input,
      }),
    ),
  validate: protectedProcedure
    .input(transmissionReferenceSchema)
    .mutation(({ ctx, input }) =>
      ctx.transmissionService.validate({
        organizationId: ctx.professional.organizationId,
        actor: { userId: ctx.professional.userId, role: ctx.professional.role },
        transmissionId: input.transmissionId,
      }),
    ),
});

const carePlanRouter = t.router({
  activate: protectedProcedure
    .input(carePlanActivationInputSchema)
    .mutation(({ ctx, input }) =>
      ctx.carePlanService.activate({
        organizationId: ctx.professional.organizationId,
        actor: { userId: ctx.professional.userId, role: ctx.professional.role },
        input,
      }),
    ),
});

const visitRouter = t.router({
  start: protectedProcedure.input(visitReferenceSchema).mutation(({ ctx, input }) =>
    ctx.visitService.start({
      organizationId: ctx.professional.organizationId,
      actor: { userId: ctx.professional.userId, role: ctx.professional.role },
      visitId: input.visitId,
    }),
  ),
  setActPerformed: protectedProcedure.input(visitActCompletionSchema).mutation(({ ctx, input }) =>
    ctx.visitService.setActPerformed({
      organizationId: ctx.professional.organizationId,
      actor: { userId: ctx.professional.userId, role: ctx.professional.role },
      ...input,
    }),
  ),
  complete: protectedProcedure.input(visitReferenceSchema).mutation(({ ctx, input }) =>
    ctx.visitService.complete({
      organizationId: ctx.professional.organizationId,
      actor: { userId: ctx.professional.userId, role: ctx.professional.role },
      visitId: input.visitId,
    }),
  ),
});

const prescriptionRouter = t.router({
  getReview: protectedProcedure.input(prescriptionReferenceSchema).query(({ ctx, input }) =>
    ctx.prescriptionService.getReview(ctx.professional.organizationId, input.prescriptionId),
  ),
  createDraft: protectedProcedure.input(prescriptionDraftInputSchema).mutation(({ ctx, input }) =>
    ctx.prescriptionService.createDraft({
      organizationId: ctx.professional.organizationId,
      actor: { userId: ctx.professional.userId, role: ctx.professional.role },
      input,
    }),
  ),
  validate: protectedProcedure.input(prescriptionValidationInputSchema).mutation(({ ctx, input }) =>
    ctx.prescriptionService.validate({
      organizationId: ctx.professional.organizationId,
      actor: { userId: ctx.professional.userId, role: ctx.professional.role },
      input,
    }),
  ),
});

const fieldRouter = t.router({
  today: protectedProcedure.input(todayVisitsInputSchema).query(({ ctx, input }) =>
    ctx.fieldService.today(
      ctx.professional.organizationId,
      { userId: ctx.professional.userId, role: ctx.professional.role },
      input.date,
    ),
  ),
  recordException: protectedProcedure.input(visitExceptionInputSchema).mutation(({ ctx, input }) =>
    ctx.fieldService.recordException({
      organizationId: ctx.professional.organizationId,
      actor: { userId: ctx.professional.userId, role: ctx.professional.role },
      input,
    }),
  ),
});

const deviceRouter = t.router({
  register: protectedProcedure.input(mobileDeviceRegistrationSchema).mutation(({ ctx, input }) =>
    ctx.deviceService.register({
      organizationId: ctx.professional.organizationId,
      actor: { userId: ctx.professional.userId, role: ctx.professional.role },
      device: {
        id: input.deviceId,
        label: input.label,
        platform: input.platform,
        biometricEnabled: input.biometricEnabled,
      },
    }),
  ),
  status: protectedProcedure.input(mobileDeviceReferenceSchema).query(({ ctx, input }) =>
    ctx.deviceService.status(
      ctx.professional.organizationId,
      { userId: ctx.professional.userId, role: ctx.professional.role },
      input.deviceId,
    ),
  ),
  requestWipe: protectedProcedure.input(mobileDeviceReferenceSchema).mutation(({ ctx, input }) =>
    ctx.deviceService.requestWipe(
      ctx.professional.organizationId,
      { userId: ctx.professional.userId, role: ctx.professional.role },
      input.deviceId,
    ),
  ),
  acknowledgeWipe: protectedProcedure.input(mobileDeviceReferenceSchema).mutation(({ ctx, input }) =>
    ctx.deviceService.acknowledgeWipe(
      ctx.professional.organizationId,
      { userId: ctx.professional.userId, role: ctx.professional.role },
      input.deviceId,
    ),
  ),
});

export const appRouter = t.router({
  patient: patientRouter,
  privacy: privacyRouter,
  transmission: transmissionRouter,
  carePlan: carePlanRouter,
  visit: visitRouter,
  prescription: prescriptionRouter,
  field: fieldRouter,
  device: deviceRouter,
});
export type AppRouter = typeof appRouter;
