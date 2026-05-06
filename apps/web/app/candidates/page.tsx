"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppNav from "../components/AppNav";

type Candidate = {
  _id: string;
  fullName: string;
  email: string;
  stage: string;
  atsScore?: number;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [message, setMessage] = useState("");

  async function loadCandidates() {
    const token = localStorage.getItem("jarvo_token");
    if (!token) return setMessage("Please login first.");
    const response = await fetch(`${API_BASE_URL}/candidates`, { headers: { Authorization: `Bearer ${token}` } });
    setCandidates(await response.json());
  }

  useEffect(() => {
    loadCandidates().catch(() => setMessage("Failed to load candidates."));
  }, []);

  async function updateStage(candidateId: string, stage: string) {
    const token = localStorage.getItem("jarvo_token");
    if (!token) return setMessage("Please login first.");
    const response = await fetch(`${API_BASE_URL}/candidates/${candidateId}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ stage })
    });
    if (!response.ok) return setMessage("Failed to update stage.");
    await loadCandidates();
  }

  return (
    <main className="container py-4 app-shell">
      <AppNav />
      {message ? <div className="alert alert-info py-2">{message}</div> : null}
      <div className="surface-card bg-white">
        <div className="card-body">
          <h1 className="h5 section-title mb-3">Candidates</h1>
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>ATS</th>
                  <th>Stage</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => (
                  <tr key={candidate._id}>
                    <td>
                      <Link href={`/candidates/${candidate._id}`} className="text-decoration-none fw-semibold">
                        {candidate.fullName}
                      </Link>
                    </td>
                    <td>{candidate.email}</td>
                    <td>{candidate.atsScore ?? "--"}</td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        aria-label={`Update stage for ${candidate.fullName}`}
                        value={candidate.stage}
                        onChange={(event) => updateStage(candidate._id, event.target.value)}
                      >
                        <option value="applied">Applied</option>
                        <option value="screening">Screening</option>
                        <option value="interview">Interview</option>
                        <option value="offer">Offer</option>
                        <option value="hired">Hired</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {candidates.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-secondary">
                      No candidates found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
