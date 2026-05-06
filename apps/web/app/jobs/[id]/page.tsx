"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type RankedCandidate = {
  _id: string;
  fullName: string;
  email: string;
  stage: string;
  atsScore?: number;
};

type JobDetailResponse = {
  job: {
    _id: string;
    title: string;
    department: string;
    location: string;
    jdText: string;
  };
  rankedCandidates: RankedCandidate[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [data, setData] = useState<JobDetailResponse | null>(null);
  const [message, setMessage] = useState("Loading job details...");

  useEffect(() => {
    const token = localStorage.getItem("jarvo_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    fetch(`${API_BASE_URL}/jobs/${params.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load job details.");
        return response.json();
      })
      .then((payload) => {
        setData(payload);
        setMessage("");
      })
      .catch((error: Error) => setMessage(error.message));
  }, [params.id, router]);

  if (!data) {
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
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h1 className="h3 mb-1">{data.job.title}</h1>
          <p className="text-secondary mb-2">
            {data.job.department} · {data.job.location}
          </p>
          <h2 className="h6">Job Description</h2>
          <p className="text-secondary mb-0">{data.job.jdText}</p>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-body">
          <h2 className="h5 mb-3">Top Ranked Candidates</h2>
          {data.rankedCandidates.length === 0 ? (
            <p className="text-secondary mb-0">No candidates mapped to this job yet.</p>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Stage</th>
                    <th>ATS</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rankedCandidates.map((candidate) => (
                    <tr key={candidate._id}>
                      <td>
                        <Link href={`/candidates/${candidate._id}`} className="text-decoration-none fw-semibold">
                          {candidate.fullName}
                        </Link>
                      </td>
                      <td>{candidate.email}</td>
                      <td className="text-capitalize">{candidate.stage}</td>
                      <td>
                        <span className="badge text-bg-primary">{candidate.atsScore ?? "--"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
