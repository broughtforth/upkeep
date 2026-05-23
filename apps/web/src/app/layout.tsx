import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Upkeep Admin",
  description: "Assign cleaning, inventory, and laundry to your team.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
