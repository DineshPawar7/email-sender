import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Member import",
  description: "Upload an Excel sheet and import members in the background",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
