import { z } from 'zod';

const deepSearchTargetKindSchema = z.enum(['highlight', 'area_highlight', 'note', 'document']);

export const deepSearchIntentSchema = z.object({
	rewrittenQueries: z.array(z.string().trim().min(1)).min(1).max(3),
	targetKinds: z.array(deepSearchTargetKindSchema).min(1),
	wantsRecent: z.boolean()
});

export const deepSearchRerankSchema = z.object({
	results: z
		.array(
			z.object({
				candidateKey: z.string().trim().min(1),
				reason: z.string().trim().min(1),
				matchedEvidence: z.string().trim().min(1),
				score: z.number().min(0).max(1)
			})
		)
		.max(6)
});

export type DeepSearchIntentSchema = z.infer<typeof deepSearchIntentSchema>;
export type DeepSearchRerankSchema = z.infer<typeof deepSearchRerankSchema>;
