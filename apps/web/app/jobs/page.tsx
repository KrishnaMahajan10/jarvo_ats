"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "../components/AppNav";

type Job = {
  _id: string;
  title: string;
  department: string;
  location: string;
  jdText: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ title: "", department: "", location: "", jdText: "" });

  async function loadJobs() {
    const token = localStorage.getItem("jarvo_token");
    if (!token) {
      setMessage("Please login first.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/jobs`, { headers: { Authorization: `Bearer ${token}` } });
    setJobs(await response.json());
  }

  useEffect(() => {
    if (!localStorage.getItem("jarvo_token")) {
      router.replace("/login");
      return;
    }
    loadJobs().catch(() => setMessage("Failed to load jobs."));
  }, [router]);

  async function createJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem("jarvo_token");
    if (!token) return setMessage("Please login first.");
    const response = await fetch(`${API_BASE_URL}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form)
    });
    if (!response.ok) return setMessage("Failed to create job.");
    setForm({ title: "", department: "", location: "", jdText: "" });
    await loadJobs();
    setMessage("Job created.");
  }

  return (
    <main className="container py-4 app-shell">
      <AppNav />
      {message ? <div className="alert alert-info py-2">{message}</div> : null}
      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <div className="surface-card bg-white">
            <div className="card-body">
              <h1 className="h5 section-title mb-3">Create Job</h1>
              <form className="row g-2" onSubmit={createJob}>
                <div className="col-12">
                  <input className="form-control" placeholder="Title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
                </div>
                <div className="col-6">
                  <input className="form-control" placeholder="Department" value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} />
                </div>
                <div className="col-6">
                  <input className="form-control" placeholder="Location" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
                </div>
                <div className="col-12">
                  <textarea className="form-control" rows={4} placeholder="Job Description" value={form.jdText} onChange={(e) => setForm((p) => ({ ...p, jdText: e.target.value }))} />
                </div>
                <div className="col-12">
                  <button className="btn btn-primary" type="submit">Save Job</button>
                </div>
              </form>
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="surface-card bg-white">
            <div className="card-body">
              <h2 className="h5 section-title mb-3">All Jobs</h2>
              <div className="list-group">
                {jobs.map((job) => (
                  <Link key={job._id} href={`/jobs/${job._id}`} className="list-group-item list-group-item-action">
                    <div className="fw-semibold">{job.title}</div>
                    <small className="text-secondary">{job.department} · {job.location}</small>
                  </Link>
                ))}
                {jobs.length === 0 ? <p className="text-secondary mb-0">No jobs yet.</p> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
