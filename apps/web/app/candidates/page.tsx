"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "../components/AppNav";

type Candidate = {
  _id: string;
  fullName: string;
  email: string;
  stage: string;
  atsScore?: number;
};

type Job = {
  _id: string;
  title: string;
  department: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export default function CandidatesPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [message, setMessage] = useState("");
  const [resumeJobId, setResumeJobId] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  async function loadData() {
    const token = localStorage.getItem("jarvo_token");
    if (!token) return setMessage("Please login first.");
    const headers = { Authorization: `Bearer ${token}` };
    const [candidateResponse, jobsResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/candidates`, { headers }),
      fetch(`${API_BASE_URL}/jobs`, { headers })
    ]);
    setCandidates(await candidateResponse.json());
    setJobs(await jobsResponse.json());
  }

  useEffect(() => {
    if (!localStorage.getItem("jarvo_token")) {
      router.replace("/login");
      return;
    }
    loadData().catch(() => setMessage("Failed to load candidates."));
  }, [router]);

  async function updateStage(candidateId: string, stage: string) {
    const token = localStorage.getItem("jarvo_token");
    if (!token) return setMessage("Please login first.");
    const response = await fetch(`${API_BASE_URL}/candidates/${candidateId}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ stage })
    });
    if (!response.ok) return setMessage("Failed to update stage.");
    await loadData();
  }

  async function uploadResumeForScoring(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = localStorage.getItem("jarvo_token");
    if (!token) return setMessage("Please login first.");
    if (!resumeJobId || !resumeFile) return setMessage("Select job and resume file.");
    const formData = new FormData();
    formData.append("jobId", resumeJobId);
    formData.append("resume", resumeFile);

    const response = await fetch(`${API_BASE_URL}/candidates/upload-resume`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    if (!response.ok) return setMessage("Resume processing failed.");
    setResumeFile(null);
    await loadData();
    setMessage("Resume uploaded and ATS score generated.");
  }

  return (
    <main className="container py-4 app-shell">
      <AppNav />
      {message ? <div className="alert alert-info py-2">{message}</div> : null}
      <div className="surface-card bg-white mb-4">
        <div className="card-body">
          <h2 className="h5 section-title mb-3">Upload Resume (PDF/DOC/DOCX) + ATS Score</h2>
          <form className="row g-2" onSubmit={uploadResumeForScoring}>
            <div className="col-12 col-md-6">
              <select
                className="form-select"
                aria-label="Select target job for resume upload"
                value={resumeJobId}
                onChange={(event) => setResumeJobId(event.target.value)}
              >
                <option value="">Select target job</option>
                {jobs.map((job) => (
                  <option key={job._id} value={job._id}>
                    {job.title} - {job.department}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6">
              <input
                className="form-control"
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                aria-label="Upload resume file"
                onChange={(event) => setResumeFile(event.target.files?.[0] || null)}
              />
            </div>
            <div className="col-12">
              <button className="btn btn-primary" type="submit">
                Upload and Score
              </button>
            </div>
          </form>
        </div>
      </div>

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
                  <th className="text-end">Action</th>
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
                    <td className="text-end">
                      <button
                        className="btn btn-sm btn-outline-danger"
                        type="button"
                        onClick={async () => {
                          const confirmed = window.confirm(
                            `Delete candidate ${candidate.fullName}? This cannot be undone.`
                          );
                          if (!confirmed) return;
                          const token = localStorage.getItem("jarvo_token");
                          if (!token) return setMessage("Please login first.");
                          const response = await fetch(`${API_BASE_URL}/candidates/${candidate._id}`, {
                            method: "DELETE",
                            headers: { Authorization: `Bearer ${token}` }
                          });
                          if (!response.ok) return setMessage("Failed to delete candidate.");
                          await loadData();
                          setMessage("Candidate deleted.");
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {candidates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-secondary">
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
