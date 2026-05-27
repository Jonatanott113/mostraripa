import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, User, users, InsertIpAccess, IpAccess, ipAccesses } from "../drizzle/schema";
import { ENV } from './_core/env';
import { createHash } from "node:crypto";

export function hashPassword(password: string): string {
  return createHash("sha256").update(password + (ENV.cookieSecret || "salt")).digest("hex");
}

let _db: ReturnType<typeof drizzle> | null = null;

// ─── In-memory fallback ───────────────────────────────────────────────────────
const memUsers: User[] = [];
const memIpAccesses: IpAccess[] = [];
let memIdCounter = 1;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Geo lookup via ip-api.com (free, no key needed) ─────────────────────────
interface GeoInfo {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  zip: string;
  lat: string;
  lon: string;
  timezone: string;
  isp: string;
  org: string;
}

export async function geoLookup(ip: string): Promise<GeoInfo | null> {
  // Skip private/loopback IPs
  if (!ip || ip === "::1" || ip.startsWith("127.") || ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.")) {
    return null;
  }
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org`);
    const data = await res.json() as any;
    if (data.status !== "success") return null;
    return {
      country: data.country ?? "",
      countryCode: data.countryCode ?? "",
      region: data.regionName ?? "",
      city: data.city ?? "",
      zip: data.zip ?? "",
      lat: String(data.lat ?? ""),
      lon: String(data.lon ?? ""),
      timezone: data.timezone ?? "",
      isp: data.isp ?? "",
      org: data.org ?? "",
    };
  } catch {
    return null;
  }
}

// ─── User-Agent parser ────────────────────────────────────────────────────────
export function parseUserAgent(ua: string | null): { browser: string; os: string; device: string } {
  if (!ua) return { browser: "Desconhecido", os: "Desconhecido", device: "Desconhecido" };

  // Browser
  let browser = "Outro";
  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera")) browser = "Opera";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("MSIE") || ua.includes("Trident/")) browser = "Internet Explorer";
  else if (ua.includes("curl/")) browser = "curl";
  else if (ua.includes("python")) browser = "Python";

  // OS
  let os = "Outro";
  if (ua.includes("Windows NT 10")) os = "Windows 10/11";
  else if (ua.includes("Windows NT 6.3")) os = "Windows 8.1";
  else if (ua.includes("Windows NT 6.1")) os = "Windows 7";
  else if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";

  // Device
  let device = "Desktop";
  if (ua.includes("Mobile") || ua.includes("iPhone") || ua.includes("Android") && !ua.includes("Tablet")) device = "Mobile";
  else if (ua.includes("Tablet") || ua.includes("iPad")) device = "Tablet";
  else if (ua.includes("Bot") || ua.includes("bot") || ua.includes("crawler") || ua.includes("spider")) device = "Bot";

  return { browser, os, device };
}

// ─── DB functions ─────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();

  if (!db) {
    const idx = memUsers.findIndex(u => u.openId === user.openId);
    const now = new Date();
    if (idx >= 0) {
      memUsers[idx] = { ...memUsers[idx], ...user, updatedAt: now, lastSignedIn: user.lastSignedIn ?? now };
    } else {
      memUsers.push({
        id: memIdCounter++,
        openId: user.openId,
        name: user.name ?? null,
        email: user.email ?? null,
        passwordHash: (user as any).passwordHash ?? null,
        loginMethod: user.loginMethod ?? null,
        role: user.role ?? (user.openId === ENV.ownerOpenId ? 'admin' : 'user'),
        createdAt: now,
        updatedAt: now,
        lastSignedIn: user.lastSignedIn ?? now,
      });
    }
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      values[field] = value ?? null;
      updateSet[field] = value ?? null;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return memUsers.find(u => u.openId === openId);
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return memUsers.find(u => u.email === email);
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createLocalUser(data: { name: string; email: string; passwordHash: string }): Promise<void> {
  const db = await getDb();
  const openId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  if (!db) {
    const now = new Date();
    memUsers.push({ id: memIdCounter++, openId, name: data.name, email: data.email, passwordHash: data.passwordHash, loginMethod: "password", role: "user", createdAt: now, updatedAt: now, lastSignedIn: now });
    return;
  }
  await db.insert(users).values({ openId, name: data.name, email: data.email, passwordHash: data.passwordHash, loginMethod: "password", lastSignedIn: new Date() });
}

export async function logIpAccess(access: InsertIpAccess): Promise<void> {
  const db = await getDb();
  if (!db) {
    memIpAccesses.push({
      id: memIdCounter++,
      ip: access.ip,
      userAgent: access.userAgent ?? null,
      referer: access.referer ?? null,
      country: access.country ?? null,
      countryCode: access.countryCode ?? null,
      region: access.region ?? null,
      city: access.city ?? null,
      zip: access.zip ?? null,
      lat: access.lat ?? null,
      lon: access.lon ?? null,
      timezone: access.timezone ?? null,
      isp: access.isp ?? null,
      org: access.org ?? null,
      browser: access.browser ?? null,
      os: access.os ?? null,
      device: access.device ?? null,
      language: access.language ?? null,
      createdAt: new Date(),
    });
    return;
  }
  try {
    await db.insert(ipAccesses).values(access);
  } catch (error) {
    console.error("[Database] Failed to log IP access:", error);
  }
}

export async function getAllIpAccesses(): Promise<IpAccess[]> {
  const db = await getDb();
  if (!db) return [...memIpAccesses].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  try {
    return await db.select().from(ipAccesses).orderBy((t) => t.createdAt);
  } catch (error) {
    console.error("[Database] Failed to get IP accesses:", error);
    return [];
  }
}

export async function getIpAccessStats() {
  const db = await getDb();
  const list = db ? await (async () => { try { return await db.select().from(ipAccesses); } catch { return []; } })() : memIpAccesses;
  const uniqueIps = new Set(list.map(a => a.ip)).size;
  const byCountry: Record<string, number> = {};
  const byDevice: Record<string, number> = {};
  for (const a of list) {
    if (a.country) byCountry[a.country] = (byCountry[a.country] ?? 0) + 1;
    if (a.device) byDevice[a.device] = (byDevice[a.device] ?? 0) + 1;
  }
  return { totalAccesses: list.length, uniqueIps, byCountry, byDevice };
}

// ─── Seed admin account ───────────────────────────────────────────────────────
const ADMIN_EMAIL = "a@gmail.com";
const ADMIN_PASSWORD = "123456";
const ADMIN_OPEN_ID = "local_admin_fixed";

export async function seedAdminUser(): Promise<void> {
  const passwordHash = hashPassword(ADMIN_PASSWORD);
  const db = await getDb();

  if (!db) {
    const idx = memUsers.findIndex(u => u.openId === ADMIN_OPEN_ID);
    const now = new Date();
    if (idx >= 0) {
      memUsers[idx] = { ...memUsers[idx], passwordHash, role: "admin" };
    } else {
      memUsers.push({ id: memIdCounter++, openId: ADMIN_OPEN_ID, name: "Admin", email: ADMIN_EMAIL, passwordHash, loginMethod: "password", role: "admin", createdAt: now, updatedAt: now, lastSignedIn: now });
    }
    console.log("[Seed] Admin account ready (in-memory): a@gmail.com");
    return;
  }

  try {
    await db.insert(users).values({ openId: ADMIN_OPEN_ID, name: "Admin", email: ADMIN_EMAIL, passwordHash, loginMethod: "password", role: "admin", lastSignedIn: new Date() })
      .onDuplicateKeyUpdate({ set: { passwordHash, role: "admin", name: "Admin" } });
    console.log("[Seed] Admin account ready (database): a@gmail.com");
  } catch (error) {
    console.error("[Seed] Failed to seed admin user:", error);
  }
}
