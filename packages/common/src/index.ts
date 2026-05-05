import { z } from "zod";

export const candidateStageSchema = z.enum([
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected"
]);

export type CandidateStage = z.infer<typeof candidateStageSchema>;

export const createCandidateSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  jobId: z.string().min(1),
  stage: candidateStageSchema.default("applied")
});

export type CreateCandidateDto = z.infer<typeof createCandidateSchema>;

export const createJobSchema = z.object({
  title: z.string().min(2),
  department: z.string().min(2),
  location: z.string().min(2),
  jdText: z.string().min(20)
});

export type CreateJobDto = z.infer<typeof createJobSchema>;

export type UserRole = "owner" | "admin" | "recruiter" | "viewer";
