"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Job = {
  _id: string;
  title: string;
  department: string;
  location: string;
  jdText: string;
};

type Candidate = {
  _id: string;
  fullName: string;
  email: string;
  jobId: string;
  stage: string;
  phone?: string;
  skills?: string[];
  atsScore?: number;
  scoreSummary?: string;
  scoreBreakdown?: { required: number; optional: number; experience: number; structure: number };
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export default function HomePage() {
  const [token, setToken] = useState<string>("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [message, setMessage] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");
  const [stageFilter, setStageFilter] = useState<string>("all");

  const [jobForm, setJobForm] = useState({ title: "", department: "", location: "", jdText: "" });
  const [candidateForm, setCandidateForm] = useState({
    fullName: "",
    email: "",
    jobId: "",
    stage: "applied"
  });
  const [resumeJobId, setResumeJobId] = useState<string>("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const roleStats = useMemo(() => {
    const applied = candidates.filter((candidate) => candidate.stage === "applied").length;
    const interview = candidates.filter((candidate) => candidate.stage === "interview").length;
    const offer = candidates.filter((candidate) => candidate.stage === "offer").length;
    return { applied, interview, offer };
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((candidate) => {
      const matchesSearch =
        candidate.fullName.toLowerCase().includes(searchText.toLowerCase()) ||
        candidate.email.toLowerCase().includes(searchText.toLowerCase());
      const matchesStage = stageFilter === "all" || candidate.stage === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [candidates, searchText, stageFilter]);

  const stageBoard = useMemo(() => {
    const order = ["applied", "screening", "interview", "offer", "hired", "rejected"];
    return order.map((stage) => ({
      stage,
      candidates: candidates.filter((candidate) => candidate.stage === stage).slice(0, 4)
    }));
  }, [candidates]);

  useEffect(() => {
    const savedToken = typeof window !== "undefined" ? localStorage.getItem("jarvo_token") : null;
    if (savedToken) setToken(savedToken);
  }, []);

  async function loginAsRecruiter() {
    const response = await fetch(`${API_BASE_URL}/auth/mock-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "recruiter", tenantId: "demo-tenant" })
    });
    const data = await response.json();
    setToken(data.token);
    localStorage.setItem("jarvo_token", data.token);
    setMessage("Logged in as recruiter.");
  }

  async function fetchData(authToken: string) {
    const headers = { Authorization: `Bearer ${authToken}` };
    const [jobsResponse, candidatesResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/jobs`, { headers }),
      fetch(`${API_BASE_URL}/candidates`, { headers })
    ]);
    setJobs(await jobsResponse.json());
    setCandidates(await candidatesResponse.json());
  }

  useEffect(() => {
    if (!token) return;
    fetchData(token).catch(() => setMessage("Could not fetch data from API."));
  }, [token]);

  async function createJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return setMessage("Login first.");
    if (!jobForm.title.trim() || !jobForm.department.trim() || !jobForm.location.trim()) {
      return setMessage("Please fill title, department, and location.");
    }
    if (jobForm.jdText.trim().length < 20) {
      return setMessage("Please add a JD with at least 20 characters.");
    }
    try {
      setMessage("Saving job...");
      const response = await fetch(`${API_BASE_URL}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(jobForm)
      });
      if (!response.ok) {
        const errorBody = await response.text();
        return setMessage(`Failed to create job (${response.status}): ${errorBody || "Unknown error"}`);
      }
      setJobForm({ title: "", department: "", location: "", jdText: "" });
      await fetchData(token);
      setMessage("Job created successfully.");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Network error";
      setMessage(`Job save failed: ${reason}`);
    }
  }

  async function createCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return setMessage("Login first.");
    try {
      setMessage("Saving candidate...");
      const response = await fetch(`${API_BASE_URL}/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(candidateForm)
      });
      if (!response.ok) {
        const errorBody = await response.text();
        return setMessage(`Failed to create candidate (${response.status}): ${errorBody || "Unknown error"}`);
      }
      setCandidateForm({ fullName: "", email: "", jobId: "", stage: "applied" });
      await fetchData(token);
      setMessage("Candidate created successfully.");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Network error";
      setMessage(`Candidate save failed: ${reason}`);
    }
  }

  async function updateCandidateStage(candidateId: string, stage: string) {
    if (!token) return setMessage("Login first.");
    const response = await fetch(`${API_BASE_URL}/candidates/${candidateId}/stage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ stage })
    });
    if (!response.ok) return setMessage("Failed to update candidate stage.");
    await fetchData(token);
    setMessage("Candidate stage updated.");
  }

  async function uploadResumeForScoring(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return setMessage("Login first.");
    if (!resumeJobId || !resumeFile) return setMessage("Select job and PDF resume.");

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
    await fetchData(token);
    setMessage("Resume parsed and ATS profile created.");
  }

  return (
    <main className="dashboard-shell py-4">
      <div className="container-fluid">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
          <div>
            <h1 className="h2 mb-1">Jarvo ATS</h1>
            <p className="text-secondary mb-0">Bootstrap dashboard connected to Express + MongoDB.</p>
          </div>
          <button className="btn btn-primary" onClick={loginAsRecruiter} type="button">
            Login (Recruiter)
          </button>
        </div>

        {message ? <div className="alert alert-info py-2">{message}</div> : null}

        <div className="row g-3 mb-4">
          <div className="col-6 col-lg-3">
            <div className="card metric-card shadow-sm">
              <div className="card-body">
                <p className="text-secondary mb-1">Open Roles</p>
                <h3 className="mb-0">{jobs.length}</h3>
              </div>
            </div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="card metric-card shadow-sm">
              <div className="card-body">
                <p className="text-secondary mb-1">Candidates</p>
                <h3 className="mb-0">{candidates.length}</h3>
              </div>
            </div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="card metric-card shadow-sm">
              <div className="card-body">
                <p className="text-secondary mb-1">Interview Stage</p>
                <h3 className="mb-0">{roleStats.interview}</h3>
              </div>
            </div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="card metric-card shadow-sm">
              <div className="card-body">
                <p className="text-secondary mb-1">Offers</p>
                <h3 className="mb-0">{roleStats.offer}</h3>
              </div>
            </div>
          </div>
        </div>

        <div className="card shadow-sm mb-4">
          <div className="card-body">
            <h2 className="h5 mb-3">Pipeline Board</h2>
            <div className="row g-3">
              {stageBoard.map((column) => (
                <div className="col-6 col-md-4 col-xl-2" key={column.stage}>
                  <div className="border rounded p-2 h-100 bg-light-subtle">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="text-capitalize fw-semibold">{column.stage}</span>
                      <span className="badge text-bg-secondary">{column.candidates.length}</span>
                    </div>
                    {column.candidates.length === 0 ? (
                      <p className="text-secondary small mb-0">No candidates</p>
                    ) : (
                      column.candidates.map((candidate) => (
                        <Link
                          key={candidate._id}
                          href={`/candidates/${candidate._id}`}
                          className="d-block text-decoration-none border rounded p-2 mb-2 bg-white"
                        >
                          <p className="mb-1 text-dark fw-medium">{candidate.fullName}</p>
                          <p className="mb-0 small text-secondary">ATS {candidate.atsScore ?? "--"}</p>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="row g-4">
          <div className="col-12 col-xxl-2">
            <div className="card shadow-sm">
              <div className="card-body">
                <p className="text-uppercase text-secondary small mb-2">Navigation</p>
                <div className="list-group">
                  <span className="list-group-item list-group-item-action active">Dashboard</span>
                  <span className="list-group-item list-group-item-action">Jobs</span>
                  <span className="list-group-item list-group-item-action">Candidates</span>
                  <span className="list-group-item list-group-item-action">Interviews</span>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-xxl-6">
            <div className="card shadow-sm mb-4">
              <div className="card-body">
                <h2 className="h5 mb-3">Create Job</h2>
                <form className="row g-2" onSubmit={createJob}>
                  <div className="col-md-4">
                    <input
                      className="form-control"
                      value={jobForm.title}
                      onChange={(event) => setJobForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Title"
                    />
                  </div>
                  <div className="col-md-4">
                    <input
                      className="form-control"
                      value={jobForm.department}
                      onChange={(event) => setJobForm((prev) => ({ ...prev, department: event.target.value }))}
                      placeholder="Department"
                    />
                  </div>
                  <div className="col-md-4">
                    <input
                      className="form-control"
                      value={jobForm.location}
                      onChange={(event) => setJobForm((prev) => ({ ...prev, location: event.target.value }))}
                      placeholder="Location"
                    />
                  </div>
                  <div className="col-12">
                    <textarea
                      className="form-control"
                      rows={4}
                      value={jobForm.jdText}
                      onChange={(event) => setJobForm((prev) => ({ ...prev, jdText: event.target.value }))}
                      placeholder="Paste full Job Description (JD)"
                    />
                  </div>
                  <div className="col-12">
                    <button className="btn btn-outline-primary" type="submit">
                      Save Job
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="card shadow-sm">
              <div className="card-body">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                  <h2 className="h5 mb-0">Candidates</h2>
                  <div className="d-flex gap-2">
                    <input
                      className="form-control"
                      placeholder="Search name or email"
                      value={searchText}
                      onChange={(event) => setSearchText(event.target.value)}
                    />
                    <select
                      className="form-select"
                      aria-label="Filter candidates by stage"
                      value={stageFilter}
                      onChange={(event) => setStageFilter(event.target.value)}
                    >
                      <option value="all">All stages</option>
                      <option value="applied">Applied</option>
                      <option value="screening">Screening</option>
                      <option value="interview">Interview</option>
                      <option value="offer">Offer</option>
                      <option value="hired">Hired</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table table-striped align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Stage</th>
                        <th>ATS</th>
                        <th className="text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCandidates.length === 0 ? (
                        <tr>
                          <td className="text-secondary" colSpan={5}>
                            No matching candidates. Try changing filters or add one from the form.
                          </td>
                        </tr>
                      ) : (
                        filteredCandidates.map((candidate) => (
                          <tr key={candidate._id}>
                            <td>
                              <Link href={`/candidates/${candidate._id}`} className="text-decoration-none fw-semibold">
                                {candidate.fullName}
                              </Link>
                            </td>
                            <td>{candidate.email}</td>
                            <td>
                              <span className="badge text-bg-light border chip-badge">{candidate.stage}</span>
                            </td>
                            <td>
                              <span className="badge text-bg-primary">{candidate.atsScore ?? "--"}</span>
                            </td>
                            <td className="text-end">
                              <select
                                className="form-select form-select-sm d-inline-block w-auto"
                                aria-label={`Update stage for ${candidate.fullName}`}
                                value={candidate.stage}
                                onChange={(event) => updateCandidateStage(candidate._id, event.target.value)}
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
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-xxl-4">
            <div className="card shadow-sm">
              <div className="card-body">
                <h2 className="h5 mb-3">Create Candidate</h2>
                <form className="row g-2" onSubmit={createCandidate}>
                  <div className="col-12">
                    <input
                      className="form-control"
                      value={candidateForm.fullName}
                      onChange={(event) =>
                        setCandidateForm((prev) => ({ ...prev, fullName: event.target.value }))
                      }
                      placeholder="Full name"
                      required
                    />
                  </div>
                  <div className="col-12">
                    <input
                      className="form-control"
                      type="email"
                      value={candidateForm.email}
                      onChange={(event) => setCandidateForm((prev) => ({ ...prev, email: event.target.value }))}
                      placeholder="Email"
                      required
                    />
                  </div>
                  <div className="col-12">
                    <select
                      className="form-select"
                      aria-label="Select job for candidate"
                      value={candidateForm.jobId}
                      onChange={(event) => setCandidateForm((prev) => ({ ...prev, jobId: event.target.value }))}
                      required
                    >
                      <option value="">Select job</option>
                      {jobs.map((job) => (
                        <option key={job._id} value={job._id}>
                          {job.title} - {job.department}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <select
                      className="form-select"
                      aria-label="Select candidate stage"
                      value={candidateForm.stage}
                      onChange={(event) => setCandidateForm((prev) => ({ ...prev, stage: event.target.value }))}
                    >
                      <option value="applied">Applied</option>
                      <option value="screening">Screening</option>
                      <option value="interview">Interview</option>
                      <option value="offer">Offer</option>
                      <option value="hired">Hired</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <button className="btn btn-success" type="submit">
                      Save Candidate
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="card shadow-sm mt-4">
              <div className="card-body">
                <h2 className="h5 mb-3">Upload Resume (PDF) + ATS Score</h2>
                <form className="row g-2" onSubmit={uploadResumeForScoring}>
                  <div className="col-12">
                    <select
                      className="form-select"
                      aria-label="Select job for resume scoring"
                      value={resumeJobId}
                      onChange={(event) => setResumeJobId(event.target.value)}
                      required
                    >
                      <option value="">Select target job</option>
                      {jobs.map((job) => (
                        <option key={job._id} value={job._id}>
                          {job.title} - {job.department}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <input
                      className="form-control"
                      type="file"
                      accept="application/pdf"
                      aria-label="Upload candidate resume PDF"
                      onChange={(event) => setResumeFile(event.target.files?.[0] || null)}
                      required
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

            <div className="card shadow-sm mt-4">
              <div className="card-body">
                <h2 className="h5 mb-3">Pipeline Snapshot</h2>
                <ul className="list-group">
                  <li className="list-group-item d-flex justify-content-between">
                    <span>Applied</span>
                    <strong>{roleStats.applied}</strong>
                  </li>
                  <li className="list-group-item d-flex justify-content-between">
                    <span>Interview</span>
                    <strong>{roleStats.interview}</strong>
                  </li>
                  <li className="list-group-item d-flex justify-content-between">
                    <span>Offer</span>
                    <strong>{roleStats.offer}</strong>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
