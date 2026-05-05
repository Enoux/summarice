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
	//	TODO
	//  Real implementation of rate limiting to be added in the future. 
}
