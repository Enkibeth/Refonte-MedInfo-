/** Verrou synchrone d’un tour UI. Une résolution tardive après Arrêter est ignorée. */
export function createSubmissionGate() {
  let sequence = 0;
  let active: number | null = null;
  return {
    begin(): number | null {
      if (active !== null) return null;
      active = ++sequence;
      return active;
    },
    current(ticket: number) { return active === ticket; },
    finish(ticket: number) { if (active === ticket) active = null; },
    cancel() { active = null; sequence++; },
  };
}
