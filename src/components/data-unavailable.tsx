import { Pill } from "./atoms";

/**
 * What a scenario shows when its data is not there.
 *
 * Two failure modes, deliberately worded differently, and neither of them
 * mentions a terminal command. Nobody in a client meeting has a shell, and
 * "Run npm run db:seed" in front of a CTO reads as an unfinished product rather
 * than a missing fixture.
 *
 * The three DB-backed simulated scenarios and the IDP page all render this
 * instead of throwing, because a `force-dynamic` server component that lets a
 * Prisma error escape produces a blank page — the worst possible outcome mid-demo.
 */
export function DataUnavailable({
  reason,
  what,
}: {
  /** "unreachable" = the database did not answer. "empty" = it answered, with nothing in it. */
  reason: "unreachable" | "empty";
  /** What this scenario needed, in plain words. e.g. "a twelve-month cash-flow series" */
  what: string;
}) {
  return (
    <div className="pw-card rounded-xl p-6">
      <Pill tone="caution" dot>
        {reason === "unreachable" ? "Data source unavailable" : "No fixtures loaded"}
      </Pill>

      {reason === "unreachable" ? (
        <>
          <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-navy/90">
            This scenario reads {what} from its database, and the database is not
            responding right now.
          </p>
          <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-muted">
            Nothing is wrong with the scenario itself — it is a hosting issue, and
            it clears as soon as the database is back. The other scenarios that do
            not depend on it are unaffected.
          </p>
        </>
      ) : (
        <>
          <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-navy/90">
            This environment has no demonstration fixtures loaded, so there is{" "}
            {what} to show.
          </p>
          <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-muted">
            The fixtures are a one-off load and are not part of the deployment, so a
            freshly provisioned environment starts empty by design.
          </p>
        </>
      )}
    </div>
  );
}
