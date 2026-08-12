import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import Fastify from "fastify";

import { appRouter } from "./app-router.js";
import type { AuthProvider } from "./auth/auth-provider.js";
import type { AppContext } from "./context/app-context.js";

export function createServer(options: {
  authProvider: AuthProvider;
  authHandler?: (request: Request) => Promise<Response>;
  services: Omit<AppContext, "professional">;
}) {
  const server = Fastify({
    logger: {
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body",
        "res.body",
        "patient",
        "prescription",
      ],
    },
    bodyLimit: 1_000_000,
  });

  server.get("/health", async () => ({ status: "ok" }));
  if (options.authHandler !== undefined) {
    server.route({
      method: ["GET", "POST"],
      url: "/api/auth/*",
      handler: async (request, reply) => {
        const host = request.headers.host ?? "localhost";
        const url = new URL(request.url, `http://${host}`);
        const headers = new Headers();
        for (const [name, value] of Object.entries(request.headers)) {
          if (typeof value === "string") headers.set(name, value);
        }
        const body = request.method === "GET" ? undefined : JSON.stringify(request.body ?? {});
        const response = await options.authHandler?.(
          new Request(url, {
            method: request.method,
            headers,
            ...(body === undefined ? {} : { body }),
          }),
        );
        if (response === undefined) return reply.code(500).send();
        response.headers.forEach((value, name) => {
          if (name !== "set-cookie") reply.header(name, value);
        });
        const cookies = response.headers.getSetCookie();
        if (cookies.length > 0) reply.header("set-cookie", cookies);
        return reply.code(response.status).send(Buffer.from(await response.arrayBuffer()));
      },
    });
  }
  void server.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
      createContext: async ({ req }: { req: { headers: Record<string, string | string[] | undefined> } }) => {
        const headers = new Headers();
        for (const [name, value] of Object.entries(req.headers)) {
          if (typeof value === "string") headers.set(name, value);
        }
        return {
          professional: await options.authProvider.getProfessional(headers),
          ...options.services,
        } satisfies AppContext;
      },
    },
  });
  return server;
}
