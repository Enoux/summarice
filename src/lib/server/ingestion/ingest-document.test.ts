import { beforeEach, describe, expect, it, vi } from 'vitest';

const parsePdfWithLiteParse = vi.fn();
const extractPdfOutline = vi.fn();

vi.mock('./liteparse-adapter', () => ({
	parsePdfWithLiteParse
}));

vi.mock('./pdf-outline', () => ({
	extractPdfOutline
}));

describe('ingestDocumentFile', () => {
	beforeEach(() => {
		parsePdfWithLiteParse.mockReset();
		extractPdfOutline.mockReset();
	});

	it('uses independent PDF byte copies for parsing, outline extraction, and upload', async () => {
		parsePdfWithLiteParse.mockResolvedValue({
			pages: [
				{
					pageNum: 1,
					width: 612,
					height: 792,
					text: 'A'.repeat(80),
					textItems: []
				}
			]
		});
		extractPdfOutline.mockResolvedValue([]);

		const upload = vi.fn().mockResolvedValue({ error: null });
		const remove = vi.fn().mockResolvedValue({ error: null });
		const rpc = vi.fn().mockResolvedValue({ data: 'doc-1', error: null });
		const supabase = {
			storage: {
				from: vi.fn(() => ({
					upload,
					remove
				}))
			},
			rpc
		};

		const file = new File([new Uint8Array([1, 2, 3, 4])], 'paper.pdf', {
			type: 'application/pdf'
		});

		const { ingestDocumentFile } = await import('./ingest-document');
		await ingestDocumentFile(supabase as never, 'user-1', file);

		const parseBytes = parsePdfWithLiteParse.mock.calls[0]?.[0] as Uint8Array;
		const outlineBytes = extractPdfOutline.mock.calls[0]?.[0] as Uint8Array;
		const uploadBytes = upload.mock.calls[0]?.[1] as Uint8Array;

		expect(parseBytes).toBeInstanceOf(Uint8Array);
		expect(outlineBytes).toBeInstanceOf(Uint8Array);
		expect(uploadBytes).toBeInstanceOf(Uint8Array);

		expect(parseBytes).not.toBe(outlineBytes);
		expect(parseBytes).not.toBe(uploadBytes);
		expect(outlineBytes).not.toBe(uploadBytes);

		expect([...parseBytes]).toEqual([1, 2, 3, 4]);
		expect([...outlineBytes]).toEqual([1, 2, 3, 4]);
		expect([...uploadBytes]).toEqual([1, 2, 3, 4]);
	});
});
