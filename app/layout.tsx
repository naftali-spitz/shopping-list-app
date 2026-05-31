import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FutureCart",
  description: "Futuristic smart shopping list experience",
  applicationName: "FutureCart",
  keywords: ["shopping", "shopping list", "futurecart", "groceries"],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FutureCart",
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/futurecart-icon.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/futurecart-icon.svg",
    apple: "/futurecart-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#051630",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen overflow-x-hidden bg-[#050816] antialiased">
        {children}
      </body>
    </html>
  );
}
