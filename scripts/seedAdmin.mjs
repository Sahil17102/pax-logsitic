import { resolveAdminSeedOptions, seedAdminState } from "./lib/seedDefinitions.mjs";
import { runStateSeed } from "./lib/stateSeedRunner.mjs";

const options = resolveAdminSeedOptions();
await runStateSeed({
  name: "seedAdmin",
  mutate: (state) => seedAdminState(state, options),
});
