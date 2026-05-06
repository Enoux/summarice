import type { SupabaseClient } from '@supabase/supabase-js';
import type { ModelMessage } from 'ai';
import type { Annotation } from '$lib/pdf-highlighter/types';
import type { HighlightRow } from '$lib/server/highlights/highlight-service';
import { parseCategoryLabels } from '$lib/highlights/color-slots';
import {
	buildHighlightPromptContext,
	formatHighlightPromptContextForModel
} from './highlight-prompt-context';

type OwnedDocumentRow = {
	id: string;
	owner_id: string;
	title: string;
	page_count: number;
};

type DocumentPageRow = {
	document_id: string;
	page_number: number;
	text: string;
};

type UserSettingsRow = {
	id: string;
	category_labels?: unknown;
	use_colors_decoratively?: boolean;
};

export type SummaryPrompt = {
	system: string;
	messages: ModelMessage[];
	ordinalWhitelist: number[];
	cachedPrefixCharCount: number;
	model: 'google/gemini-2.5-flash';
};

const SUMMARY_MODEL = 'google/gemini-2.5-flash' as const;

export async function buildSummaryPrompt(
	supabase: SupabaseClient,
	opts: { documentId: string; ownerId: string }
): Promise<SummaryPrompt> {
	const [document, pages, highlights, settings] = await Promise.all([
		fetchOwnedDocument(supabase, opts),
		fetchDocumentPages(supabase, opts.documentId),
		fetchHighlights(supabase, opts),
		fetchUserSettings(supabase, opts.ownerId)
	]);

	const promptContext = buildHighlightPromptContext({
		categoryLabels: settings?.category_labels,
		useColorsDecoratively: settings?.use_colors_decoratively ?? false
	});

	const orderedPages = [...pages].sort((a, b) => a.page_number - b.page_number);
	const orderedHighlights = [...highlights].sort((a, b) => a.ordinal - b.ordinal);
	const ordinalWhitelist = orderedHighlights.map((highlight) => highlight.ordinal);
	const categoryLabels = parseCategoryLabels(settings?.category_labels);
	const pagesWithTags = renderDocumentPages(
		orderedPages,
		orderedHighlights,
		promptContext.decorativeColors,
		categoryLabels
	);
	const highlightsIndex = renderHighlightsIndex(
		orderedHighlights,
		promptContext.decorativeColors,
		categoryLabels
	);

	const userPrefix = [
		`Document title: ${document.title}`,
		`Page count: ${document.page_count}`,
		'Task: write a thematic per-document summary grounded in the reader highlights and annotations.',
		formatHighlightPromptContextForModel(promptContext),
		'Use only markdown footnote citation tokens in the form [^n], where n is a highlight ordinal from the provided Highlights Index.',
		'Include an "Open questions" section only when there is qualifying material. In semantic color mode, source it only from slot 4 (Question) and slot 5 (Contradiction) highlights. In decorative mode, use your judgement.',
		'Below are the full document pages with inline highlight markers, followed by a Highlights Index.'
	].join('\n\n');

	const userContent = [
		userPrefix,
		'<document_pages>',
		pagesWithTags,
		'</document_pages>',
		'<highlights_index>',
		highlightsIndex,
		'</highlights_index>'
	].join('\n\n');

	return {
		system: [
			'You are an expert research reading assistant.',
			'Produce a structured per-document summary as JSON with keys markdown, tags, entities, and open_questions.',
			'The markdown must be concise, thematic, and grounded in the supplied highlights.',
			'Use markdown footnote tokens like [^1] for evidence and never invent citations outside the whitelist.'
		].join(' '),
		messages: [{ role: 'user', content: userContent }],
		ordinalWhitelist,
		cachedPrefixCharCount: userPrefix.length,
		model: SUMMARY_MODEL
	};
}

async function fetchOwnedDocument(
	supabase: SupabaseClient,
	opts: { documentId: string; ownerId: string }
) {
	const { data, error } = await supabase
		.from('documents')
		.select('id, owner_id, title, page_count')
		.eq('id', opts.documentId)
		.eq('owner_id', opts.ownerId)
		.maybeSingle();

	if (error || !data) {
		throw new Error('Document not found');
	}

	return data as OwnedDocumentRow;
}

