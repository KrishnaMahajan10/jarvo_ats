"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "../components/AppNav";

type Job = { _id: string };
type Candidate = { _id: string; stage: string };
type Interview = { _id: string };

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export default function DashboardRoutePage() {
  const router = useRouter();
  const [stats, setStats] = useState({ jobs: 0, candidates: 0, interviews: 0, interviewStage: 0 });
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("jarvo_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API_BASE_URL}/jobs`, { headers }),
      fetch(`${API_BASE_URL}/candidates`, { headers }),
      fetch(`${API_BASE_URL}/interviews`, { headers })
    ])
      .then(async ([jobsRes, candidatesRes, interviewsRes]) => {
        const jobs = (await jobsRes.json()) as Job[];
        const candidates = (await candidatesRes.json()) as Candidate[];
        const interviews = (await interviewsRes.json()) as Interview[];
        setStats({
          jobs: jobs.length,
          candidates: candidates.length,
          interviews: interviews.length,
          interviewStage: candidates.filter((candidate) => candidate.stage === "interview").length
        });
      })
      .catch(() => setMessage("Could not load dashboard analytics."));
  }, [router]);

  return (
    <main className="container py-4 app-shell">
      <AppNav />
      {message ? <div className="alert alert-info">{message}</div> : null}

      <section className="surface-card bg-white p-4 mb-4">
        <h1 className="section-title h3 mb-1">Recruiter Dashboard</h1>
        <p className="muted mb-0">Track hiring progress, evaluate profiles, and move candidates faster.</p>
      </section>

      <section className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <article className="metric-card bg-white p-3">
            <p className="muted mb-1">Open Jobs</p>
            <h2 className="h4 mb-0">{stats.jobs}</h2>
          </article>
        </div>
        <div className="col-6 col-lg-3">
          <article className="metric-card bg-white p-3">
            <p className="muted mb-1">Candidates</p>
            <h2 className="h4 mb-0">{stats.candidates}</h2>
          </article>
        </div>
        <div className="col-6 col-lg-3">
          <article className="metric-card bg-white p-3">
            <p className="muted mb-1">In Interview</p>
            <h2 className="h4 mb-0">{stats.interviewStage}</h2>
          </article>
        </div>
        <div className="col-6 col-lg-3">
          <article className="metric-card bg-white p-3">
            <p className="muted mb-1">Scheduled Interviews</p>
            <h2 className="h4 mb-0">{stats.interviews}</h2>
          </article>
        </div>
      </section>

      <section className="surface-card bg-white p-4">
        <h3 className="h5 mb-3">Quick Actions</h3>
        <div className="d-flex flex-wrap gap-2">
          <Link href="/jobs" className="btn btn-primary">
            Create or Manage Jobs
          </Link>
          <Link href="/candidates" className="btn btn-outline-primary">
            Review Candidates
          </Link>
          <Link href="/interviews" className="btn btn-outline-primary">
            Schedule Interviews
          </Link>
        </div>
      </section>
    </main>
  );
}
