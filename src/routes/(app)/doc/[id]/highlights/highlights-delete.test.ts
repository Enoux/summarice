import { beforeEach, describe, expect, it, vi } from 'vitest';

const deleteHighlightById = vi.fn();

vi.mock('$lib/server/highlights/highlight-service', () => ({
	createHighlightWithResolvedText: vi.fn(),
	updateAreaHighlightScreenshot: vi.fn(),
	updateHighlight: vi.fn(),
	deleteHighlightById
}));

describe('DELETE /doc/[id]/highlights', () => {
	beforeEach(() => {
		deleteHighlightById.mockReset();
	});

	it('calls deleteHighlightById with document and user scope', async () => {
		deleteHighlightById.mockResolvedValue(undefined);
		const { DELETE } = await import('./+server');

		const response = await DELETE({
			locals: { user: { id: '11111111-1111-4111-8111-111111111111' }, supabase: {} },
			params: { id: '22222222-2222-4222-8222-222222222222' },
			url: new URL('http://localhost/doc/doc-1/highlights?id=' + '33333333-3333-4333-8333-333333333333')
		} as never);

		expect(deleteHighlightById).toHaveBeenCalledWith({}, {
			highlightId: '33333333-3333-4333-8333-333333333333',
			documentId: '22222222-2222-4222-8222-222222222222',
			userId: '11111111-1111-4111-8111-111111111111'
		});
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
	});

	it('maps AppNotFoundError to 404', async () => {
		const { AppNotFoundError } = await import('$lib/server/app-errors');
		deleteHighlightById.mockRejectedValue(new AppNotFoundError('Highlight not found'));
		const { DELETE } = await import('./+server');

		await expect(() =>
			DELETE({
				locals: { user: { id: '11111111-1111-4111-8111-111111111111' }, supabase: {} },
				params: { id: '22222222-2222-4222-8222-222222222222' },
				url: new URL('http://localhost/h?id=' + '33333333-3333-4333-8333-333333333333')
			} as never)
		).rejects.toMatchObject({ status: 404 });
	});
});
