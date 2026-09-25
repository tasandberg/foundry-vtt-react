/**
 * A React-enabled version of Foundry VTT's ActorSheetV2 class.
 *
 * This class extends the core ActorSheetV2 functionality by applying the ReactApplicationMixin,
 * which enables React component rendering within the actor sheet application.
 *
 * @extends {foundry.applications.sheets.ActorSheetV2}
 * @mixes ReactApplicationMixin
 *
 * @example
 * ```typescript
 * class MyActorSheet extends ReactActorSheetV2 {
 *   // Your custom React-enabled actor sheet implementation
 * }
 * ```
 */
import ReactApplicationMixin, { type AnyComponent } from "./react-application-mixin";

const ReactActorSheetV2_Base: ReactApplicationMixin.Mix<typeof foundry.applications.sheets.ActorSheetV2> =
  ReactApplicationMixin(foundry.applications.sheets.ActorSheetV2);

export class ReactActorSheetV2<
  C extends AnyComponent = AnyComponent,
  P extends object = React.ComponentProps<C>,
> extends ReactActorSheetV2_Base {
  declare reactApp: C;
  declare initialProps: P;

  protected override _prepareProps(
    _context: foundry.applications.api.ApplicationV2.RenderContextOf<this>,
  ): P | Promise<P> {
    return this.initialProps;
  }
}
