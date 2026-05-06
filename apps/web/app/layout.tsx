import "./globals.css";
import "bootstrap/dist/css/bootstrap.css";
import { ReactNode } from "react";
import ServiceWorkerCleanup from "./sw-cleanup";

export const metadata = {
  title: "Jarvo ATS",
  description: "Professional applicant tracking system"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body data-bs-theme="dark">
        <ServiceWorkerCleanup />
        {children}
      </body>
    </html>
  );
}
