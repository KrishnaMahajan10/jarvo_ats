declare module "mammoth" {
  export function extractRawText(input: { buffer: Buffer }): Promise<{ value: string }>;
  const mammoth: { extractRawText: typeof extractRawText };
  export default mammoth;
}
