/** Object Pool: reuses expensive objects (meshes, materials, canvases) instead of creating one per shot. */
export class Pool<T> {
  private readonly free: T[] = [];

  constructor(
    private readonly create: () => T,
    /** cap so a burst does not keep memory forever */
    private readonly maxFree = 64,
  ) {}

  acquire(): T {
    return this.free.pop() ?? this.create();
  }

  release(item: T): void {
    if (this.free.length < this.maxFree) this.free.push(item);
  }

  get size(): number {
    return this.free.length;
  }
}
