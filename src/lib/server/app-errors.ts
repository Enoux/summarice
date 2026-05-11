/** Thrown when a requested entity does not exist or is not in scope for the current user. */
export class AppNotFoundError extends Error {
	readonly status = 404 as const;

	constructor(message = 'Not found') {
		super(message);
		this.name = 'AppNotFoundError';
	}
}

export function isAppNotFoundError(e: unknown): e is AppNotFoundError {
	return e instanceof AppNotFoundError;
}
