import { describe, expect, it } from 'vitest';

import { buildFigureInterpretationPrompt } from './figure-interpretation';

function queryBuilder(result: unknown) {
	const builder = {
		select: () => builder,
		eq: () => builder,
		single: async () => result
	};
	return builder;
}

describe('buildFigureInterpretationPrompt', () => {
	it('returns system instructions separately from user messages', async () => {
		const supabase = {
			from: (table: string) => {
				if (table === 'highlights') {
					return queryBuilder({
						data: {
							id: 'highlight-1',
							document_id: 'doc-1',
							owner_id: 'user-1',
							page_number: 1,
							screenshot_path: 'user-1/doc-1/highlight-1.png',
							bounding_box: {}
						},
						error: null
					});
				}
				if (table === 'annotations') {
					return queryBuilder({ data: { id: 'annotation-1' }, error: null });
				}
				throw new Error(`Unexpected table: ${table}`);
			},
			storage: {
				from: () => ({
					createSignedUrl: async () => ({
						data: { signedUrl: 'https://example.com/highlight-1.png' },
						error: null
					})
				})
			}
		};

		const prompt = await buildFigureInterpretationPrompt(supabase as never, {
			documentId: 'doc-1',
			highlightId: 'highlight-1',
			annotationId: 'annotation-1',
			ownerId: 'user-1'
		});

		expect(prompt.system).toContain('expert scientific figure analyst');
		expect(prompt.messages).toHaveLength(1);
		expect(prompt.messages.some((message) => message.role === 'system')).toBe(false);
		expect(prompt.messages[0]?.role).toBe('user');
	});
});
