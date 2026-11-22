"use client";

import { usePathname, useRouter } from "next/navigation";
import AppSidebar from "@/components/common/AppSidebar";
import Navbar from "@/components/common/Navbar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useAuthStore } from "@/store/auth-store";
import { apiRequest, SessionExpiredError } from "@/lib/api";

const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

type MeResponse = {
  isAdmin?: boolean;
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const clearSession = useAuthStore((state) => state.logout);
  const isHydrated = useSyncExternalStore(subscribeToHydration, getClientHydrationSnapshot, getServerHydrationSnapshot);
  const [defaultOpen, setDefaultOpen] = useState(true);
  const [adminVerified, setAdminVerified] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-otp");

  const mustSignIn = isHydrated && !token && !isAuthRoute;

  useEffect(() => {
    const sidebarState = document.cookie
      .split("; ")
      .find((row) => row.startsWith("sidebar_state="))
      ?.split("=")[1];
    setDefaultOpen(sidebarState === "true");
  }, []);

  useEffect(() => {
    if (mustSignIn) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [mustSignIn, pathname, router]);

  useEffect(() => {
    if (!isHydrated || !token || isAuthRoute) {
      setAdminVerified(false);
      return;
    }
    let cancelled = false;
    setCheckingAdmin(true);
    void apiRequest<MeResponse>("/auth/me")
      .then((me) => {
        if (cancelled) return;
        if (!me?.isAdmin) {
          if (typeof clearSession === "function") clearSession();
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          setAdminVerified(false);
          return;
        }
        setAdminVerified(true);
      })
      .catch((error) => {
        if (cancelled) return;
        if (!(error instanceof SessionExpiredError) && typeof clearSession === "function") {
          clearSession();
        }
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        setAdminVerified(false);
      })
      .finally(() => {
        if (!cancelled) setCheckingAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clearSession, isAuthRoute, isHydrated, pathname, router, token]);

  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (!isHydrated || !token || checkingAdmin || !adminVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset className="transition-all min-h-screen">
        <Navbar />
        <div className="flex-1 px-4 sm:px-6 md:px-8 py-6 md:py-8 pb-14 w-full max-w-[1600px] mx-auto">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
