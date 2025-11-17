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
  root.render(
    <div id={innerSelector}>
      <App {...initialProps} />
    </div>
  );
}
