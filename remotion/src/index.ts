// ═══════════════════════════════════════════════════════════
// Ascentor Video Engine — Remotion entry point
// Registers the root composition that Trigger.dev bundles and
// `selectComposition({ id: 'AscentorKineticVideo' })` resolves.
// ═══════════════════════════════════════════════════════════
import { registerRoot } from 'remotion';
import { Root } from './Root';

registerRoot(Root);
