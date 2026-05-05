import "./globals.css";
import "bootstrap/dist/css/bootstrap.css";
import { ReactNode } from "react";

export const metadata = {
  title: "Jarvo ATS",
  description: "Professional applicant tracking system"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
