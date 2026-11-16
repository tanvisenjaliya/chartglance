import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import SplashScreen from "@/components/SplashScreen";
import WelcomeScreen from "@/components/WelcomeScreen";
import { WelcomeProvider } from "@/lib/welcome-context";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ChartGlance · Clinical OPD Assistant",
  description: "Decision-ready clinical summaries for Primary Health Centre OPD consultations",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${ibmPlexMono.variable} font-sans bg-surface text-navy antialiased min-h-screen`}
      >
        <WelcomeProvider>
          <SplashScreen />
          <WelcomeScreen />
          {children}
        </WelcomeProvider>
      </body>
    </html>
  );
}
