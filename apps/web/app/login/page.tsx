"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState("recruiter");
  const [tenantId, setTenantId] = useState("demo-tenant");
  const [message, setMessage] = useState("");

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Signing in...");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/mock-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, tenantId })
      });
      if (!response.ok) {
        setMessage("Login failed.");
        return;
      }
      const data = await response.json();
      localStorage.setItem("jarvo_token", data.token);
      router.replace("/");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Network error";
      setMessage(`Login failed: ${reason}`);
    }
  }

  return (
    <main className="container py-5">
      <div className="row justify-content-center">
        <div className="col-12 col-md-7 col-lg-5">
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <h1 className="h3 mb-1">Jarvo ATS</h1>
              <p className="text-secondary mb-4">Sign in as recruiter to continue.</p>
              <form className="row g-3" onSubmit={login}>
                <div className="col-12">
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    aria-label="Select user role"
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="recruiter">Recruiter</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label">Workspace/Tenant ID</label>
                  <input
                    className="form-control"
                    value={tenantId}
                    onChange={(event) => setTenantId(event.target.value)}
                    placeholder="demo-tenant"
                  />
                </div>
                <div className="col-12">
                  <button className="btn btn-primary w-100" type="submit">
                    Sign In
                  </button>
                </div>
              </form>
              {message ? <p className="text-secondary small mt-3 mb-0">{message}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
