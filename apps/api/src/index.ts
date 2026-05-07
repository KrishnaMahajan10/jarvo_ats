import cors from "cors";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import mammoth from "mammoth";
import mongoose, { Schema } from "mongoose";
import multer from "multer";
import pdfParse from "pdf-parse";
import {
  candidateStageSchema,
  createCandidateSchema,
  createInterviewSchema,
  createJobSchema,
  UserRole
} from "@jarvo/common/src";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, callback) => {
    const lower = file.originalname.toLowerCase();
    const isAllowed = lower.endsWith(".pdf") || lower.endsWith(".docx") || lower.endsWith(".doc");
    if (!isAllowed) {
      callback(new Error("Only PDF, DOC, and DOCX files are allowed."));
      return;
    }
    callback(null, true);
  }
});

const mongoUrl = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/jarvo_ats";
const jwtSecret = process.env.JWT_SECRET || "dev-secret";
const grokApiKey = process.env.GROK_API_KEY || "";
const grokModel = process.env.GROK_MODEL || "grok-3-mini";

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
      scoreBreakdown: { required: Number, optional: Number, experience: Number, structure: Number },
      scoreSummary: String,
      aiOverview: String,
      matchedKeywords: [String],
      missingKeywords: [String],
      laggingAreas: [String],
      improvementActions: [String],
      resumeRewriteTips: [String],
      aiUsed: Boolean,
      aiSource: String,
      aiFailureReason: String,
      resumeSummary: String
    },
    { timestamps: true }
  )
);

