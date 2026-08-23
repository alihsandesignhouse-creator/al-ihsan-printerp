import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { StaffApiError, requireTenantAdmin } from "@/lib/server/staff-helpers";
import { countActiveBranches, getBranchLimit } from "@/lib/server/branch-helpers";

/**
 * POST /api/branches/create
 *
 * AUDIT-REPORT-5.md Issue #2 fix (৪ আগস্ট ২০২৬): branch creation used to
 * be a direct client Firestore SDK write (`lib/firebase/branches.ts`'s
 * `createBranch()`, via `addDoc()`), which meant nothing anywhere ever
 * enforced the blueprint's per-plan max-branches limit (অংশ ৪.৩: basic
 * ১টি / standard ৩টি / premium সীমাহীন) — a Basic-tier tenant could create
 * unlimited branches. This route moves branch *creation* only (not
 * editing/toggling an existing branch — those still write directly from
 * the client, unaffected, since they can't increase the branch count)
 * behind the Admin SDK, exactly the same pattern already used for staff
 * creation (`app/api/staff/create/route.ts`) and Super Admin tenant
 * creation (`app/api/super-admin/create-tenant/route.ts`).
 *
 * No offline-support regression: branch creation was never listed in the
 * blueprint's offline-feature table (অংশ ৫.২) — it's an infrequent setup
 * task, not a shop-floor operation, so requiring network access here
 * (same as staff creation already does) does not remove any capability
 * the blueprint promises to work offline.
 */
export const runtime = "nodejs";

const createBranchSchema = z.object({
  name: z.string().trim().min(2).max(100),
  address: z.string().trim().min(1).max(300),
  phone: z.string().max(11).default(""),
  branchManagerId: z.string().default(""),
  isActive: z.boolean().default(true),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = getAdminAuth();
  const db = getAdminDb();

  let tenantId: string;
  let adminUid: string;
  try {
    ({ tenantId, uid: adminUid } = await requireTenantAdmin(req, auth));
  } catch (err) {
    if (err instanceof StaffApiError) {
      return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
    }
    return NextResponse.json({ code: "internal", message: "unknown" }, { status: 500 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ code: "invalid-argument", message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createBranchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "invalid-argument", message: "তথ্য সঠিক নয়", errors: parsed.error.issues },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const [activeCount, limit] = await Promise.all([
    countActiveBranches(db, tenantId),
    getBranchLimit(db, tenantId),
  ]);
  if (activeCount >= limit) {
    return NextResponse.json(
      {
        code: "resource-exhausted",
        message: "আপনার প্যাকেজের শাখা সীমা শেষ হয়ে গেছে — আরও শাখা যোগ করতে প্যাকেজ আপগ্রেড করুন",
      },
      { status: 409 }
    );
  }

  if (input.branchManagerId) {
    const managerSnap = await db
      .collection("tenants")
      .doc(tenantId)
      .collection("users")
      .doc(input.branchManagerId)
      .get();
    if (!managerSnap.exists) {
      return NextResponse.json(
        { code: "not-found", message: "ম্যানেজার পাওয়া যায়নি" },
        { status: 404 }
      );
    }
  }

  const now = Timestamp.now();
  const ref = db.collection("tenants").doc(tenantId).collection("branches").doc();

  try {
    await ref.set({
      id: ref.id,
      tenantId,
      name: input.name,
      address: input.address,
      phone: input.phone || null,
      branchManagerId: input.branchManagerId || null,
      isActive: input.isActive,
      createdAt: now,
      updatedAt: now,
    });

    const auditRef = db.collection("tenants").doc(tenantId).collection("audit_logs").doc();
    await auditRef.set({
      id: auditRef.id,
      tenantId,
      userId: adminUid,
      userEmail: "",
      action: "branch.created",
      resourceType: "branch",
      resourceId: ref.id,
      changes: { name: input.name },
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "",
      userAgent: req.headers.get("user-agent") ?? "",
      createdAt: now,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[POST /api/branches/create]", err);
    }
    return NextResponse.json({ code: "internal", message: "শাখা তৈরি করা যায়নি" }, { status: 500 });
  }

  return NextResponse.json({ branchId: ref.id }, { status: 201 });
}
