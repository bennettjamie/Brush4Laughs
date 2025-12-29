import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/Footer";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Brush4Laughs | Custom Paint by Number Kits",
  description: "Convert your photos into custom paint-by-number kits automatically.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className={`${outfit.variable} font-sans antialiased text-slate-900 bg-slate-50 dark:bg-slate-950 dark:text-slate-100`}>
        {children}
        <Footer />
      </body>
    </html>
  );
}
