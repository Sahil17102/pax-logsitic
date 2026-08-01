import { createAppStatePool, createInitialAppState, migrateAppState, updateAppState } from "../../server/appState.js";

function log(name, level, message, details) {
  const suffix = details ? ` ${JSON.stringify(details)}` : "";
  const line = `[${name}] ${message}${suffix}`;
  if (level === "error") console.error(line);
  else console.log(line);
}

export async function runStateSeed({ name, mutate, prepareDryRun }) {
  const dryRun = process.argv.slice(2).includes("--dry-run");
  let pool;

  try {
    log(name, "info", dryRun ? "Starting dry run." : "Connecting to PostgreSQL.");
    if (dryRun) {
      const state = migrateAppState(createInitialAppState());
      if (prepareDryRun) await prepareDryRun(state);
      const result = await mutate(state);
      log(name, "info", `${result.message} No database changes were written.`, result.summary);
      return result;
    }

    pool = createAppStatePool();
    const result = await updateAppState(pool, mutate);
    log(name, "info", result.message, { ...result.summary, migrationApplied: result.migrationApplied });
    return result;
  } catch (error) {
    log(name, "error", error.message);
    process.exitCode = 1;
    return null;
  } finally {
    if (pool) await pool.end().catch((error) => log(name, "error", `Failed to close PostgreSQL pool: ${error.message}`));
  }
}
