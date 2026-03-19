import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "../components/Navbar";
import { ProcurementProvider } from "@/contexts/ProcurementContext";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ProcureTrace",
  description: "Autonomous AI sourcing agent by ChainIQ",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ backgroundColor: "var(--bg-app)", margin: 0 }}
      >
        <ProcurementProvider>
          <Navbar />
          {children}
        </ProcurementProvider>
      </body>
    </html>
  );
}
