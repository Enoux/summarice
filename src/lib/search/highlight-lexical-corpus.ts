import type { CommentedHighlight } from '$lib/pdf-highlighter/types';

export function buildHighlightLexicalCorpus(highlight: CommentedHighlight): string {
	const highlightText =
		highlight.type === 'area' ? '' : (highlight.content?.text ?? '').trim();
	const comment = (highlight.comment ?? '').trim();
	const annotationBodies = (highlight.annotations ?? [])
		.map((annotation) => annotation.body.trim())
		.filter((body) => body.length > 0)
		.join(' ');

	return [highlightText, comment, annotationBodies].filter((part) => part.length > 0).join(' ');
}
