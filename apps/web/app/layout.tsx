import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Institution OS",
  description: "Functional institution operations for students, attendance, and fees"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
