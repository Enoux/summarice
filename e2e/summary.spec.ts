import { expect, test } from '@playwright/test';

type SummaryFixture = {
	documentId: string;
	highlightId: string;
	annotationId: string;
};

const authStatePath = process.env.PLAYWRIGHT_AUTH_FILE;
const mockComponentsEnabled = process.env.PUBLIC_MOCK_COMPONENTS === 'true';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;

const missingRuntime = !authStatePath || !serviceRoleKey || !supabaseUrl || mockComponentsEnabled;

const runtimeSkipReason = [
	!authStatePath ? 'PLAYWRIGHT_AUTH_FILE is not set' : null,
	!serviceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY is not set' : null,
	!supabaseUrl ? 'PUBLIC_SUPABASE_URL is not set' : null,
	mockComponentsEnabled ? 'PUBLIC_MOCK_COMPONENTS=true serves the mock summary UI' : null
]
	.filter(Boolean)
	.join('; ');

if (authStatePath) {
	test.use({ storageState: authStatePath });
}

test.describe('Issue 07 per-document summary flow', () => {
	test.skip(missingRuntime, runtimeSkipReason);

	test('generates a streaming summary with citations and persists rows', async ({ page }) => {
		test.fixme(
			true,
			'Issue 07 is not fully wired yet: Summary.svelte is still a placeholder and summaries/summary_citations persistence is not implemented in this branch.'
		);

		const fixture = await createFixtureDocumentWithSingleAnnotatedHighlight();

		await page.goto(`/doc/${fixture.documentId}`);
		await page.getByRole('button', { name: 'Summary' }).click();
		await page.getByRole('button', { name: /^Generate$/ }).click();

		const summaryStream = page.getByTestId('summary-stream');
		await expect(summaryStream).toBeVisible();
		await expect(summaryStream).toContainText(/\S+/);
		await expect(summaryStream).toContainText(/\[\^1\]/);

		await expect
			.poll(async () => countRows('summaries', `document_id=eq.${fixture.documentId}`))
			.toBe(1);
		await expect
			.poll(async () => countRows('summary_citations', `highlight_id=eq.${fixture.highlightId}`))
			.toBe(1);
	});
});

async function createFixtureDocumentWithSingleAnnotatedHighlight(): Promise<SummaryFixture> {
	throw new Error(
		[
			'Fixture seeding is intentionally deferred until the Issue 07 backend lands.',
			'Expected setup: create a document row, one document_pages row, one highlight row, and one human annotation row owned by the Playwright auth user.'
		].join(' ')
	);
}

async function countRows(table: string, filter: string): Promise<number> {
	const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id&${filter}`, {
		headers: {
			apikey: serviceRoleKey!,
			Authorization: `Bearer ${serviceRoleKey!}`
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to query ${table}: ${response.status} ${response.statusText}`);
	}

	const rows = (await response.json()) as Array<{ id: string }>;
	return rows.length;
}
