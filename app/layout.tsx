import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "plus1",
  description: "do anything with someone",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#f7f3ea]">
        {children}
      </body>
    </html>
  );
}
