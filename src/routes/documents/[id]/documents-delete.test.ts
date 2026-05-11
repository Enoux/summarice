import { beforeEach, describe, expect, it, vi } from 'vitest';

const deleteDocumentForUser = vi.fn();

vi.mock('$lib/server/document-upload/delete-document', () => ({
	deleteDocumentForUser
}));

describe('DELETE /documents/[id]', () => {
	beforeEach(() => {
		deleteDocumentForUser.mockReset();
		vi.resetModules();
	});

	it('returns 401 without user', async () => {
		const { DELETE } = await import('./+server');
		await expect(
			DELETE({
				locals: { user: null, supabase: {} },
				params: { id: '22222222-2222-4222-8222-222222222222' }
			} as never)
		).rejects.toMatchObject({ status: 401 });
	});

	it('returns 404 when document was not deleted', async () => {
		deleteDocumentForUser.mockResolvedValue({ deleted: false, warnings: [] });
		const { DELETE } = await import('./+server');
		await expect(
			DELETE({
				locals: { user: { id: '11111111-1111-4111-8111-111111111111' }, supabase: {} },
				params: { id: '22222222-2222-4222-8222-222222222222' }
			} as never)
		).rejects.toMatchObject({ status: 404 });
	});

	it('returns ok:true on success without warnings', async () => {
		deleteDocumentForUser.mockResolvedValue({ deleted: true, warnings: [] });
		const { DELETE } = await import('./+server');
		const response = await DELETE({
			locals: { user: { id: '11111111-1111-4111-8111-111111111111' }, supabase: {} },
			params: { id: '22222222-2222-4222-8222-222222222222' }
		} as never);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
	});

	it('forwards warnings when present', async () => {
		deleteDocumentForUser.mockResolvedValue({
			deleted: true,
			warnings: ['Failed to remove PDF from storage: x']
		});
		const { DELETE } = await import('./+server');
		const response = await DELETE({
			locals: { user: { id: '11111111-1111-4111-8111-111111111111' }, supabase: {} },
			params: { id: '22222222-2222-4222-8222-222222222222' }
		} as never);

		expect(await response.json()).toEqual({
			ok: true,
			warnings: ['Failed to remove PDF from storage: x']
		});
	});

	it('returns 500 when deleteDocumentForUser throws a non-http error', async () => {
		deleteDocumentForUser.mockRejectedValue(new Error('db failed'));
		const { DELETE } = await import('./+server');

		await expect(
			DELETE({
				locals: { user: { id: '11111111-1111-4111-8111-111111111111' }, supabase: {} },
				params: { id: '22222222-2222-4222-8222-222222222222' }
			} as never)
		).rejects.toMatchObject({ status: 500 });
	});
});
