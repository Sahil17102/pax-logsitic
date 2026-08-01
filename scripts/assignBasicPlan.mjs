import { assignBasicPlanState, resolveAdminSeedOptions, seedAdminState, seedBasicPlanState } from "./lib/seedDefinitions.mjs";
import { runStateSeed } from "./lib/stateSeedRunner.mjs";

const options = resolveAdminSeedOptions();
await runStateSeed({
  name: "assignBasicPlan",
  prepareDryRun: async (state) => {
    await seedAdminState(state, options);
    seedBasicPlanState(state);
  },
  mutate: (state) => assignBasicPlanState(state, options),
});
