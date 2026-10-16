// Local visual feedback from confirmed care history, never activity or rewards.
import { CARE_ACTIONS } from '../../shared/care.mjs';
export class CareFeedback {
  constructor(character) {
    this.seen = new Set();
    this.receive(character, true);
  }
  receive(character, replay = false) {
    let received = false;
    for (const entry of character?.care?.history || []) {
      if (!entry.id || !Object.hasOwn(CARE_ACTIONS, entry.action)) continue;
      const key = `${entry.id}:${entry.action}`;
      if (!this.seen.has(key) && !replay) received = true;
      this.seen.add(key);
    }
    return received;
  }
}
