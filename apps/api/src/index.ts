import cors from "cors";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import mongoose, { Schema } from "mongoose";
import multer from "multer";
import pdfParse from "pdf-parse";
import { candidateStageSchema, createCandidateSchema, createJobSchema, UserRole } from "@jarvo/common/src";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

const mongoUrl = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/jarvo_ats";
const jwtSecret = process.env.JWT_SECRET || "dev-secret";

type RequestUser = { userId: string; role: UserRole; tenantId: string };
type AuthedRequest = Request & { user?: RequestUser };

const JobModel = mongoose.model(
  "Job",
  new Schema(
    { tenantId: String, title: String, department: String, location: String, jdText: String },
    { timestamps: true }
  )
);

const CandidateModel = mongoose.model(
  "Candidate",
  new Schema(
    {
      tenantId: String,
      fullName: String,
      email: String,
      phone: String,
      jobId: String,
      stage: String,
      skills: [String],
      atsScore: Number,
      scoreBreakdown: { keyword: Number, skill: Number, structure: Number },
      resumeSummary: String
    },
    { timestamps: true }
  )
);

function extractEmail(text: string): string {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.toLowerCase() || `candidate${Date.now()}@unknown.dev`;
}

function extractPhone(text: string): string {
  const match = text.match(/(\+?\d[\d\s-]{8,}\d)/);
  return match?.[0] || "";
}

function extractName(text: string): string {
  const firstLine = text.split("\n").map((line) => line.trim()).find((line) => line.length > 3) || "";
  const cleaned = firstLine.replace(/[^a-zA-Z\s]/g, "").trim();
  return cleaned || "Unknown Candidate";
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function computeAtsScore(resumeText: string, jdText: string) {
  const resumeWords = new Set(normalizeWords(resumeText));
  const jdWords = Array.from(new Set(normalizeWords(jdText)));
  const matched = jdWords.filter((word) => resumeWords.has(word));
  const keywordScore = jdWords.length ? Math.round((matched.length / jdWords.length) * 70) : 0;
  const skillKeywords = ["react", "next", "node", "express", "mongodb", "typescript", "javascript"];
  const matchedSkills = skillKeywords.filter((skill) => resumeWords.has(skill));
  const skillScore = Math.min(20, matchedSkills.length * 3);
  const structureScore = resumeText.length > 500 ? 10 : 5;
  const total = Math.min(100, keywordScore + skillScore + structureScore);

  return {
    total,
    skills: matchedSkills,
    breakdown: {
      keyword: keywordScore,
      skill: skillScore,
      structure: structureScore
    }
  };
}

const authMiddleware = (req: AuthedRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    req.user = jwt.verify(token, jwtSecret) as RequestUser;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

const roleGuard = (allowed: UserRole[]) => (req: AuthedRequest, res: Response, next: NextFunction) => {
  if (!req.user || !allowed.includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  return next();
};

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/auth/mock-login", (req, res) => {
  const { role = "owner", tenantId = "demo-tenant", userId = "demo-user" } = req.body || {};
  const token = jwt.sign({ role, tenantId, userId }, jwtSecret, { expiresIn: "1d" });
  res.json({ token });
});

app.post("/jobs", authMiddleware, roleGuard(["owner", "admin", "recruiter"]), async (req: AuthedRequest, res) => {
  const payload = createJobSchema.parse(req.body);
  const job = await JobModel.create({ ...payload, tenantId: req.user!.tenantId });
  res.status(201).json(job);
});

app.get("/jobs", authMiddleware, async (req: AuthedRequest, res) => {
  const jobs = await JobModel.find({ tenantId: req.user!.tenantId }).sort({ createdAt: -1 }).lean();
  res.json(jobs);
});

app.post(
  "/candidates",
  authMiddleware,
  roleGuard(["owner", "admin", "recruiter"]),
  async (req: AuthedRequest, res) => {
    const payload = createCandidateSchema.parse(req.body);
    const candidate = await CandidateModel.create({ ...payload, tenantId: req.user!.tenantId });
    res.status(201).json(candidate);
  }
);

app.get("/candidates", authMiddleware, async (req: AuthedRequest, res) => {
  const candidates = await CandidateModel.find({ tenantId: req.user!.tenantId }).sort({ createdAt: -1 }).lean();
  res.json(candidates);
});

app.post(
  "/candidates/upload-resume",
  authMiddleware,
  roleGuard(["owner", "admin", "recruiter"]),
  upload.single("resume"),
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ message: "Resume PDF is required." });
    const jobId = String(req.body?.jobId || "");
    if (!jobId) return res.status(400).json({ message: "Job is required." });

    const job = await JobModel.findOne({ _id: jobId, tenantId: req.user!.tenantId }).lean();
    if (!job) return res.status(404).json({ message: "Job not found." });

    const parsed = await pdfParse(req.file.buffer);
    const resumeText = parsed.text || "";
    const fullName = extractName(resumeText);
    const email = extractEmail(resumeText);
    const phone = extractPhone(resumeText);
    const ats = computeAtsScore(resumeText, String(job.jdText || ""));
    const resumeSummary = resumeText.trim().slice(0, 400);

    const candidate = await CandidateModel.create({
      tenantId: req.user!.tenantId,
      fullName,
      email,
      phone,
      jobId,
      stage: "applied",
      skills: ats.skills,
      atsScore: ats.total,
      scoreBreakdown: ats.breakdown,
      resumeSummary
    });

    return res.status(201).json(candidate);
  }
);

app.patch(
  "/candidates/:id/stage",
  authMiddleware,
  roleGuard(["owner", "admin", "recruiter"]),
  async (req: AuthedRequest, res) => {
    const candidateId = req.params.id;
    const stage = candidateStageSchema.parse(req.body?.stage);
    const candidate = await CandidateModel.findOneAndUpdate(
      { _id: candidateId, tenantId: req.user!.tenantId },
      { $set: { stage } },
      { new: true }
    ).lean();
    if (!candidate) return res.status(404).json({ message: "Candidate not found" });
    return res.json(candidate);
  }
);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof Error) return res.status(400).json({ message: err.message });
  return res.status(500).json({ message: "Unexpected error" });
});

const port = Number(process.env.PORT || 4000);
mongoose
  .connect(mongoUrl)
  .then(() => {
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`API running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("MongoDB connection failed", error);
    process.exit(1);
  });
