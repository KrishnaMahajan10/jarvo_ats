"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/candidates", label: "Candidates" },
  { href: "/interviews", label: "Interviews" }
];

export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    localStorage.removeItem("jarvo_token");
    router.replace("/login");
  }

  return (
    <div className="surface-card bg-white p-3 d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
      <div className="d-flex flex-wrap align-items-center gap-3">
        <div>
          <p className="mb-0 fw-semibold">Jarvo ATS</p>
          <small className="muted">Recruiter Workspace</small>
        </div>
        <div className="d-flex flex-wrap gap-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`btn btn-sm ${
              pathname?.startsWith(item.href) ? "btn-primary" : "btn-light border"
            }`}
          >
            {item.label}
          </Link>
        ))}
        </div>
      </div>
      <button className="btn btn-sm btn-outline-danger" onClick={logout} type="button">
        Logout
      </button>
    </div>
  );
}
