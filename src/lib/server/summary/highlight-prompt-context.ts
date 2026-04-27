import { DEFAULT_CATEGORY_LABELS, parseCategoryLabels } from '$lib/domain/highlight-categories';

export type HighlightPromptContext =
	| {
			decorativeColors: true;
			userMessage: string;
	  }
	| {
			decorativeColors: false;
			userMessage: string;
			categoryLines: string[];
	  };

/**
 * Assembles the user-facing instruction block for future summary / AI prompts
 * (Issue 04 — no model calls yet; contract is unit-tested).
 */
export function buildHighlightPromptContext(opts: {
	categoryLabels?: unknown;
	useColorsDecoratively: boolean;
}): HighlightPromptContext {
	const labels = parseCategoryLabels(opts.categoryLabels);

	if (opts.useColorsDecoratively) {
		return {
			decorativeColors: true,
			userMessage:
				'Highlight colors are decorative only — do not treat colors as semantic categories or evidence of the reader’s intent.'
		};
	}

	const categoryLines = [1, 2, 3, 4, 5].map(
		(slot) =>
			`Slot ${slot}: ${labels[String(slot)] ?? DEFAULT_CATEGORY_LABELS[String(slot)]}`
	);

	return {
		decorativeColors: false,
		userMessage:
			'The reader assigned each highlight to one of five fixed semantic category slots (1–5). Use the slot labels below when interpreting highlights.',
		categoryLines
	};
}

export function formatHighlightPromptContextForModel(ctx: HighlightPromptContext): string {
	if (ctx.decorativeColors) {
		return ctx.userMessage;
	}
	return [ctx.userMessage, ...ctx.categoryLines].join('\n');
}
