export function validate(input: { files: [string, unknown][]; signCodes?: Set<string>; subtopics?: unknown }): {
  errors: string[];
  warnings: string[];
  total: number;
  coverage: { category: string; subtopic: string; have: number; target: number }[];
};
