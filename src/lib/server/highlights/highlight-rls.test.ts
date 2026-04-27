import { describe, it } from 'vitest';

/**
 * Full RLS verification requires two Supabase sessions (user A / user B).
 * Run manually against a project with migrations applied, or extend with
 * integration fixtures. Documented here so the acceptance criterion stays visible.
 */
describe.skip('highlight RLS (integration)', () => {
	it('user A cannot select highlights owned by user B', () => {
		// TODO: supabase-js integration with second anon client + second session JWT
	});
});
