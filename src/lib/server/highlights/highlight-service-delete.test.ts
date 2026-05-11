import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteHighlightById } from './highlight-service';

const { removeHighlightScreenshot } = vi.hoisted(() => ({
	removeHighlightScreenshot: vi.fn()
}));

vi.mock('./screenshot-storage', () => ({
	removeHighlightScreenshot,
	uploadHighlightScreenshot: vi.fn(),
	createHighlightScreenshotSignedUrl: vi.fn()
}));

describe('deleteHighlightById', () => {
	beforeEach(() => {
		removeHighlightScreenshot.mockReset();
	});

	it('throws AppNotFoundError when highlight is not in scope', async () => {
		const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
		const eq3 = vi.fn().mockReturnValue({ maybeSingle });
		const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
		const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
		const supabase = {
			from: () => ({
				select: () => ({ eq: eq1 }),
				delete: vi.fn()
			})
		};

		const { AppNotFoundError } = await import('$lib/server/app-errors');
		await expect(
			deleteHighlightById(supabase as never, {
				highlightId: 'h1',
				documentId: 'd1',
				userId: 'u1'
			})
		).rejects.toBeInstanceOf(AppNotFoundError);
		expect(removeHighlightScreenshot).not.toHaveBeenCalled();
	});

	it('deletes highlight then removes screenshot storage object', async () => {
		const maybeSingle = vi.fn().mockResolvedValue({
			data: { screenshot_path: 'user/doc/h.png' },
			error: null
		});
		const eq3 = vi.fn().mockReturnValue({ maybeSingle });
		const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
		const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
		const deleteEq3 = vi.fn().mockResolvedValue({ error: null });
		const deleteEq2 = vi.fn().mockReturnValue({ eq: deleteEq3 });
		const deleteEq1 = vi.fn().mockReturnValue({ eq: deleteEq2 });

		const supabase = {
			from: vi.fn(() => ({
				select: () => ({ eq: eq1 }),
				delete: () => ({ eq: deleteEq1 })
			}))
		};

		await deleteHighlightById(supabase as never, {
			highlightId: 'h1',
			documentId: 'd1',
			userId: 'u1'
		});

		expect(removeHighlightScreenshot).toHaveBeenCalledWith(supabase, 'user/doc/h.png');
	});

	it('passes null to removeHighlightScreenshot when screenshot path is whitespace', async () => {
		const maybeSingle = vi.fn().mockResolvedValue({
			data: { screenshot_path: '  ' },
			error: null
		});
		const eq3 = vi.fn().mockReturnValue({ maybeSingle });
		const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
		const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
		const deleteEq3 = vi.fn().mockResolvedValue({ error: null });
		const deleteEq2 = vi.fn().mockReturnValue({ eq: deleteEq3 });
		const deleteEq1 = vi.fn().mockReturnValue({ eq: deleteEq2 });

		const supabase = {
			from: vi.fn(() => ({
				select: () => ({ eq: eq1 }),
				delete: () => ({ eq: deleteEq1 })
			}))
		};

		await deleteHighlightById(supabase as never, {
			highlightId: 'h1',
			documentId: 'd1',
			userId: 'u1'
		});

		expect(removeHighlightScreenshot).toHaveBeenCalledWith(supabase, null);
	});

	it('propagates removeHighlightScreenshot errors after highlight row delete', async () => {
		removeHighlightScreenshot.mockRejectedValue(new Error('storage failed'));

		const maybeSingle = vi.fn().mockResolvedValue({
			data: { screenshot_path: 'user/doc/h.png' },
			error: null
		});
		const eq3 = vi.fn().mockReturnValue({ maybeSingle });
		const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
		const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
		const deleteEq3 = vi.fn().mockResolvedValue({ error: null });
		const deleteEq2 = vi.fn().mockReturnValue({ eq: deleteEq3 });
		const deleteEq1 = vi.fn().mockReturnValue({ eq: deleteEq2 });

		const supabase = {
			from: vi.fn(() => ({
				select: () => ({ eq: eq1 }),
				delete: () => ({ eq: deleteEq1 })
			}))
		};

		await expect(
			deleteHighlightById(supabase as never, {
				highlightId: 'h1',
				documentId: 'd1',
				userId: 'u1'
			})
		).rejects.toThrow('storage failed');
		expect(removeHighlightScreenshot).toHaveBeenCalledWith(supabase, 'user/doc/h.png');
	});
});
