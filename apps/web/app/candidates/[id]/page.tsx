"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type CandidateDetail = {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  stage: string;
  atsScore?: number;
  skills?: string[];
  scoreSummary?: string;
  scoreBreakdown?: { required: number; optional: number; experience: number; structure: number };
  resumeSummary?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export default function CandidateDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [message, setMessage] = useState("Loading candidate profile...");

  useEffect(() => {
    const token = localStorage.getItem("jarvo_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    fetch(`${API_BASE_URL}/candidates/${params.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to load candidate.");
        }
        return response.json();
      })
      .then((data) => {
        setCandidate(data);
        setMessage("");
      })
      .catch((error: Error) => setMessage(error.message));
  }, [params.id, router]);

  if (!candidate) {
    return (
      <main className="container py-4">
        <Link href="/" className="btn btn-link ps-0">
          ← Back to dashboard
        </Link>
        <div className="alert alert-info">{message}</div>
      </main>
    );
  }

  return (
    <main className="container py-4">
      <Link href="/" className="btn btn-link ps-0">
        ← Back to dashboard
      </Link>
      <div className="card shadow-sm">
        <div className="card-body">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div>
              <h1 className="h3 mb-1">{candidate.fullName}</h1>
              <p className="text-secondary mb-1">{candidate.email}</p>
              <p className="text-secondary mb-0">{candidate.phone || "Phone not extracted"}</p>
            </div>
            <div className="text-end">
              <span className="badge text-bg-primary fs-6">ATS {candidate.atsScore ?? "--"}</span>
              <p className="text-capitalize mt-2 mb-0">{candidate.stage}</p>
            </div>
          </div>

          <hr />
          <h2 className="h5">ATS Explanation</h2>
          <p className="text-secondary">{candidate.scoreSummary || "No AI/rule explanation available yet."}</p>

          <div className="row g-3">
            <div className="col-6 col-lg-3">
              <div className="border rounded p-3">
                <p className="text-secondary mb-1">Required Skills</p>
                <strong>{candidate.scoreBreakdown?.required ?? 0}</strong>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="border rounded p-3">
                <p className="text-secondary mb-1">Optional Skills</p>
                <strong>{candidate.scoreBreakdown?.optional ?? 0}</strong>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="border rounded p-3">
                <p className="text-secondary mb-1">Experience</p>
                <strong>{candidate.scoreBreakdown?.experience ?? 0}</strong>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="border rounded p-3">
                <p className="text-secondary mb-1">Structure</p>
                <strong>{candidate.scoreBreakdown?.structure ?? 0}</strong>
              </div>
            </div>
          </div>

          <h3 className="h6 mt-4">Extracted Skills</h3>
          <div className="d-flex flex-wrap gap-2">
            {candidate.skills?.length ? (
              candidate.skills.map((skill) => (
                <span key={skill} className="badge text-bg-light border">
                  {skill}
                </span>
              ))
            ) : (
              <span className="text-secondary">No skill keywords matched.</span>
            )}
          </div>

          <h3 className="h6 mt-4">Resume Summary</h3>
          <p className="text-secondary mb-0">{candidate.resumeSummary || "No summary found."}</p>
        </div>
      </div>
    </main>
  );
}
