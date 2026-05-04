import { z } from 'zod';
import * as priv from '$env/static/private';

const schema = z.object({
	SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
	OPENROUTER_API_KEY: z.string().min(1).optional(),
	OPENROUTER_GENERATION_MODEL: z.string().min(1).optional(),
	OPENROUTER_FIGURE_MODEL: z.string().min(1).optional(),
	OPENROUTER_EMBEDDING_MODEL: z.string().min(1).optional(),
	OPENROUTER_FALLBACK_MODEL: z.string().min(1).optional()
});

export const env = schema.parse(priv);
