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
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#050816",
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
