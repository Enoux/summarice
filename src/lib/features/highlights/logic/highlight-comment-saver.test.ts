import { describe, expect, it, vi } from 'vitest';
import { HighlightsModel } from '$lib/pdf-highlighter';
import type { CommentedHighlight } from '$lib/pdf-highlighter/types';
import { createHighlightCommentSaver } from './highlight-comment-saver';

const baseHighlight: CommentedHighlight = {
	id: '11111111-1111-4111-8111-111111111111',
	type: 'text',
	content: { text: 'Selected text' },
	position: {
		boundingRect: {
			x1: 10,
			y1: 10,
			x2: 40,
			y2: 20,
			width: 612,
			height: 792,
			pageNumber: 1
		},
		rects: []
	},
	comment: 'Saved comment'
};

describe('highlight comment optimistic persistence', () => {
	it('persists empty comments as comment deletion', async () => {
		const store = new HighlightsModel<CommentedHighlight>([baseHighlight]);
		const persist = vi.fn().mockResolvedValue(undefined);
		const save = createHighlightCommentSaver(store, persist);

		const result = await save(baseHighlight, '   ');

		expect(result).toMatchObject({ ok: true, comment: '' });
		expect(persist).toHaveBeenCalledWith(baseHighlight, '');
		expect(store.getHighlightById(baseHighlight.id!)?.comment).toBe('');
	});

	it('optimistically renders the trimmed comment before persistence resolves', async () => {
		const store = new HighlightsModel<CommentedHighlight>([baseHighlight]);
		let resolvePersist!: () => void;
		const persist = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolvePersist = resolve;
				})
		);
		const save = createHighlightCommentSaver(store, persist);

		const pending = save(baseHighlight, '  Draft comment  ');

		expect(store.getHighlightById(baseHighlight.id!)?.comment).toBe('Draft comment');
		expect(persist).toHaveBeenCalledWith(baseHighlight, 'Draft comment');

		resolvePersist();
		await expect(pending).resolves.toMatchObject({ ok: true, comment: 'Draft comment' });
	});

	it('rolls back the store when persistence fails', async () => {
		const store = new HighlightsModel<CommentedHighlight>([baseHighlight]);
		const persist = vi.fn().mockRejectedValue(new Error('network down'));
		const save = createHighlightCommentSaver(store, persist);

		const result = await save(baseHighlight, 'New draft');

		expect(result).toMatchObject({ ok: false, reason: 'persistence' });
		expect(store.getHighlightById(baseHighlight.id!)?.comment).toBe('Saved comment');
	});

	it('rolls back deleted comments when persistence fails', async () => {
		const store = new HighlightsModel<CommentedHighlight>([baseHighlight]);
		const persist = vi.fn().mockRejectedValue(new Error('network down'));
		const save = createHighlightCommentSaver(store, persist);

		const result = await save(baseHighlight, '   ');

		expect(result).toMatchObject({ ok: false, reason: 'persistence' });
		expect(store.getHighlightById(baseHighlight.id!)?.comment).toBe('Saved comment');
	});
});
