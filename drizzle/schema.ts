import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const ipAccesses = mysqlTable("ip_accesses", {
  id: int("id").autoincrement().primaryKey(),
  ip: varchar("ip", { length: 45 }).notNull(),
  userAgent: text("user_agent"),
  referer: varchar("referer", { length: 2048 }),
  // Geo
  country: varchar("country", { length: 100 }),
  countryCode: varchar("country_code", { length: 2 }),
  region: varchar("region", { length: 100 }),
  city: varchar("city", { length: 100 }),
  zip: varchar("zip", { length: 20 }),
  lat: varchar("lat", { length: 20 }),
  lon: varchar("lon", { length: 20 }),
  timezone: varchar("timezone", { length: 100 }),
  isp: varchar("isp", { length: 255 }),
  org: varchar("org", { length: 255 }),
  // Device / browser (parsed server-side)
  browser: varchar("browser", { length: 100 }),
  os: varchar("os", { length: 100 }),
  device: varchar("device", { length: 50 }),
  // Extra headers
  language: varchar("language", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type IpAccess = typeof ipAccesses.$inferSelect;
export type InsertIpAccess = typeof ipAccesses.$inferInsert;