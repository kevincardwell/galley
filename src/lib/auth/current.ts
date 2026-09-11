import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "./session";
import type { User } from "@/db/schema";

export const currentUser = cache(async (): Promise<User | null> => getSessionUser());

/** Redirects to /login when signed out. */
export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (!u.isAdmin) redirect("/");
  return u;
}
