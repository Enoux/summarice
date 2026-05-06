import { z } from 'zod';

const stringListSchema = z.array(z.string().trim().min(1));

export const summarySchema = z.object({
	markdown: z.string().trim().min(1),
	tags: stringListSchema,
	entities: stringListSchema,
	open_questions: stringListSchema
});

export type SummarySchema = z.infer<typeof summarySchema>;
