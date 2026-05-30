import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "plus1",
  description: "Find events with people nearby.",
  applicationName: "plus1",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/window.svg", type: "image/svg+xml" }],
    apple: [{ url: "/window.svg", type: "image/svg+xml" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "plus1",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white">
        {children}
      </body>
    </html>
  );
}
