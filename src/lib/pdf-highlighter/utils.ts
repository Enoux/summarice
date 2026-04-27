export function cssStringify(obj: Record<string, unknown>, postfix: string): string {
	const res = Object.keys(obj)
		.map((k) => {
			const value = obj[k];
			if (postfix === 'px' && Number.isFinite(Number.parseInt(String(value), 10))) {
				return `${k}: ${Number.parseInt(String(value), 10)}px`;
			} else if (
				typeof postfix === 'string' &&
				postfix.length > 0 &&
				Number.isFinite(Number.parseFloat(String(value)))
			) {
				return `${k}: ${Number.parseFloat(String(value))}${postfix}`;
			} else {
				return `${k}: ${String(value)}`;
			}
		})
		.join(';');
	return res;
}

export type Debounced<TArgs extends unknown[] = unknown[]> = {
	(...args: TArgs): void;
	cancel: () => void;
};
export function debounce<TArgs extends unknown[]>(
	func: (...args: TArgs) => void,
	_timeout: number
): Debounced<TArgs>;
export function debounce<TArgs extends unknown[]>(
	func: (...args: TArgs) => void,
	_timeout: () => number
): Debounced<TArgs>;
export function debounce<TArgs extends unknown[]>(
	func: (...args: TArgs) => void,
	_timeout: number | (() => number)
) {
	let timeout = 300;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const f: Debounced<TArgs> = Object.assign(
		(...args: TArgs) => {
			if (typeof _timeout === 'function') {
				timeout = _timeout();
				//console.log(_timeout());
			} else if (typeof _timeout === 'number') {
				timeout = _timeout;
			}

			if (timer) {
				clearTimeout(timer);
			}
			timer = setTimeout(() => {
				func(...args);
			}, timeout);
		},
		{
			cancel: () => {
				if (timer) {
					clearTimeout(timer);
				}
			}
		}
	);
	return f;
}
