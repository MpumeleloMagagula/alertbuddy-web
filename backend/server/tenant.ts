/**
 * Tenant identity.
 *
 * Alert Buddy is deployed one-client-per-instance: each client has their own
 * Firebase project + Vercel deployment. `TENANT_ID` is therefore a single
 * configured value, stamped onto every Firestore document we write so the data
 * is already partitioned if we ever consolidate several clients into one shared
 * project. There is deliberately no read-path filtering yet — see the plan.
 */

export const TENANT_ID = process.env.TENANT_ID || 'default';

/** Stamp `tenantId` onto a document body just before writing it to Firestore. */
export function withTenant<T extends object>(data: T): T & { tenantId: string } {
  return { ...data, tenantId: TENANT_ID };
}
