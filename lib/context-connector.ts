export default class ContextConnector<T> extends EventTarget {
  static UPDATE = "contextUpdate";

  constructor() {
    super();
  }

  publishContext(context: T) {
    this.dispatchEvent(new CustomEvent("contextUpdate", { detail: context }));
  }

  on(event: string, callback: (data: T) => void) {
    this.addEventListener(event, (e: CustomEventInit<T>) => {
      callback(e.detail!);
    });
  }

  onUpdate(callback: (data: T) => void) {
    this.on(ContextConnector.UPDATE, callback);
  }
}
