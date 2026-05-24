import type {
	DeepLibrarySearchIntent,
	DeepLibrarySearchResult,
	DeepLibrarySearchStatusStep
} from '$lib/search/deep-library-search-types';

export type DeepSearchSseEvent =
	| { event: 'ready'; prompt: string }
	| { event: 'status' } & DeepLibrarySearchStatusStep
	| {
			event: 'complete';
			interpretedIntent: DeepLibrarySearchIntent;
			statusSteps: DeepLibrarySearchStatusStep[];
			results: DeepLibrarySearchResult[];
	  }
	| { event: 'error'; message: string };

export function parseDeepSearchSseBlock(block: string): DeepSearchSseEvent | null {
	const lines = block
		.split('\n')
		.map((line) => line.trimEnd())
		.filter(Boolean);
	if (lines.length === 0) {
		return null;
	}

	let eventName = 'message';
	const dataLines: string[] = [];
	for (const line of lines) {
		if (line.startsWith('event:')) {
			eventName = line.slice(6).trim();
		} else if (line.startsWith('data:')) {
			dataLines.push(line.slice(5).trimStart());
		}
	}

	const data = dataLines.join('\n');
	if (!data) {
		return null;
	}

	const parsed = JSON.parse(data) as Record<string, unknown>;
	return { event: eventName, ...parsed } as DeepSearchSseEvent;
}

export async function consumeDeepSearchSseStream(
	body: ReadableStream<Uint8Array>,
	onEvent: (event: DeepSearchSseEvent) => void
): Promise<void> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}

		buffer += decoder.decode(value, { stream: true });
		const blocks = buffer.split('\n\n');
		buffer = blocks.pop() ?? '';

		for (const block of blocks) {
			const event = parseDeepSearchSseBlock(block);
			if (event) {
				onEvent(event);
			}
		}
	}

	if (buffer.trim()) {
		const event = parseDeepSearchSseBlock(buffer);
		if (event) {
			onEvent(event);
		}
	}
}
