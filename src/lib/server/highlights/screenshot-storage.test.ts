import { describe, expect, it, vi } from 'vitest';
import { removeHighlightScreenshot } from './screenshot-storage';

describe('removeHighlightScreenshot', () => {
	it('is a no-op for null path', async () => {
		const storageFrom = vi.fn();
		await removeHighlightScreenshot({ storage: { from: storageFrom } } as never, null);
		expect(storageFrom).not.toHaveBeenCalled();
	});

	it('removes storage object when remove succeeds', async () => {
		const remove = vi.fn().mockResolvedValue({ error: null });
		const storageFrom = vi.fn().mockReturnValue({ remove });
		await removeHighlightScreenshot(
			{ storage: { from: storageFrom } } as never,
			'user/doc/h.png'
		);

		expect(storageFrom).toHaveBeenCalledWith('highlight-screenshots');
		expect(remove).toHaveBeenCalledWith(['user/doc/h.png']);
	});

	it('throws when storage remove fails', async () => {
		const remove = vi.fn().mockResolvedValue({ error: { message: 'access denied' } });
		const storageFrom = vi.fn().mockReturnValue({ remove });

		await expect(
			removeHighlightScreenshot({ storage: { from: storageFrom } } as never, 'path.png')
		).rejects.toEqual({ message: 'access denied' });
	});
});