async function fetchDocumentPages(supabase: SupabaseClient, documentId: string) {
	const { data, error } = await supabase
		.from('document_pages')
		.select('document_id, page_number, text')
		.eq('document_id', documentId)
		.order('page_number', { ascending: true });

	if (error) {
		throw error;
	}

	return (data ?? []) as DocumentPageRow[];
}

async function fetchHighlights(
	supabase: SupabaseClient,
	opts: { documentId: string; ownerId: string }
) {
	const { data, error } = await supabase
		.from('highlights')
		.select('*, annotations(*)')
		.eq('document_id', opts.documentId)
		.eq('owner_id', opts.ownerId)
		.order('ordinal', { ascending: true });

	if (error) {
		throw error;
	}

	return (data ?? []) as HighlightRow[];
}

async function fetchUserSettings(supabase: SupabaseClient, ownerId: string) {
	const { data, error } = await supabase
		.from('user_settings')
		.select('*')
		.eq('id', ownerId)
		.maybeSingle();

	if (error) {
		throw error;
	}

	return (data ?? null) as UserSettingsRow | null;
}

function renderDocumentPages(
	pages: DocumentPageRow[],
	highlights: HighlightRow[],
	decorativeColors: boolean,
	categoryLabels: Record<string, string>
) {
	return pages
		.map((page) => {
			const pageHighlights = highlights
				.filter((highlight) => highlight.page_number === page.page_number)
				.sort((a, b) => a.ordinal - b.ordinal);
			const pageText = injectHighlightTags(
				page.text,
				pageHighlights,
				decorativeColors,
				categoryLabels
			);
			return `<page n="${page.page_number}">\n${pageText}\n</page>`;
		})
		.join('\n\n');
}

function injectHighlightTags(
	pageText: string,
	highlights: HighlightRow[],
	decorativeColors: boolean,
	categoryLabels: Record<string, string>
) {
	let nextText = pageText;
	const appended: string[] = [];

	for (const highlight of highlights) {
		const highlightText = (highlight.text ?? '').trim();
		const attrs = highlightAttributes(highlight, decorativeColors, categoryLabels);

		if (highlightText) {
			const wrapped = `<highlight ${attrs}>${highlightText}</highlight>`;
			if (nextText.includes(highlightText)) {
				nextText = nextText.replace(highlightText, wrapped);
				continue;
			}
			appended.push(`<highlight ${attrs} text="${escapeAttribute(highlightText)}" />`);
			continue;
		}

		appended.push(`<highlight ${attrs} />`);
	}

	return appended.length > 0 ? `${nextText}\n${appended.join('\n')}` : nextText;
}

function renderHighlightsIndex(
	highlights: HighlightRow[],
	decorativeColors: boolean,
	categoryLabels: Record<string, string>
) {
	return highlights
		.map((highlight) => {
			const attrs = highlightAttributes(highlight, decorativeColors, categoryLabels);
			const children = [
				`<text>${escapeText(highlight.text ?? '')}</text>`,
				highlight.comment ? `<comment>${escapeText(highlight.comment)}</comment>` : '',
				...sortAnnotations(highlight.annotations).map(
					(annotation) =>
						`<annotation source="${annotation.source}">${escapeText(annotation.body)}</annotation>`
				)
			].filter(Boolean);

			return `<highlight ${attrs}>\n${children.join('\n')}\n</highlight>`;
		})
		.join('\n\n');
}

function highlightAttributes(
	highlight: HighlightRow,
	decorativeColors: boolean,
	categoryLabels?: Record<string, string>
) {
	const attrs = [`id="${highlight.ordinal}"`, `page="${highlight.page_number}"`];
	if (!decorativeColors && highlight.category != null) {
		attrs.push(`slot="${highlight.category}"`);
		attrs.push(
			`category="${escapeAttribute(categoryLabels?.[String(highlight.category)] ?? `Slot ${highlight.category}`)}"`
		);
	}
	return attrs.join(' ');
}

function sortAnnotations(annotations: Annotation[] | undefined) {
	return [...(annotations ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function escapeText(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

function escapeAttribute(value: string) {
	return escapeText(value).replaceAll('"', '&quot;');
}
