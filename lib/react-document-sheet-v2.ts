import ReactApplicationMixin, { type AnyComponent } from "./react-application-mixin";

const ReactDocumentSheetV2_Base: ReactApplicationMixin.Mix<typeof foundry.applications.api.DocumentSheetV2> =
  ReactApplicationMixin(foundry.applications.api.DocumentSheetV2);

export class ReactDocumentSheetV2<
  D extends foundry.abstract.Document.Any = foundry.abstract.Document.Any,
  C extends AnyComponent = AnyComponent,
  P extends object = React.ComponentProps<C>,
> extends ReactDocumentSheetV2_Base<D> {
  declare reactApp: C;
  declare initialProps: P;

  protected override _prepareProps(
    _context: foundry.applications.api.ApplicationV2.RenderContextOf<this>,
  ): P | Promise<P> {
    return this.initialProps;
  }
}
