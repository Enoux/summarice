import type { PageLoad } from './$types';
import type { LibraryDocument } from '$lib/types/library-document';

export const load: PageLoad = async ({ parent }) => {
	const { supabase, session } = await parent();

	if (!session) return { documents: [] as LibraryDocument[] };

	const { data: documents } = await supabase
		.from('documents')
		.select('*')
		.order('created_at', { ascending: false });

	return {
		documents: (documents ?? []) as LibraryDocument[]
	};
};
