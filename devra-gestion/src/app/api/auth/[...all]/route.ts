import { getAuth } from "@/server/auth";

// Toutes les routes de Better Auth : /api/auth/sign-in/email, /api/auth/sign-out…
export function GET(request: Request) {
  return getAuth().handler(request);
}

export function POST(request: Request) {
  return getAuth().handler(request);
}