const InterviewModel = mongoose.model(
  "Interview",
  new Schema(
    {
      tenantId: String,
      candidateId: String,
      roundName: String,
      interviewerName: String,
      interviewAt: String,
      status: String,
      feedback: String
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

type AtsScoreResult = {
  total: number;
  skills: string[];
  summary: string;
  breakdown: { required: number; optional: number; experience: number; structure: number };
  matchedKeywords: string[];
  missingKeywords: string[];
};

type AiOverviewResult = {
  aiOverview: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  laggingAreas: string[];
  improvementActions: string[];
  resumeRewriteTips: string[];
  aiUsed: boolean;
  aiSource: "grok" | "fallback";
  aiFailureReason?: string;
};

function computeAtsScore(resumeText: string, jdText: string): AtsScoreResult {
  const resumeWords = new Set(normalizeWords(resumeText));
  const jdWords = Array.from(new Set(normalizeWords(jdText)));
  const requiredKeywords = [
    "react",
    "next",
    "node",
    "express",
    "mongodb",
    "typescript",
    "javascript",
    "rest",
    "api"
  ];
  const optionalKeywords = ["azure", "docker", "kubernetes", "redis", "graphql", "testing", "jest", "ci"];
  const requiredInJd = requiredKeywords.filter((word) => jdWords.includes(word));
  const optionalInJd = optionalKeywords.filter((word) => jdWords.includes(word));
  const matchedRequired = requiredInJd.filter((word) => resumeWords.has(word));
  const matchedOptional = optionalInJd.filter((word) => resumeWords.has(word));
  const requiredScore = requiredInJd.length ? Math.round((matchedRequired.length / requiredInJd.length) * 55) : 30;
  const optionalScore = optionalInJd.length ? Math.round((matchedOptional.length / optionalInJd.length) * 20) : 10;
  const experienceMatch = resumeText.match(/(\d+)\+?\s*(years|yrs|year)/i);
  const years = experienceMatch ? Number(experienceMatch[1]) : 0;
  const experienceScore = years >= 3 ? 15 : years >= 1 ? 10 : 4;
  const skillKeywords = ["react", "next", "node", "express", "mongodb", "typescript", "javascript"];
  const matchedSkills = skillKeywords.filter((skill) => resumeWords.has(skill));
  const structureScore = resumeText.length > 700 ? 10 : resumeText.length > 400 ? 7 : 4;
  const total = Math.min(100, requiredScore + optionalScore + experienceScore + structureScore);
  const missingRequired = requiredInJd.filter((word) => !resumeWords.has(word));
  const summary =
    missingRequired.length === 0
      ? "Strong fit with required stack alignment."
      : `Needs improvement in: ${missingRequired.slice(0, 4).join(", ")}.`;

  return {
    total,
    skills: matchedSkills,
    summary,
    matchedKeywords: [...matchedRequired, ...matchedOptional],
    missingKeywords: missingRequired,
    breakdown: {
      required: requiredScore,
      optional: optionalScore,
      experience: experienceScore,
      structure: structureScore
    }
  };
}

function chunkText(text: string, maxChunks = 8): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [""];
  const chunkSize = Math.max(1800, Math.ceil(trimmed.length / maxChunks));
  const chunks: string[] = [];

  for (let i = 0; i < trimmed.length; i += chunkSize) {
    chunks.push(trimmed.slice(i, i + chunkSize));
  }

  return chunks;
}

function extractSkillSignals(text: string): string[] {
  const normalized = ` ${text.toLowerCase()} `;
  const catalog = [
    "react",
    "next.js",
    "node.js",
    "express",
    "mongodb",
    "typescript",
    "javascript",
    "rest api",
    "graphql",
    "docker",
    "kubernetes",
    "redis",
    "postgresql",
    "mysql",
    "aws",
    "azure",
    "gcp",
    "ci/cd",
    "jest",
    "playwright",
    "cypress",
    "python",
    "java",
    "go",
    "microservices"
  ];
  return catalog.filter((skill) => normalized.includes(` ${skill.toLowerCase()} `));
}

async function callGrok(messages: Array<{ role: "system" | "user"; content: string }>): Promise<string> {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${grokApiKey}`
    },
    body: JSON.stringify({
      model: grokModel,
      temperature: 0.2,
      messages
    })
  });

  if (!response.ok) {
    throw new Error(`Grok request failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content?.trim() || "";
  if (!raw) {
    throw new Error("Grok returned empty response.");
  }
  return raw;
}

async function generateGrokOverview(
  resumeText: string,
  jdText: string,
  ruleScore: AtsScoreResult
): Promise<AiOverviewResult> {
  const fallback = (reason?: string): AiOverviewResult => ({
    aiOverview: ruleScore.summary,
    matchedKeywords: ruleScore.matchedKeywords,
    missingKeywords: ruleScore.missingKeywords,
    laggingAreas: ruleScore.missingKeywords.slice(0, 6),
    improvementActions: [
      "Add missing required skills in projects with measurable outcomes.",
      "Tailor summary and experience bullets to match role keywords."
    ],
    resumeRewriteTips: [
      "Use role-specific keywords naturally in skills, projects, and experience sections.",
      "Quantify impact in each project bullet using metrics."
    ],
    aiUsed: false,
    aiSource: "fallback",
    aiFailureReason: reason
  });

  if (!grokApiKey) {
    return fallback("GROK_API_KEY is missing.");
  }

  try {
    const resumeChunks = chunkText(resumeText, 8);
    const jdChunks = chunkText(jdText, 4);
    const jdContext = jdChunks.join("\n\n--- JD CHUNK ---\n\n");
    const extractedSkills = extractSkillSignals(resumeText);
    const aggregated = {
      matched: new Set<string>(),
      missing: new Set<string>(),
      lagging: new Set<string>(),
      actions: new Set<string>(),
      tips: new Set<string>()
    };

    for (let index = 0; index < resumeChunks.length; index += 1) {
      const raw = await callGrok([
        {
          role: "system",
          content:
            "You are an ATS assistant. Return strict JSON only with keys: matchedKeywords (string[]), missingKeywords (string[]), laggingAreas (string[]), improvementActions (string[]), resumeRewriteTips (string[]). Keep each list concise."
        },
        {
          role: "user",
          content: `Analyze resume chunk ${index + 1}/${resumeChunks.length} against the JD. Use only evidence from input text.
Rule summary: ${ruleScore.summary}
Detected resume skills: ${extractedSkills.join(", ") || "none"}

Job Description (all chunks):
${jdContext}

Resume Chunk:
${resumeChunks[index]}`
        }
      ]);

      const parsed = JSON.parse(raw) as {
        matchedKeywords?: string[];
        missingKeywords?: string[];
        laggingAreas?: string[];
        improvementActions?: string[];
        resumeRewriteTips?: string[];
      };

      (parsed.matchedKeywords || []).forEach((value) => aggregated.matched.add(value));
      (parsed.missingKeywords || []).forEach((value) => aggregated.missing.add(value));
      (parsed.laggingAreas || []).forEach((value) => aggregated.lagging.add(value));
      (parsed.improvementActions || []).forEach((value) => aggregated.actions.add(value));
      (parsed.resumeRewriteTips || []).forEach((value) => aggregated.tips.add(value));
    }

    const synthesisRaw = await callGrok([
      {
        role: "system",
        content:
          "You are an ATS assistant. Return strict JSON only with keys: overview (string), laggingAreas (string[]), improvementActions (string[]), resumeRewriteTips (string[])."
      },
      {
        role: "user",
        content: `Create a concise final ATS evaluation from aggregated analysis.
Rule score summary: ${ruleScore.summary}
Rule matched: ${ruleScore.matchedKeywords.join(", ") || "none"}
Rule missing: ${ruleScore.missingKeywords.join(", ") || "none"}
AI matched: ${Array.from(aggregated.matched).join(", ") || "none"}
AI missing: ${Array.from(aggregated.missing).join(", ") || "none"}
AI lagging: ${Array.from(aggregated.lagging).join(", ") || "none"}
AI actions: ${Array.from(aggregated.actions).join(" | ") || "none"}
AI tips: ${Array.from(aggregated.tips).join(" | ") || "none"}`
      }
    ]);

    const synthesis = JSON.parse(synthesisRaw) as {
      overview?: string;
      laggingAreas?: string[];
      improvementActions?: string[];
      resumeRewriteTips?: string[];
    };

    return {
      aiOverview: synthesis.overview || ruleScore.summary,
      matchedKeywords: Array.from(aggregated.matched).slice(0, 15),
      missingKeywords: Array.from(aggregated.missing).slice(0, 15),
      laggingAreas: (synthesis.laggingAreas || Array.from(aggregated.lagging)).slice(0, 10),
      improvementActions: (synthesis.improvementActions || Array.from(aggregated.actions)).slice(0, 10),
      resumeRewriteTips: (synthesis.resumeRewriteTips || Array.from(aggregated.tips)).slice(0, 10),
      aiUsed: true,
      aiSource: "grok"
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "AI analysis failed.";
    return fallback(reason);
  }
}

async function extractResumeText(file: Express.Multer.File): Promise<string> {
  const lower = file.originalname.toLowerCase();

  if (lower.endsWith(".pdf")) {
    const parsed = await pdfParse(file.buffer);
    return parsed.text || "";
  }

  if (lower.endsWith(".docx")) {
    const parsed = await mammoth.extractRawText({ buffer: file.buffer });
    return parsed.value || "";
  }

  if (lower.endsWith(".doc")) {
    // Basic fallback for legacy .doc files if plain text is embedded.
    return file.buffer.toString("utf8");
  }

  throw new Error("Unsupported resume format.");
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

app.get("/jobs/:id", authMiddleware, async (req: AuthedRequest, res) => {
  const job = await JobModel.findOne({ _id: req.params.id, tenantId: req.user!.tenantId }).lean();
  if (!job) return res.status(404).json({ message: "Job not found" });
  const rankedCandidates = await CandidateModel.find({ tenantId: req.user!.tenantId, jobId: req.params.id })
    .sort({ atsScore: -1, createdAt: -1 })
    .lean();
  return res.json({ job, rankedCandidates });
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

app.get("/candidates/:id", authMiddleware, async (req: AuthedRequest, res) => {
  const candidate = await CandidateModel.findOne({ _id: req.params.id, tenantId: req.user!.tenantId }).lean();
  if (!candidate) return res.status(404).json({ message: "Candidate not found" });
  return res.json(candidate);
});

app.post(
  "/candidates/upload-resume",
  authMiddleware,
  roleGuard(["owner", "admin", "recruiter"]),
  upload.single("resume"),
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ message: "Resume file is required." });
    const jobId = String(req.body?.jobId || "");
    if (!jobId) return res.status(400).json({ message: "Job is required." });

    const job = await JobModel.findOne({ _id: jobId, tenantId: req.user!.tenantId }).lean();
    if (!job) return res.status(404).json({ message: "Job not found." });

    const resumeText = await extractResumeText(req.file);
    const fullName = extractName(resumeText);
    const email = extractEmail(resumeText);
    const phone = extractPhone(resumeText);
    const ats = computeAtsScore(resumeText, String(job.jdText || ""));
    const ai = await generateGrokOverview(resumeText, String(job.jdText || ""), ats);
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
      scoreSummary: ats.summary,
      aiOverview: ai.aiOverview,
      matchedKeywords: ai.matchedKeywords,
      missingKeywords: ai.missingKeywords,
      laggingAreas: ai.laggingAreas,
      improvementActions: ai.improvementActions,
      resumeRewriteTips: ai.resumeRewriteTips,
      aiUsed: ai.aiUsed,
      aiSource: ai.aiSource,
      aiFailureReason: ai.aiFailureReason,
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

app.delete(
  "/candidates/:id",
  authMiddleware,
  roleGuard(["owner", "admin", "recruiter"]),
  async (req: AuthedRequest, res) => {
    const candidateId = req.params.id;
    const deletedCandidate = await CandidateModel.findOneAndDelete({
      _id: candidateId,
      tenantId: req.user!.tenantId
    }).lean();
    if (!deletedCandidate) return res.status(404).json({ message: "Candidate not found" });

    await InterviewModel.deleteMany({ tenantId: req.user!.tenantId, candidateId });
    return res.status(204).send();
  }
);

app.post(
  "/interviews",
  authMiddleware,
  roleGuard(["owner", "admin", "recruiter"]),
  async (req: AuthedRequest, res) => {
    const payload = createInterviewSchema.parse(req.body);
    const candidate = await CandidateModel.findOne({
      _id: payload.candidateId,
      tenantId: req.user!.tenantId
    }).lean();
    if (!candidate) return res.status(404).json({ message: "Candidate not found." });
    const interview = await InterviewModel.create({ ...payload, tenantId: req.user!.tenantId });
    return res.status(201).json(interview);
  }
);

app.get("/interviews", authMiddleware, async (req: AuthedRequest, res) => {
  const interviews = await InterviewModel.find({ tenantId: req.user!.tenantId }).sort({ interviewAt: 1 }).lean();
  return res.json(interviews);
});

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
