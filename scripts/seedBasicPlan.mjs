import { seedBasicPlanState } from "./lib/seedDefinitions.mjs";
import { runStateSeed } from "./lib/stateSeedRunner.mjs";

await runStateSeed({
  name: "seedBasicPlan",
  mutate: seedBasicPlanState,
});
