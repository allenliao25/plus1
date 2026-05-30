import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "plus1",
  description: "Find low-pressure campus plans with people nearby.",
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
  viewportFit: "cover",
  themeColor: "#f6f4ef",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#f6f4ef]">
        {children}
      </body>
    </html>
  );
}
