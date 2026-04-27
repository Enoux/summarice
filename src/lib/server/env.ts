import { z } from 'zod';
import * as priv from '$env/static/private';

const schema = z.object({
	SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export const env = schema.parse(priv);


// GEMINI_API_KEY: z.string().min(1),
// OPENAI_API_KEY: z.string().min(1)
