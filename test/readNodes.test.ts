import { describe, expect, it } from 'vitest';
import { createCommandQueue } from '../pixso-plugin/plugin-src/utils/commandQueue.js';
import {
  serializeEffect,
  serializePaints,
  serializeRadius,
  serializePadding,
  toHexColor,
  truncateText
} from '../pixso-plugin/plugin-src/utils/serialize.js';

describe('serialize', () => {
  it('serializes solid colors to hex', () => {
    expect(toHexColor({ r: 0.17647058823529413, g: 0.7843137254901961, b: 0.596078431372549 })).toBe('#2dc898');
    expect(toHexColor({ r: 1, g: 1, b: 1 })).toBe('#ffffff');
  });

  it('appends alpha byte only when translucent', () => {
    expect(toHexColor({ r: 0, g: 0, b: 0, a: 1 })).toBe('#000000');
    expect(toHexColor({ r: 0, g: 0, b: 0, a: 0.1 })).toBe('#0000001a');
    expect(toHexColor({ r: 0, g: 0, b: 0, a: 0 })).toBe('#00000000');
  });

  it('serializes paints, dropping invisible ones', () => {
    const paints = serializePaints([
      { type: 'SOLID', color: { r: 1, g: 0, b: 0 } },
      { type: 'SOLID', visible: false, color: { r: 0, g: 1, b: 0 } },
      {
        type: 'GRADIENT_LINEAR',
        gradientStops: [
          { position: 0, color: { r: 0.05, g: 0.62, b: 0.47, a: 1 } },
          { position: 0.5, color: { r: 0.176, g: 0.784, b: 0.596, a: 1 } }
        ]
      }
    ]);
    expect(paints).toEqual([
      { type: 'SOLID', color: '#ff0000' },
      {
        type: 'GRADIENT_LINEAR',
        stops: [
          { position: 0, color: '#0d9e78' },
          { position: 0.5, color: '#2dc898' }
        ]
      }
    ]);
  });

  it('serializes effects to compact shadow records', () => {
    expect(
      serializeEffect({ type: 'DROP_SHADOW', offset: { x: 0, y: 2 }, radius: 8, color: { r: 0.06, g: 0.62, b: 0.47 } })
    ).toEqual({ type: 'DROP_SHADOW', offset: [0, 2], radius: 8, color: '#0f9e78' });
    expect(serializeEffect({ type: 'DROP_SHADOW', visible: false, offset: { x: 0, y: 2 }, radius: 8 })).toBeUndefined();
  });

  it('collapses matching corner radii and keeps diffs only', () => {
    expect(serializeRadius(12)).toBe(12);
    expect(serializeRadius(0, 0, 0, 0, 0)).toBe(0);
    expect(serializeRadius(12, 12, 12, 12, 16)).toEqual({ tl: 12, tr: 12, bl: 12, br: 16 });
  });

  it('collapses uniform padding', () => {
    expect(serializePadding(16, 16, 16, 16)).toBe(16);
    expect(serializePadding(12, 20, 12, 20)).toEqual({ t: 12, r: 20, b: 12, l: 20 });
    expect(serializePadding()).toBeUndefined();
  });

  it('truncates long text', () => {
    expect(truncateText('abc')).toBe('abc');
    expect(truncateText('x'.repeat(130))).toHaveLength(121);
    expect(truncateText(undefined)).toBeUndefined();
  });
});

describe('commandQueue', () => {
  it('runs tasks strictly in submission order', async () => {
    const queue = createCommandQueue();
    const order: string[] = [];
    const task = (label: string, delay: number) => () =>
      new Promise<void>(resolve => {
        setTimeout(() => {
          order.push(label);
          resolve();
        }, delay);
      });
    const results = await Promise.all([
      queue.run(task('a', 30)),
      queue.run(task('b', 5)),
      queue.run(task('c', 1))
    ]);
    expect(results).toEqual([undefined, undefined, undefined]);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('reports busy and pending counts', async () => {
    const queue = createCommandQueue();
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const first = queue.run(() => gate);
    const second = queue.run(() => 'done');
    // both are submitted; neither has completed. busy() is true synchronously.
    expect(queue.busy()).toBe(true);
    expect(queue.pending()).toBe(2);
    release();
    expect(await second).toBe('done');
    await first;
    expect(queue.busy()).toBe(false);
    expect(queue.pending()).toBe(0);
  });

  it('does not let a rejected task break the queue', async () => {
    const queue = createCommandQueue();
    await expect(queue.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(await queue.run(() => 'ok')).toBe('ok');
  });
});
