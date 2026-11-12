import { createFileRoute, Outlet } from "@tanstack/react-router";
import { MemberShell } from "@/components/member-kit";
import { NEEL_CSS_HREF } from "@/lib/member-kit-assets";

export const Route = createFileRoute("/member")({
  head: () => ({
    meta: [
      { title: "Member Panel — Life OS" },
      { name: "description", content: "Life OS member account panel." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Member Panel — Life OS" },
      { property: "og:description", content: "Life OS member account panel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: NEEL_CSS_HREF },
    ],
  }),
  ssr: false,
  component: () => (
    <MemberShell>
      <Outlet />
    </MemberShell>
  ),
});
