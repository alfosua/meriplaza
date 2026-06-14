import { test } from "node:test";
import assert from "node:assert/strict";
import { auth } from "../src/auth/routes.ts";

class ProfileStmt {
  private args: unknown[] = [];
  private db: ProfileD1;
  private sql: string;
  constructor(db: ProfileD1, sql: string) {
    this.db = db;
    this.sql = sql;
  }
  bind(...args: unknown[]) { this.args = args; return this; }
  async first<T>() { return this.db.first<T>(this.sql, this.args); }
  async all<T>() { return this.db.all<T>(); }
  async run() { return this.db.run(this.sql, this.args); }
}

class ProfileD1 {
  users = new Map<string, any>();
  sessions = new Map<string, { user_id: string; expires: number }>();
  profiles = new Map<string, string>();

  prepare(sql: string) { return new ProfileStmt(this, sql); }

  async first<T>(sql: string, args: unknown[]): Promise<T | null> {
    if (sql.includes("FROM sessions WHERE id")) {
      const s = this.sessions.get(String(args[0]));
      return (s ? { user_id: s.user_id, expires: s.expires } : null) as T | null;
    }
    if (sql.includes("FROM users WHERE id")) {
      const u = this.users.get(String(args[0]));
      return (u ? { id: u.id, email: u.email, name: u.name, role: u.role, seller_id: u.seller_id } : null) as T | null;
    }
    if (sql.includes("FROM user_profiles WHERE user_id")) {
      const doc = this.profiles.get(String(args[0]));
      return (doc ? { doc } : null) as T | null;
    }
    throw new Error(`ProfileD1.first unsupported SQL: ${sql}`);
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: [] };
  }

  async run(sql: string, args: unknown[]) {
    if (sql.startsWith("INSERT INTO user_profiles")) {
      const [userId, doc] = args.map(String);
      this.profiles.set(userId, doc);
      return { meta: { changes: 1 } };
    }
    throw new Error(`ProfileD1.run unsupported SQL: ${sql}`);
  }
}

function env(db: ProfileD1) {
  return { DB: db, CACHE: {}, API_USERS: "" } as any;
}

function seedSession(db: ProfileD1) {
  db.users.set("usr_demo", {
    id: "usr_demo",
    email: "cliente@example.com",
    name: "Cliente Demo",
    role: "customer",
    seller_id: "",
  });
  db.sessions.set("sess_demo", { user_id: "usr_demo", expires: Math.floor(Date.now() / 1000) + 3600 });
}

test("profile endpoint saves normalized addresses and fiscal profiles for checkout", async () => {
  const db = new ProfileD1();
  seedSession(db);

  const res = await auth.request("/profile", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "mp_session=sess_demo" },
    body: JSON.stringify({
      addresses: [
        { id: "home", label: "Casa", recipient: "Ana", phone: "0414", city: "Caracas", address1: "La Candelaria", notes: "Tarde" },
        { id: "office", label: "Oficina", recipient: "Ana", city: "Valencia", address1: "Centro", isDefault: true },
        { city: "" },
        { city: "Maracay", address1: "A" },
        { city: "Barquisimeto", address1: "B" },
        { city: "Maracaibo", address1: "C" },
        { city: "Merida", address1: "D" },
      ],
      fiscalProfiles: [
        { id: "personal", label: "Personal", name: "Ana Perez", taxId: "V-28476588", email: "ana@example.com" },
        { id: "company", label: "Empresa", name: "Ana C.A.", taxId: "J-09512461-4", fiscalAddress: "Caracas", isDefault: true },
        { label: "empty" },
      ],
    }),
  }, env(db));

  assert.equal(res.status, 200);
  const payload = await res.json() as any;
  assert.equal(payload.ok, true);
  assert.equal(payload.profile.addresses.length, 5);
  assert.equal(payload.profile.addresses.filter((a: any) => a.isDefault).length, 1);
  assert.equal(payload.profile.addresses.find((a: any) => a.isDefault).id, "office");
  assert.equal(payload.profile.fiscalProfiles.length, 2);
  assert.equal(payload.profile.fiscalProfiles.find((f: any) => f.isDefault).id, "company");
  assert.equal(JSON.parse(db.profiles.get("usr_demo") || "{}").addresses.length, 5);

  const get = await auth.request("/profile", {
    headers: { cookie: "mp_session=sess_demo" },
  }, env(db));
  assert.equal(get.status, 200);
  const loaded = await get.json() as any;
  assert.equal(loaded.user.email, "cliente@example.com");
  assert.equal(loaded.profile.addresses[1].city, "Valencia");
  assert.equal(loaded.profile.fiscalProfiles[1].taxId, "J-09512461-4");
});

test("profile endpoint rejects unauthenticated writes", async () => {
  const db = new ProfileD1();
  const res = await auth.request("/profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ addresses: [{ city: "Caracas" }] }),
  }, env(db));
  assert.equal(res.status, 401);
});
