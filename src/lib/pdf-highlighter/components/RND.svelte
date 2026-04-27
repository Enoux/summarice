<script lang="ts">
	import { cssStringify } from '$lib/pdf-highlighter/utils';
	import type { Debounced } from '$lib/pdf-highlighter/utils';
	import { on } from 'svelte/events';
	import type {
		ViewportHighlight,
		PdfHighlighterUtils as TPdfHighlighterUtils,
		LTWH,
		LTWHP
	} from '$lib/pdf-highlighter/types';
	let {
		boundingRect,
		onDragOrResizeStop,
		bounds,
		color,
		isAllowTextSelection,
		allowTextSelection,
		pdfHighlighterUtils,
		highlight,
		onClick,
		isDraggable
	}: RndProps = $props();

	const defaultColor = pdfHighlighterUtils.colors?.[0] ?? 'yellow';
	color ??= defaultColor;

	interface RndProps {
		boundingRect: LTWHP;
		onDragOrResizeStop?: (data: LTWH) => void;
		bounds?: Element;
		color: string;
		highlight: ViewportHighlight;
		pdfHighlighterUtils: Partial<TPdfHighlighterUtils>;
		isAllowTextSelection: boolean;
		allowTextSelection: Debounced;
		//style?: string;
		onClick?(event: MouseEvent): void;
		isDraggable: boolean;
	}

	let bounds_rect = bounds?.getBoundingClientRect() ?? document.body.getBoundingClientRect();

	let style = $state({
		left: boundingRect.left,
		top: boundingRect.top,
		width: boundingRect.width,
		height: boundingRect.height,
		bottom: 0,
		right: 0
	});

	let moving = false;
	let resizing = false;
	let resizing_direction = '';

	let removeMouseUpListener: (() => void) | null = null;
	let removeMouseMoveListener: (() => void) | null = null;

	function onMouseDown(e: MouseEvent) {
		if (isAllowTextSelection) return;
		allowTextSelection.cancel();
		e.stopPropagation();
		moving = true;
		removeMouseUpListener = on(document, 'mouseup', onMouseUp);
		removeMouseMoveListener = on(document, 'mousemove', onMouseMove);
		bounds_rect = bounds?.getBoundingClientRect() ?? document.body.getBoundingClientRect();
	}

	function resizer_onMouseDown(e: MouseEvent, d: string) {
		removeMouseUpListener = on(document, 'mouseup', onMouseUp);
		removeMouseMoveListener = on(document, 'mousemove', onMouseMove);
		resizing = true;
		resizing_direction = d;
		bounds_rect = bounds?.getBoundingClientRect() ?? document.body.getBoundingClientRect();
	}

	function onMouseMove(e: MouseEvent) {
		if (!moving && !resizing) return;
		if (style.left <= 1) {
			style.left += 5;
			return;
		} else if (style.width + style.left >= bounds_rect.width) {
			style.left -= 5;
			return;
		} else if (style.top <= 1) {
			style.top += 5;
			return;
		} else if (style.height + style.top >= bounds_rect.height) {
			style.top -= 5;
			return;
		}
		if (style.height <= 11) {
			style.height += 1;
			//resizing = false;
			return;
		} else if (style.width <= 11) {
			style.width += 1;
			//resizing = false;
			return;
		}
		/*if (style.height <= 50 || style.width <= 50) {
            return;
        }*/

		if (moving) {
			style.left += e.movementX;
			style.top += e.movementY;
		} else if (resizing) {
			if (resizing_direction == 'nw') {
				style.width -= e.movementX;
				style.height -= e.movementY;
				style.left += e.movementX;
				style.top += e.movementY;
			} else if (resizing_direction == 'ne') {
				style.width += e.movementX;
				style.height -= e.movementY;
				style.right += e.movementX;
				style.top += e.movementY;
			} else if (resizing_direction == 'se') {
				style.width += e.movementX;
				style.height += e.movementY;
				style.right += e.movementX;
				style.bottom -= e.movementY;
			} else if (resizing_direction == 'sw') {
				style.width -= e.movementX;
				style.height += e.movementY;
				style.left += e.movementX;
				style.bottom += e.movementY;
			}
		}
	}

	function onMouseUp() {
		if (!moving && !resizing) return;
		removeMouseUpListener?.();
		removeMouseMoveListener?.();
		moving = false;
		resizing = false;
		onDragOrResizeStop?.(style);
	}

	/*onMount(() => {
        return () => {
        };
    });*/
	const scrolledToColor = pdfHighlighterUtils.scrolledTo_color;
