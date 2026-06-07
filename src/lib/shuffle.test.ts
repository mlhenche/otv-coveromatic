import { describe, it, expect } from 'vitest';
import { shuffle } from './shuffle';

describe('shuffle', () => {
    it('no muta el array original', () => {
        const original = [1, 2, 3, 4, 5];
        const copy = [...original];
        shuffle(original);
        expect(original).toEqual(copy);
    });

    it('devuelve un array nuevo (no la misma referencia)', () => {
        const arr = [1, 2, 3];
        expect(shuffle(arr)).not.toBe(arr);
    });

    it('preserva todos los elementos (mismo multiconjunto)', () => {
        const arr = [1, 2, 3, 4, 5, 5, 'a', 'b'];
        const result = shuffle(arr);
        expect(result).toHaveLength(arr.length);
        expect([...result].sort()).toEqual([...arr].sort());
    });

    it('maneja array vacío y de un elemento', () => {
        expect(shuffle([])).toEqual([]);
        expect(shuffle([42])).toEqual([42]);
    });
});
