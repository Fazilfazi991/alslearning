import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: { default: "ALS — Academy for Laboratory Science", template: "%s | ALS Academy" },
  description: "Expert-led laboratory science education for confident clinical practice.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={jakarta.variable}><body>{children}</body></html>;
}
