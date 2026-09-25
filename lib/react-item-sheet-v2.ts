import ReactApplicationMixin, { type AnyComponent, type ReactContext } from "./react-application-mixin";

const ReactItemSheetV2_Base: ReactApplicationMixin.Mix<typeof foundry.applications.sheets.ItemSheetV2> =
  ReactApplicationMixin(foundry.applications.sheets.ItemSheetV2);

export class ReactItemSheetV2<
  C extends AnyComponent = AnyComponent,
  P extends object = React.ComponentProps<C>,
> extends ReactItemSheetV2_Base {
  declare reactApp: C;
  declare initialProps: P;

  protected override _prepareProps(_context: ReactContext<this>): P | Promise<P> {
    return this.initialProps;
  }
}
