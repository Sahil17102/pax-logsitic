import { seedLocationsState } from "./lib/seedDefinitions.mjs";
import { runStateSeed } from "./lib/stateSeedRunner.mjs";

await runStateSeed({
  name: "seedLocations",
  mutate: seedLocationsState,
});
