import { describe, expect, it } from 'vitest';
import { summarySchema } from './summary-schema';

describe('summarySchema', () => {
	it('accepts structured summary payloads', () => {
		const parsed = summarySchema.parse({
			markdown: '## Summary\n\nKey claim.[^1]',
			tags: ['attention', 'rag'],
			entities: ['Gemini 2.5 Flash'],
			open_questions: ['Will this generalize?']
		});

		expect(parsed.tags).toEqual(['attention', 'rag']);
	});

	it('rejects empty markdown', () => {
		const parsed = summarySchema.safeParse({
			markdown: '   ',
			tags: [],
			entities: [],
			open_questions: []
		});

		expect(parsed.success).toBe(false);
	});
});
