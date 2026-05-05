export class RateLimitError extends Error {
	constructor(message = 'Rate limit exceeded') {
		super(message);
		this.name = 'RateLimitError';
	}
}

export async function assertWithinLimit(_opts: {
	ownerId: string;
	operation: 'summary_generate';
}): Promise<void> {
	// Real enforcement lands in #17. This stub preserves the call site contract.
}