</script>

<div
	role="button"
	aria-label="Area highlight"
	tabindex="0"
	style="{cssStringify(style, 'px')}; background: {pdfHighlighterUtils.scrolledToHighlightIdRef ===
		highlight.id && scrolledToColor
		? scrolledToColor
		: color};"
	class="{!isAllowTextSelection && isDraggable
		? 'draggable resizable'
		: 'resizable'} {pdfHighlighterUtils.scrolledToHighlightIdRef === highlight.id
		? 'AreaHighlight--scrolledTo'
		: 'AreaHighlight'}"
	onmousedown={(e) => {
		onClick?.(e);
		if (!isAllowTextSelection && isDraggable) {
			onMouseDown(e);
			e.preventDefault();
			e.stopPropagation();
		} else {
			if (highlight.id) {
				pdfHighlighterUtils.setCurrentHighlightId?.(highlight.id);
			}
		}
	}}
>
	<div class={isAllowTextSelection ? 'resizers allowSelect' : 'resizers'}>
		<div
			role="button"
			tabindex="0"
			aria-label="Resize highlight from top-left"
			onmousedown={(e) => {
				e.stopPropagation();
				e.preventDefault();
				resizer_onMouseDown(e, 'nw');
			}}
			class="resizer top-left"
		></div>
		<div
			role="button"
			tabindex="0"
			aria-label="Resize highlight from top-right"
			onmousedown={(e) => {
				e.stopPropagation();
				e.preventDefault();
				resizer_onMouseDown(e, 'ne');
			}}
			class="resizer top-right"
		></div>
		<div
			role="button"
			tabindex="0"
			aria-label="Resize highlight from bottom-left"
			onmousedown={(e) => {
				e.stopPropagation();
				e.preventDefault();
				resizer_onMouseDown(e, 'sw');
			}}
			class="resizer bottom-left"
		></div>
		<div
			role="button"
			tabindex="0"
			aria-label="Resize highlight from bottom-right"
			onmousedown={(e) => {
				e.stopPropagation();
				e.preventDefault();
				resizer_onMouseDown(e, 'se');
			}}
			class="resizer bottom-right"
		></div>
	</div>
	<!-- svelte-ignore slot_element_deprecated -->
	<slot></slot>
</div>

<style>
	.draggable {
		user-select: none;
		cursor: move;
		border: solid 1px gray;
		position: absolute;
		/*resize:both;overflow: auto;*/
		min-height: 10px;
		min-width: 10px;
	}

	.resizable {
		/*  background-color: palegoldenrod;*/
		user-select: none;
		cursor: pointer;
		position: absolute;
	}

	.resizable .resizers {
		width: 100%;
		height: 100%;
		/*border: 1px solid #000;*/
		border: none;
		box-sizing: border-box;
	}

	.resizable .resizers .resizer {
		width: 5px;
		height: 5px;
		/*border-radius: 50%;*/
		background: transparent;
		/*border: 1px solid #000;*/
		border: none;
		position: absolute;
	}
	.resizable:hover .resizers .resizer {
		border: 1px solid #000;
		background: #fff;
	}
	.resizable .resizers .resizer.top-left {
		left: -5px;
		top: -5px;
		cursor: nwse-resize; /*resizer cursor*/
	}
	.resizable .resizers .resizer.top-right {
		right: -5px;
		top: -5px;
		cursor: nesw-resize;
	}
	.resizable .resizers .resizer.bottom-left {
		left: -5px;
		bottom: -5px;
		cursor: nesw-resize;
	}
	.resizable .resizers .resizer.bottom-right {
		right: -5px;
		bottom: -5px;
		cursor: nwse-resize;
	}
	.allowSelect {
		/*pointer-events: none;*/
		user-select: text !important;
		cursor: text !important;
	}

	.AreaHighlight {
		transition: background 1s;
	}
	.AreaHighlight--scrolledTo {
		transition: none;
	}
</style>
