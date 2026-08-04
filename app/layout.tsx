import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MIDAS Champion Migration Finder",
  description: "Track engineering contacts who changed jobs using Lusha signals."
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
