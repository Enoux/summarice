import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';

vi.mock('$app/state', () => ({
	page: {
		data: {
			document: {
				id: 'doc-123'
			}
		}
	}
}));

import Summary from './Summary.svelte';

describe('Summary', () => {
	it('renders the loaded summary view with version controls and citations', () => {
		const result = render(Summary, {
			props: {
				disableAutoLoad: true,
				initialSummaries: [
					{
						id: 'sum-2',
						version: 2,
						is_current: true,
						markdown: '# Overview\n\nA cited claim [^3].',
						tags: ['research'],
						entities: ['Gemini'],
						open_questions: []
					},
					{
						id: 'sum-1',
						version: 1,
						is_current: false,
						markdown: '# Earlier draft\n\nOlder text.',
						tags: [],
						entities: [],
						open_questions: []
					}
				],
				initialSelectedSummaryId: 'sum-2'
			}
		});

		expect(result.body).toContain('Summary');
		expect(result.body).toContain('Regenerate');
		expect(result.body).toContain('v2 (Current)');
		expect(result.body).toContain('Overview');
		expect(result.body).toContain('A cited claim');
		expect(result.body).toContain('v2');
		expect(result.body).toContain('data-popover-trigger');
	});
});
