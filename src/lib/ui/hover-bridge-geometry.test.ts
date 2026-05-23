import { describe, expect, it } from 'vitest';

import {
	buildBridgePolygon,
	isPointInBridge,
	pointInPolygon,
	pointInRect
} from './hover-bridge-geometry';

const sourceBelow: { left: number; right: number; top: number; bottom: number } = {
	left: 100,
	right: 120,
	top: 200,
	bottom: 220
};

const targetAbove: { left: number; right: number; top: number; bottom: number } = {
	left: 80,
	right: 140,
	top: 120,
	bottom: 180
};

describe('hover-bridge-geometry', () => {
	it('pointInRect detects inside and outside', () => {
		expect(pointInRect({ x: 110, y: 210 }, sourceBelow)).toBe(true);
		expect(pointInRect({ x: 50, y: 210 }, sourceBelow)).toBe(false);
	});

	it('buildBridgePolygon connects vertically separated rects', () => {
		const polygon = buildBridgePolygon(sourceBelow, targetAbove, 10);
		expect(polygon).toHaveLength(4);
		expect(polygon[0].y).toBe(sourceBelow.top);
		expect(polygon[3].y).toBe(targetAbove.bottom);
	});

	it('isPointInBridge includes source, target, and gap between them', () => {
		const gap = 10;
		expect(isPointInBridge({ x: 110, y: 210 }, sourceBelow, targetAbove, gap)).toBe(true);
		expect(isPointInBridge({ x: 110, y: 150 }, sourceBelow, targetAbove, gap)).toBe(true);
		expect(isPointInBridge({ x: 110, y: 50 }, sourceBelow, targetAbove, gap)).toBe(false);
	});

	it('pointInPolygon matches isPointInBridge gap region', () => {
		const gap = 10;
		const polygon = buildBridgePolygon(sourceBelow, targetAbove, gap);
		const gapPoint = { x: 110, y: 190 };
		expect(pointInPolygon(gapPoint, polygon)).toBe(true);
		expect(isPointInBridge(gapPoint, sourceBelow, targetAbove, gap)).toBe(true);
	});
});
