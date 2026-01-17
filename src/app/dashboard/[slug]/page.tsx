/**
 * Dynamic route for workspace slugs: /dashboard/[slug]
 * Renders the dashboard shell for an active workspace.
 */
import { SEO } from "@/components/seo/SEO";
import { DashboardShell } from "../page";

export default function WorkspacePage() {
  return (
    <>
      <SEO
        title="Dashboard"
        description="Manage your workspaces, create new projects, and organize knowledge effortlessly in your ThinkEx dashboard."
        keywords="dashboard, workspace management, AI workspace, productivity tools"
        url="https://thinkex.app/dashboard"
        canonical="https://thinkex.app/dashboard"
      />
      <DashboardShell />
    </>
  );
}

