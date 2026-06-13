/**
 * Event-based bridge for pushing Foundry context updates into React.
 *
 * A `ReactApplicationMixin` instance creates one connector and calls
 * {@link ContextConnector.publishContext} on every render. React components
 * subscribe with {@link ContextConnector.onUpdate} to re-render on changes.
 */
export class ContextConnector<T> extends EventTarget {
  static UPDATE = "contextUpdate";

  /**
   * Maps each subscriber callback to the wrapper actually registered with
   * `addEventListener`, so `off`/`tearDown` can remove it by the original
   * callback reference.
   */
  #wrappers = new Map<(data: T) => void, EventListener>();

  publishContext(context: T) {
    this.dispatchEvent(
      new CustomEvent(ContextConnector.UPDATE, { detail: context })
    );
  }

  /**
   * Subscribe to an event. Returns a disposer that removes the listener,
   * convenient for React `useEffect` cleanup.
   */
  on(event: string, callback: (data: T) => void): () => void {
    if (!this.#wrappers.has(callback)) {
      const wrapper: EventListener = (e) =>
        callback((e as CustomEvent<T>).detail);
      this.#wrappers.set(callback, wrapper);
      this.addEventListener(event, wrapper);
    }
    return () => this.off(event, callback);
  }

  /** Subscribe to context updates. Returns a disposer. */
  onUpdate(callback: (data: T) => void): () => void {
    return this.on(ContextConnector.UPDATE, callback);
  }

  /** Remove a listener previously added with {@link on}. */
  off(event: string, callback: (data: T) => void) {
    const wrapper = this.#wrappers.get(callback);
    if (wrapper) {
      this.removeEventListener(event, wrapper);
      this.#wrappers.delete(callback);
    }
  }

  /** Remove a context-update listener previously added with {@link onUpdate}. */
  tearDown(callback: (data: T) => void) {
    this.off(ContextConnector.UPDATE, callback);
  }
}
