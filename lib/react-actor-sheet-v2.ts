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
import ReactApplicationMixin from "./react-application-mixin";

export class ReactActorSheetV2 extends ReactApplicationMixin(foundry.applications.sheets.ActorSheetV2) {}
