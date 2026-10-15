// Local visual feedback from confirmed care history, never activity or rewards.
export class CareFeedback {
  constructor(character) {
    this.seen = new Set();
    this.receive(character, true);
  }
  receive(character, replay = false) {
    let received = false;
    for (const entry of character?.care?.history || []) {
      if (!entry.id || !['praise', 'snack', 'read'].includes(entry.action)) continue;
      const key = `${entry.id}:${entry.action}`;
      if (!this.seen.has(key) && !replay) received = true;
      this.seen.add(key);
    }
    return received;
  }
}
