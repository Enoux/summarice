import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteDocumentForUser } from './delete-document';

/** Minimal chain for `.from(...).select().eq().eq().maybeSingle()` */
function documentsSelectMaybeSingle(data: unknown) {
	return {
		select: () => ({
			eq: () => ({
				eq: () => ({
					maybeSingle: () => Promise.resolve({ data, error: null })
				})
			})
		})
	};
}

/** Minimal chain for `.from(...).delete().eq().eq()` */
function documentsDeleteOk() {
	return {
		delete: () => ({
			eq: () => ({
				eq: () => Promise.resolve({ error: null })
			})
		})
	};
}

describe('deleteDocumentForUser', () => {
	let from: ReturnType<typeof vi.fn>;
	let storageFrom: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		from = vi.fn();
		storageFrom = vi.fn();
	});

	it('returns deleted:false when no document row matches', async () => {
		from.mockImplementation((table: string) => {
			if (table === 'documents') {
				return documentsSelectMaybeSingle(null);
			}
			throw new Error(`unexpected table ${table}`);
		});

		const result = await deleteDocumentForUser(
			{ from, storage: { from: storageFrom } } as never,
			{
				documentId: 'doc-1',
				userId: 'user-1'
			}
		);

		expect(result.deleted).toBe(false);
		expect(result.warnings).toEqual([]);
		expect(storageFrom).not.toHaveBeenCalled();
	});

	it('deletes the document row then removes pdf and screenshots from storage', async () => {
		from.mockImplementation((table: string) => {
			if (table === 'documents') {
				return {
					...documentsSelectMaybeSingle({
						id: 'doc-1',
						storage_path: 'user-1/pdf.pdf'
					}),
					...documentsDeleteOk()
				};
			}
			if (table === 'highlights') {
				return {
					select: () => ({
						eq: () =>
							Promise.resolve({
								data: [{ screenshot_path: 'user-1/doc-1/a.png' }, { screenshot_path: null }],
								error: null
							})
					})
				};
			}
			throw new Error(`unexpected table ${table}`);
		});

		const remove = vi.fn().mockResolvedValue({ error: null });
		storageFrom.mockImplementation((bucket: string) => {
			if (bucket === 'documents' || bucket === 'highlight-screenshots') {
				return { remove };
			}
			throw new Error(`unexpected bucket ${bucket}`);
		});

		const result = await deleteDocumentForUser(
			{ from, storage: { from: storageFrom } } as never,
			{
				documentId: 'doc-1',
				userId: 'user-1'
			}
		);

		expect(result.deleted).toBe(true);
		expect(result.warnings).toEqual([]);
		expect(storageFrom).toHaveBeenCalledWith('documents');
		expect(storageFrom).toHaveBeenCalledWith('highlight-screenshots');
		expect(remove).toHaveBeenCalledWith(['user-1/pdf.pdf']);
		expect(remove).toHaveBeenCalledWith(['user-1/doc-1/a.png']);
	});

	it('dedupes screenshot paths before storage removes', async () => {
		from.mockImplementation((table: string) => {
			if (table === 'documents') {
				return {
					...documentsSelectMaybeSingle({
						id: 'doc-1',
						storage_path: 'u/d.pdf'
					}),
					...documentsDeleteOk()
				};
			}
			if (table === 'highlights') {
				return {
					select: () => ({
						eq: () =>
							Promise.resolve({
								data: [
									{ screenshot_path: 'same.png' },
									{ screenshot_path: 'same.png' },
									{ screenshot_path: ' ' }
								],
								error: null
							})
					})
				};
			}
			throw new Error(`unexpected table ${table}`);
		});

		const remove = vi.fn().mockResolvedValue({ error: null });
		storageFrom.mockReturnValue({ remove });

		await deleteDocumentForUser({ from, storage: { from: storageFrom } } as never, {
			documentId: 'doc-1',
			userId: 'user-1'
		});

		const screenshotRemoves = remove.mock.calls.filter((c) => c[0]?.[0] === 'same.png');
		expect(screenshotRemoves).toHaveLength(1);
	});

	it('collects warnings when storage remove fails but document row was deleted', async () => {
		from.mockImplementation((table: string) => {
			if (table === 'documents') {
				return {
					...documentsSelectMaybeSingle({
						id: 'doc-1',
						storage_path: 'u/file.pdf'
					}),
					...documentsDeleteOk()
				};
			}
			if (table === 'highlights') {
				return {
					select: () => ({
						eq: () =>
							Promise.resolve({
								data: [{ screenshot_path: 'x.png' }],
								error: null
							})
					})
				};
			}
			throw new Error(`unexpected table ${table}`);
		});

		const remove = vi
			.fn()
			.mockResolvedValueOnce({ error: { message: 'pdf failed' } })
			.mockResolvedValueOnce({ error: { message: 'shot failed' } });
		storageFrom.mockReturnValue({ remove });

		const result = await deleteDocumentForUser({ from, storage: { from: storageFrom } } as never, {
			documentId: 'doc-1',
			userId: 'user-1'
		});

		expect(result.deleted).toBe(true);
		expect(result.warnings.length).toBe(2);
	});
});
