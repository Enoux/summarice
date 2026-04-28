import type { PageLoad } from './(dashboard)/$types';

export const load: PageLoad = async ({ parent }) => {
	const { supabase, session } = await parent();

	if (!session) return { documents: [] };

	const { data: documents } = await supabase
		.from('documents')
		.select('*')
		.order('created_at', { ascending: false });

	return {
		documents: documents || []
	};
};
