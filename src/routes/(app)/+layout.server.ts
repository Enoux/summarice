import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	// TODO: Implement auth guard / session load (Issue NN)
	return {
		user: null
	};
};
