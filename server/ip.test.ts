import { describe, expect, it, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

// Mock do módulo de database
vi.mock("./db", () => ({
  logIpAccess: vi.fn(),
  getAllIpAccesses: vi.fn(),
  getIpAccessStats: vi.fn(),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "x-forwarded-for": "192.168.1.100",
      },
      socket: {
        remoteAddress: "127.0.0.1",
      } as any,
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  const adminUser: AuthenticatedUser = {
    id: 1,
    openId: process.env.OWNER_OPEN_ID || "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user: adminUser,
    req: {
      protocol: "https",
      headers: {},
      socket: {} as any,
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("IP Detection and Logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ip.detect", () => {
    it("should detect and return the client IP from x-forwarded-for header", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.ip.detect();

      expect(result.ip).toBe("192.168.1.100");
    });

    it("should extract IPv4 from IPv6-mapped address", async () => {
      const ctx = createPublicContext();
      ctx.req.headers["x-forwarded-for"] = "::ffff:192.168.1.100";

      const caller = appRouter.createCaller(ctx);
      const result = await caller.ip.detect();

      expect(result.ip).toBe("192.168.1.100");
    });

    it("should call logIpAccess with correct data", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await caller.ip.detect();

      expect(db.logIpAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          ip: "192.168.1.100",
          userAgent: expect.stringContaining("Mozilla"),
        })
      );
    });

    it("should handle missing x-forwarded-for header", async () => {
      const ctx = createPublicContext();
      ctx.req.headers["x-forwarded-for"] = undefined;
      ctx.req.socket.remoteAddress = "10.0.0.1";

      const caller = appRouter.createCaller(ctx);
      const result = await caller.ip.detect();

      expect(result.ip).toBe("10.0.0.1");
    });
  });

  describe("ip.history", () => {
    it("should return history only for admin users", async () => {
      const adminCtx = createAdminContext();
      const caller = appRouter.createCaller(adminCtx);

      const mockAccesses = [
        {
          id: 1,
          ip: "192.168.1.100",
          userAgent: "Mozilla/5.0",
          referer: null,
          country: null,
          city: null,
          createdAt: new Date(),
        },
      ];

      vi.mocked(db.getAllIpAccesses).mockResolvedValue(mockAccesses);
      vi.mocked(db.getIpAccessStats).mockResolvedValue({
        totalAccesses: 1,
        uniqueIps: 1,
      });

      const result = await caller.ip.history();

      expect(result.accesses).toEqual(mockAccesses);
      expect(result.stats).toEqual({
        totalAccesses: 1,
        uniqueIps: 1,
      });
    });

    it("should deny access to non-admin users", async () => {
      const publicCtx = createPublicContext();
      const caller = appRouter.createCaller(publicCtx);

      await expect(caller.ip.history()).rejects.toThrow();
    });

    it("should deny access to non-owner admin users", async () => {
      const ctx = createAdminContext();
      ctx.user!.openId = "different-user";

      const caller = appRouter.createCaller(ctx);

      await expect(caller.ip.history()).rejects.toThrow("Unauthorized");
    });
  });
});
