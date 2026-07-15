import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

export function mountApp({
  App,
  element,
  initialProps = {},
  innerSelector,
}: {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  App: React.ComponentType<any>;
  element: Element;
  initialProps?: {};
  innerSelector: string;
}) {
  const root = createRoot(element);
  // flushSync forces React to commit synchronously so the real DOM exists by
  // the time _onRender resolves and Foundry fires its render-hook chain.
  flushSync(() => {
    root.render(
      <div id={innerSelector}>
        <App {...initialProps} />
      </div>
    );
  });
  // Caller owns the root and must unmount it on close — Foundry reuses a single
  // Application instance across open/close, so a dropped root stays mounted and
  // subscribed to the shared ContextConnector.
  return root;
}
