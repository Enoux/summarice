import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { ensureUserSettingsRow } from '$lib/server/highlights/highlight-service';
import { DEFAULT_CATEGORY_LABELS } from '$lib/domain/highlight-categories';

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	if (!user) {
		throw redirect(303, '/login');
	}
	try {
		await ensureUserSettingsRow(supabase, user.id);
		const { data: settings, error: err } = await supabase
			.from('user_settings')
			.select('*')
			.eq('id', user.id)
			.single();
		if (err || !settings) {
			throw err ?? new Error('Could not load settings');
		}
		return { settings };
	} catch {
		// If user_settings migration hasn't been applied yet, keep settings page usable with defaults.
		return {
			settings: {
				use_colors_decoratively: false,
				decorative_default_color: '#facc15',
				category_labels: DEFAULT_CATEGORY_LABELS
			}
		};
	}
};

export const actions: Actions = {
	save: async ({ request, locals: { supabase, user } }) => {
		if (!user) return fail(401, { message: 'Unauthorized' });
		const fd = await request.formData();
		const useDecorative = fd.get('use_colors_decoratively') != null;
		const decorativeDefaultColor = String(fd.get('decorative_default_color') ?? '#facc15');
		const labels = {
			'1': String(fd.get('label_1') ?? '').trim() || 'Key idea',
			'2': String(fd.get('label_2') ?? '').trim() || 'Definition',
			'3': String(fd.get('label_3') ?? '').trim() || 'Evidence',
			'4': String(fd.get('label_4') ?? '').trim() || 'Question',
			'5': String(fd.get('label_5') ?? '').trim() || 'Contradiction'
		};

		const { error: upErr } = await supabase
			.from('user_settings')
			.upsert(
				{
					id: user.id,
					category_labels: labels,
					use_colors_decoratively: useDecorative,
					decorative_default_color: decorativeDefaultColor,
					updated_at: new Date().toISOString()
				},
				{ onConflict: 'id' }
			);

		if (upErr) {
			return fail(500, { message: upErr.message });
		}
		return { success: true };
	}
};
