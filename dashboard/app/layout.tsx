import "./globals.css";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";

const geist = Geist({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-geist-mono" });

export const metadata = {
  title: "Terraform Landing Zone",
  description: "CI/CD pipeline runs, infrastructure drift detection, and cloud cost",
};

const SidebarItem = ({ active, children, href }: { active?: boolean; children: React.ReactNode; href: string }) => (
  <Link href={href} className={`sidebar-item ${active ? "active" : ""}`}>
    {children}
  </Link>
);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${geistMono.variable} antialiased selection:bg-[#141414] selection:text-white`}>
        {/* Skip link for keyboard navigation */}
        <a href="#content" className="skip-link visually-hidden">
          Skip to main content
        </a>

        <aside className="shell-sidebar">
          <div className="sidebar-mark">
            <span className="text-[13px] font-700 text-[#0a0a0a] tracking-[-0.02em]">TF</span>
          </div>
          <nav className="sidebar-nav">
            <SidebarItem active href="/">Overview</SidebarItem>
            <SidebarItem href="/pipeline">Pipeline</SidebarItem>
            <SidebarItem href="/drift">Drift</SidebarItem>
            <SidebarItem href="/cost">Cost</SidebarItem>
            <SidebarItem href="/trends">Trends</SidebarItem>
          </nav>
          <div className="sidebar-utils">
            <SidebarItem href="/settings">Settings</SidebarItem>
          </div>
        </aside>
        <main id="content" className="shell-content">{children}</main>
      </body>
    </html>
  );
}
