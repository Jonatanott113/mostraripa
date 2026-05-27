import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { logIpAccess, getAllIpAccesses, getIpAccessStats, getUserByEmail, createLocalUser, hashPassword, geoLookup, parseUserAgent } from "./db";
import { sdk } from "./_core/sdk";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    register: publicProcedure
      .input(z.object({
        name: z.string().min(2, "Nome muito curto"),
        email: z.string().email("Email inválido"),
        password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await getUserByEmail(input.email);
        if (existing) throw new Error("Email já cadastrado");

        const passwordHash = hashPassword(input.password);
        await createLocalUser({ name: input.name, email: input.email, passwordHash });

        const user = await getUserByEmail(input.email);
        if (!user) throw new Error("Erro ao criar usuário");

        const token = await sdk.createSessionToken(user.openId, { name: user.name || "", expiresInMs: ONE_YEAR_MS });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
      }),
    login: publicProcedure
      .input(z.object({
        email: z.string().email("Email inválido"),
        password: z.string().min(1, "Senha obrigatória"),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email);
        if (!user || !user.passwordHash) throw new Error("Email ou senha incorretos");

        const passwordHash = hashPassword(input.password);
        if (passwordHash !== user.passwordHash) throw new Error("Email ou senha incorretos");

        const token = await sdk.createSessionToken(user.openId, { name: user.name || "", expiresInMs: ONE_YEAR_MS });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
      }),
  }),

  ip: router({
    detect: publicProcedure.query(async ({ ctx }) => {
      const raw =
        ctx.req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
        ctx.req.socket?.remoteAddress ||
        'unknown';

      const ip = raw.startsWith('::ffff:') ? raw.slice(7) : raw;
      const userAgent = ctx.req.headers['user-agent']?.toString() || null;
      const referer = ctx.req.headers['referer']?.toString() || null;
      const language = ctx.req.headers['accept-language']?.toString().split(',')[0] || null;

      const { browser, os, device } = parseUserAgent(userAgent);

      // Geo lookup async (don't block response)
      void geoLookup(ip).then(geo => {
        logIpAccess({
          ip,
          userAgent,
          referer,
          language,
          browser,
          os,
          device,
          country: geo?.country ?? null,
          countryCode: geo?.countryCode ?? null,
          region: geo?.region ?? null,
          city: geo?.city ?? null,
          zip: geo?.zip ?? null,
          lat: geo?.lat ?? null,
          lon: geo?.lon ?? null,
          timezone: geo?.timezone ?? null,
          isp: geo?.isp ?? null,
          org: geo?.org ?? null,
        });
      });

      return { ip, browser, os, device, language };
    }),
    history: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new Error('Unauthorized: Only admins can access IP history');
      }

      const accesses = await getAllIpAccesses();
      const stats = await getIpAccessStats();

      return { accesses, stats };
    }),
  }),
});

export type AppRouter = typeof appRouter;
