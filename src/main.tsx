import "@vly-ai/integrations";
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import { ThemeProvider } from "@/hooks/use-theme";
import AppLayout from "@/components/layout/AppLayout";
import "./index.css";

// Lazy load route components
const Landing = lazy(() => import("./pages/Landing.tsx"));
const Guide = lazy(() => import("./pages/Guide.tsx"));
const Security = lazy(() => import("./pages/Security.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const AuthUIPage = lazy(() => import("./pages/AuthUIPage.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Projects = lazy(() => import("./pages/Projects.tsx"));
const Tasks = lazy(() => import("./pages/Tasks.tsx"));
const Backlog = lazy(() => import("./pages/Backlog.tsx"));
const SprintBoard = lazy(() => import("./pages/SprintBoard.tsx"));
const Team = lazy(() => import("./pages/Team.tsx"));
const Risks = lazy(() => import("./pages/Risks.tsx"));
const Analytics = lazy(() => import("./pages/Analytics.tsx"));
const Reports = lazy(() => import("./pages/Reports.tsx"));
const Retro = lazy(() => import("./pages/Retro.tsx"));
const SettingsPage = lazy(() => import("./pages/Settings.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl aie-gradient flex items-center justify-center animate-pulse">
          <div className="w-5 h-5 bg-white/30 rounded" />
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
      </div>
    </div>
  );
}

class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error) { console.warn("[VlyToolbar] Caught error:", err.message); }
  render() { return this.state.hasError ? null : this.props.children; }
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || "Unknown runtime error", stack: error.stack || "" };
  }
  componentDidCatch(err: Error) { console.error("[Root crash]:", err); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">{this.state.message}</p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl) {
  console.error("[AIE] VITE_CONVEX_URL is not set. Check your environment variables.");
}
const convex = new ConvexReactClient(convexUrl as string);

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage({ type: "iframe-route-change", path: location.pathname }, "*");
  }, [location.pathname]);
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);
  return null;
}

// Catch errors that happen before React mounts (white screen prevention)
window.onerror = (msg, src, line, col, err) => {
  const root = document.getElementById("root");
  if (root && root.children.length === 0) {
    root.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif;">
        <div style="max-width:480px;text-align:center;">
          <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;">AIE — Something went wrong</h2>
          <p style="font-size:13px;color:#666;margin-bottom:8px;">${String(msg)}</p>
          ${line ? `<p style="font-size:11px;color:#999;">Line ${line}:${col}</p>` : ""}
          <p style="font-size:12px;color:#888;margin-top:16px;">Try refreshing the page. If the problem persists, check your environment variables.</p>
        </div>
      </div>`;
  }
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <ThemeProvider>
          <BrowserRouter>
            <RouteSyncer />
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/guide" element={<Guide />} />
                <Route path="/security" element={<Security />} />
                <Route path="/auth" element={<AuthPage redirectAfterAuth="/dashboard" />} />
<Route path="/auth/ui" element={<AuthUIPage />} />

                {/* Protected routes with AppLayout */}
                <Route
                  path="/dashboard"
                  element={
                    <RequireAuth>
                      <AppLayout>
                        <Dashboard />
                      </AppLayout>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/projects"
                  element={
                    <RequireAuth>
                      <AppLayout>
                        <Projects />
                      </AppLayout>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/tasks"
                  element={
                    <RequireAuth>
                      <AppLayout>
                        <Tasks />
                      </AppLayout>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/backlog"
                  element={
                    <RequireAuth>
                      <AppLayout>
                        <Backlog />
                      </AppLayout>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/sprint-board"
                  element={
                    <RequireAuth>
                      <AppLayout>
                        <SprintBoard />
                      </AppLayout>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/team"
                  element={
                    <RequireAuth>
                      <AppLayout>
                        <Team />
                      </AppLayout>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/risks"
                  element={
                    <RequireAuth>
                      <AppLayout>
                        <Risks />
                      </AppLayout>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/analytics"
                  element={
                    <RequireAuth>
                      <AppLayout>
                        <Analytics />
                      </AppLayout>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/reports"
                  element={
                    <RequireAuth>
                      <AppLayout>
                        <Reports />
                      </AppLayout>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/retro"
                  element={
                    <RequireAuth>
                      <AppLayout>
                        <Retro />
                      </AppLayout>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/dashboard/settings"
                  element={
                    <RequireAuth>
                      <AppLayout>
                        <SettingsPage />
                      </AppLayout>
                    </RequireAuth>
                  }
                />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster />
        </ThemeProvider>
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
