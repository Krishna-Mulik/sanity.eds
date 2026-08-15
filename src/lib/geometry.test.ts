import { describe, it, expect } from 'vitest';
import { columnSizes, clusterLayout } from './geometry';

describe('columnSizes', () => {
  it('keeps a single column for counts at or under the cap', () => {
    expect(columnSizes(1, 3)).toEqual([1]);
    expect(columnSizes(3, 3)).toEqual([3]);
  });

  it('splits 6 into the existing two even columns (no regression)', () => {
    expect(columnSizes(6, 3)).toEqual([3, 3]);
  });

  it('splits 7 into balanced columns with no lonely singleton', () => {
    const sizes = columnSizes(7, 3);
    expect(sizes).toEqual([3, 2, 2]);
    expect(sizes.every((n) => n > 1)).toBe(true);
  });

  it('always sums back to the original count', () => {
    for (let count = 1; count <= 12; count++) {
      const sizes = columnSizes(count, 3);
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(count);
    }
  });

  it('never produces a column larger than the cap', () => {
    for (let count = 1; count <= 20; count++) {
      const sizes = columnSizes(count, 3);
      expect(Math.max(...sizes)).toBeLessThanOrEqual(3);
    }
  });
});

describe('clusterLayout', () => {
  it('produces one position per bubble', () => {
    const positions = clusterLayout(7, 'right', 400, 900, 1440);
    expect(positions).toHaveLength(7);
  });

  it('mirrors dx sign between left and right docking', () => {
    const right = clusterLayout(6, 'right', 400, 900, 1440);
    const left = clusterLayout(6, 'left', 400, 900, 1440);
    right.forEach((p, i) => {
      expect(Math.sign(p.dx - left[i].dx)).not.toBe(0);
    });
  });
});
