import { db } from "@/lib/db";
import { DEFAULT_USER } from "@/lib/constants";

/**
 * Get or create the default single user for this app.
 * In production this would be replaced by NextAuth session resolution.
 */
export async function getOrCreateDefaultUser() {
  let user = await db.user.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!user) {
    user = await db.user.create({
      data: {
        email: DEFAULT_USER.email,
        name: DEFAULT_USER.name,
      },
    });
  }
  return user;
}

export async function getDefaultUserId(): Promise<string> {
  const user = await getOrCreateDefaultUser();
  return user.id;
}
