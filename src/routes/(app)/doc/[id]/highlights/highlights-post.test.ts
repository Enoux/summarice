import { beforeEach, describe, expect, it, vi } from 'vitest';

const refineHighlightTextForDocument = vi.fn();
const createHighlightWithResolvedText = vi.fn();
const updateHighlight = vi.fn();
const updateAreaHighlightScreenshot = vi.fn();

vi.mock('$lib/server/highlights/highlight-service', () => ({
	createHighlightWithResolvedText,
	updateAreaHighlightScreenshot,
	updateHighlight
}));

describe('POST /doc/[id]/highlights', () => {
	beforeEach(() => {
		refineHighlightTextForDocument.mockReset();
		createHighlightWithResolvedText.mockReset();
		updateHighlight.mockReset();
		updateAreaHighlightScreenshot.mockReset();
	});

	it('returns the persisted highlight with refined text when layout data is available', async () => {
		createHighlightWithResolvedText.mockResolvedValue({
			id: '11111111-1111-4111-8111-111111111111',
			type: 'text',
			content: { text: 'Refined excerpt' },
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
			text_status: 'refined'
		});

		const { POST } = await import('./+server');
		const response = await POST({
			locals: { user: { id: '11111111-1111-4111-8111-111111111111' }, supabase: {} },
			params: { id: '22222222-2222-4222-8222-222222222222' },
			request: new Request('http://localhost/doc/doc-1/highlights', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					highlight: {
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
						}
					},
					decorative: false,
					colorHex: '#ffcc00'
				})
			})
		} as never);

		expect(createHighlightWithResolvedText).toHaveBeenCalledOnce();
		expect(createHighlightWithResolvedText).toHaveBeenCalledWith(
			{},
			expect.objectContaining({
				id: '11111111-1111-4111-8111-111111111111',
				type: 'text'
			}),
			{
				documentId: '22222222-2222-4222-8222-222222222222',
				userId: '11111111-1111-4111-8111-111111111111',
				decorative: false,
				colorHex: '#ffcc00'
			}
		);
		expect(await response.json()).toMatchObject({
			id: '11111111-1111-4111-8111-111111111111',
			content: { text: 'Refined excerpt' },
			text_status: 'refined'
		});
	});

	it('accepts an area highlight PNG screenshot in content.image', async () => {
		createHighlightWithResolvedText.mockResolvedValue({
			id: '44444444-4444-4444-8444-444444444444',
			type: 'area',
			content: { image: 'https://signed.example/highlight.png' },
			position: {
				boundingRect: {
					x1: 10,
					y1: 10,
					x2: 40,
					y2: 40,
					width: 612,
					height: 792,
					pageNumber: 1
				},
				rects: []
			},
			text_status: 'fallback'
		});

		const { POST } = await import('./+server');
		const response = await POST({
			locals: { user: { id: '11111111-1111-4111-8111-111111111111' }, supabase: {} },
			params: { id: '22222222-2222-4222-8222-222222222222' },
			request: new Request('http://localhost/doc/doc-1/highlights', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					highlight: {
						id: '44444444-4444-4444-8444-444444444444',
						type: 'area',
						content: { image: 'data:image/png;base64,iVBORw0KGgo=' },
						position: {
							boundingRect: {
								x1: 10,
								y1: 10,
								x2: 40,
								y2: 40,
								width: 612,
								height: 792,
								pageNumber: 1
							},
							rects: []
						}
					},
					decorative: false,
					colorHex: '#ffcc00'
				})
			})
		} as never);

		expect(response.status).toBe(200);
		expect(createHighlightWithResolvedText).toHaveBeenCalledWith(
			{},
			expect.objectContaining({
				type: 'area',
				content: { image: 'data:image/png;base64,iVBORw0KGgo=' }
			}),
			expect.objectContaining({
				documentId: '22222222-2222-4222-8222-222222222222',
				userId: '11111111-1111-4111-8111-111111111111'
			})
		);
		expect(await response.json()).toMatchObject({
			id: '44444444-4444-4444-8444-444444444444',
			content: { image: 'https://signed.example/highlight.png' }
		});
	});

	it('still succeeds with the provisional text when refinement falls back', async () => {
		createHighlightWithResolvedText.mockResolvedValue({
			id: '33333333-3333-4333-8333-333333333333',
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
			text_status: 'fallback'
		});

		const { POST } = await import('./+server');
		const response = await POST({
			locals: { user: { id: '11111111-1111-4111-8111-111111111111' }, supabase: {} },
			params: { id: '22222222-2222-4222-8222-222222222222' },
			request: new Request('http://localhost/doc/doc-1/highlights', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					highlight: {
						id: '33333333-3333-4333-8333-333333333333',
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
						}
					},
					decorative: false,
					colorHex: '#ffcc00'
				})
			})
		} as never);

		expect(await response.json()).toMatchObject({
			id: '33333333-3333-4333-8333-333333333333',
			content: { text: 'Selected text' },
			text_status: 'fallback'
		});
	});
});

