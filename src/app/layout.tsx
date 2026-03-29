import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { UserProvider } from "@/contexts/UserContext";
import ToastContainer from "@/components/ui/Toast";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ET Patrika — News Intelligence Platform",
  description:
    "AI-powered news intelligence that synthesizes multiple sources into personalized, role-specific briefings. One story. Four perspectives.",
  keywords: [
    "news intelligence",
    "AI briefings",
    "synthesized news",
    "ET Patrika",
    "business news",
    "India news",
  ],
  openGraph: {
    title: "ET Patrika — News Intelligence Platform",
    description:
      "AI-powered news intelligence that synthesizes multiple sources into personalized, role-specific briefings.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} h-full`}
    >
      <body className="min-h-full flex flex-col" style={{ fontFamily: 'var(--font-body)' }}>
        <UserProvider>
          {children}
          <ToastContainer />
        </UserProvider>
      </body>
    </html>
  );
}
