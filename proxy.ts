import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./lib/database.types";
import { isAppHost, resolveHost, rewriteTarget } from "./lib/domain-routing";
import { missingEnv, SUPABASE_ANON_KEY, SUPABASE_URL } from "./lib/supabase/env";

/**
 * Runs before every page: refreshes the Supabase session cookie, sends signed-out visitors on
 * creator and admin screens to /login, and keeps non-admins out of /admin. The admin claim is
 * app_metadata.role (set in the Supabase dashboard), which users can't edit. RLS still guards
 * every query; this only decides which screens to show.
 */

const CREATOR = ["/dashboard", "/getting-started", "/catalog", "/store", "/sales", "/marketplace", "/tools", "/settings", "/onboarding"];
const AUTH_PAGES = ["/login", "/signup"];

const under = (path: string, roots: string[]) => roots.some((r) => path === r || path.startsWith(`${r}/`));

export async function proxy(request: NextRequest) {
  // No fallback backend: a misconfigured deploy fails loudly instead of showing made-up data
  const missing = missingEnv();
  if (missing.length) return new NextResponse(`PowerProof isn't connected to its database. Set ${missing.join(" and ")}.`, { status: 500 });

  // A store on its own domain: serve its pages from /s/<store> (buyers never see that address)
  const host = request.headers.get("host") ?? "";
  if (!isAppHost(host, process.env.NEXT_PUBLIC_SITE_URL)) {
    const slug = await resolveHost(host, SUPABASE_URL, SUPABASE_ANON_KEY);
    const target = slug ? rewriteTarget(request.nextUrl.pathname, slug) : null;
    if (target) {
      const url = request.nextUrl.clone();
      url.pathname = target;
      return NextResponse.rewrite(url);
    }
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getClaims verifies the JWT; don't put code between createServerClient and this call
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const path = request.nextUrl.pathname;
  const signedIn = Boolean(claims?.sub);
  const isAdmin = (claims?.app_metadata as { role?: string } | undefined)?.role === "admin";

  const redirect = (to: string, keepNext = false) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = keepNext ? `?next=${encodeURIComponent(path + request.nextUrl.search)}` : "";
    const out = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => out.cookies.set(c));
    return out;
  };

  if (!signedIn && (under(path, CREATOR) || under(path, ["/admin"]))) return redirect("/login", true);
  if (signedIn && under(path, ["/admin"]) && !isAdmin) return redirect("/dashboard");
  if (signedIn && under(path, AUTH_PAGES)) return redirect("/dashboard");
  return response;
}

export const config = {
  // Everything except static files, images and the API (route handlers check auth themselves)
  matcher: ["/((?!_next/static|_next/image|api/|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)"],
};
