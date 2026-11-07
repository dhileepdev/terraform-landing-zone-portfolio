import "./globals.css";

export const metadata = {
  title: "Terraform Landing Zone Dashboard",
  description: "Realtime dashboard for Terraform drift, CI/CD pipeline runs, and cloud cost",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
