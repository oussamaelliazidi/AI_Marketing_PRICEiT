import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRICEIT — Construction Pricing Platform",
  description: "Price every job accurately in minutes. Join the beta.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
