"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "../components/AppNav";

type Candidate = { _id: string; fullName: string };
type Interview = {
  _id: string;
  candidateId: string;
  roundName: string;
  interviewerName: string;
  interviewAt: string;
  status: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export default function InterviewsPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ candidateId: "", roundName: "", interviewerName: "", interviewAt: "" });

  async function loadData() {
    const token = localStorage.getItem("jarvo_token");
    if (!token) return setMessage("Please login first.");
    const headers = { Authorization: `Bearer ${token}` };
    const [candidateRes, interviewRes] = await Promise.all([
      fetch(`${API_BASE_URL}/candidates`, { headers }),
      fetch(`${API_BASE_URL}/interviews`, { headers })
    ]);
    setCandidates((await candidateRes.json()).map((candidate: { _id: string; fullName: string }) => ({ _id: candidate._id, fullName: candidate.fullName })));
    setInterviews(await interviewRes.json());
  }

  useEffect(() => {
    if (!localStorage.getItem("jarvo_token")) {
      router.replace("/login");
      return;
    }
    loadData().catch(() => setMessage("Failed to load interviews."));
  }, [router]);

  async function schedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem("jarvo_token");
    if (!token) return setMessage("Please login first.");
    const response = await fetch(`${API_BASE_URL}/interviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, interviewAt: new Date(form.interviewAt).toISOString() })
    });
    if (!response.ok) return setMessage("Failed to schedule interview.");
    setForm({ candidateId: "", roundName: "", interviewerName: "", interviewAt: "" });
    await loadData();
    setMessage("Interview scheduled.");
  }

  return (
    <main className="container py-4 app-shell">
      <AppNav />
      {message ? <div className="alert alert-info py-2">{message}</div> : null}
      <div className="row g-4">
        <div className="col-12 col-lg-5">
          <div className="surface-card bg-white">
            <div className="card-body">
              <h1 className="h5 section-title mb-3">Schedule Interview</h1>
              <form className="row g-2" onSubmit={schedule}>
                <div className="col-12">
                  <select className="form-select" aria-label="Select candidate" value={form.candidateId} onChange={(e) => setForm((p) => ({ ...p, candidateId: e.target.value }))}>
                    <option value="">Select candidate</option>
                    {candidates.map((candidate) => (
                      <option key={candidate._id} value={candidate._id}>
                        {candidate.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12">
                  <input className="form-control" placeholder="Round name" value={form.roundName} onChange={(e) => setForm((p) => ({ ...p, roundName: e.target.value }))} />
                </div>
                <div className="col-12">
                  <input className="form-control" placeholder="Interviewer name" value={form.interviewerName} onChange={(e) => setForm((p) => ({ ...p, interviewerName: e.target.value }))} />
                </div>
                <div className="col-12">
                  <input className="form-control" type="datetime-local" aria-label="Interview date and time" value={form.interviewAt} onChange={(e) => setForm((p) => ({ ...p, interviewAt: e.target.value }))} />
                </div>
                <div className="col-12">
                  <button className="btn btn-primary" type="submit">Schedule</button>
                </div>
              </form>
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-7">
          <div className="surface-card bg-white">
            <div className="card-body">
              <h2 className="h5 section-title mb-3">Upcoming Interviews</h2>
              <ul className="list-group">
                {interviews.map((interview) => (
                  <li key={interview._id} className="list-group-item d-flex justify-content-between">
                    <span>{interview.roundName} · {interview.interviewerName}</span>
                    <span className="text-secondary small">{new Date(interview.interviewAt).toLocaleString()}</span>
                  </li>
                ))}
                {interviews.length === 0 ? <li className="list-group-item text-secondary">No interviews scheduled.</li> : null}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
