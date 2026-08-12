import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  patientInputSchema,
  patientPatchSchema,
  privacyRequestSchema,
  transmissionDraftInputSchema,
  transmissionReferenceSchema,
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

export const appRouter = t.router({
  patient: patientRouter,
  privacy: privacyRouter,
  transmission: transmissionRouter,
});
export type AppRouter = typeof appRouter;