describe('PATCH /doc/[id]/highlights comments', () => {
	it('accepts empty comment updates as deletion intent', async () => {
		updateHighlight.mockResolvedValue(undefined);
		const { PATCH } = await import('./+server');

		const response = await PATCH({
			locals: { user: { id: '11111111-1111-4111-8111-111111111111' }, supabase: {} },
			params: { id: '22222222-2222-4222-8222-222222222222' },
			request: new Request('http://localhost/doc/doc-1/highlights', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: '11111111-1111-4111-8111-111111111111',
					comment: '   '
				})
			})
		} as never);

		expect(response.status).toBe(200);
		expect(updateHighlight).toHaveBeenCalledWith(
			{},
			'11111111-1111-4111-8111-111111111111',
			'22222222-2222-4222-8222-222222222222',
			{ comment: '' }
		);
	});

	it('trims valid comment updates before persistence', async () => {
		updateHighlight.mockResolvedValue(undefined);
		const { PATCH } = await import('./+server');

		const response = await PATCH({
			locals: { user: { id: '11111111-1111-4111-8111-111111111111' }, supabase: {} },
			params: { id: '22222222-2222-4222-8222-222222222222' },
			request: new Request('http://localhost/doc/doc-1/highlights', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: '11111111-1111-4111-8111-111111111111',
					comment: '  Saved  '
				})
			})
		} as never);

		expect(response.status).toBe(200);
		expect(updateHighlight).toHaveBeenCalledWith(
			{},
			'11111111-1111-4111-8111-111111111111',
			'22222222-2222-4222-8222-222222222222',
			{ comment: 'Saved' }
		);
	});
});

describe('PATCH /doc/[id]/highlights area adjustment', () => {
	it('persists an area adjustment and returns the refreshed highlight', async () => {
		updateAreaHighlightScreenshot.mockResolvedValue({
			id: '11111111-1111-4111-8111-111111111111',
			type: 'area',
			content: { image: 'https://signed.example/new.png' },
			position: {
				boundingRect: {
					x1: 0.1,
					y1: 0.1,
					x2: 0.4,
					y2: 0.4,
					width: 612,
					height: 792,
					pageNumber: 2
				},
				rects: []
			}
		});
		const { PATCH } = await import('./+server');

		const body = {
			id: '11111111-1111-4111-8111-111111111111',
			position: {
				boundingRect: {
					x1: 0.1,
					y1: 0.1,
					x2: 0.4,
					y2: 0.4,
					width: 612,
					height: 792,
					pageNumber: 2
				},
				rects: []
			},
			content: { image: 'data:image/png;base64,iVBORw0KGgo=' }
		};
		const response = await PATCH({
			locals: { user: { id: '99999999-9999-4999-8999-999999999999' }, supabase: {} },
			params: { id: '22222222-2222-4222-8222-222222222222' },
			request: new Request('http://localhost/doc/doc-1/highlights', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			})
		} as never);

		expect(response.status).toBe(200);
		expect(updateAreaHighlightScreenshot).toHaveBeenCalledWith(
			{},
			expect.objectContaining({
				id: body.id,
				documentId: '22222222-2222-4222-8222-222222222222',
				userId: '99999999-9999-4999-8999-999999999999',
				imageDataUrl: body.content.image
			})
		);
		expect(await response.json()).toMatchObject({
			ok: true,
			highlight: { content: { image: 'https://signed.example/new.png' } }
		});
	});

	it('rejects an incomplete area adjustment payload', async () => {
		const { PATCH } = await import('./+server');
		await expect(() =>
			PATCH({
				locals: { user: { id: '99999999-9999-4999-8999-999999999999' }, supabase: {} },
				params: { id: '22222222-2222-4222-8222-222222222222' },
				request: new Request('http://localhost/doc/doc-1/highlights', {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						id: '11111111-1111-4111-8111-111111111111',
						content: { image: 'data:image/png;base64,iVBORw0KGgo=' }
					})
				})
			} as never)
		).rejects.toMatchObject({ status: 400 });
	});
});
