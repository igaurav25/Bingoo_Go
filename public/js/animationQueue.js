/**
 * public/js/animationQueue.js
 * 
 * Sequential FIFO animation queue.
 * Guarantees that animations play strictly one after another without overlaps,
 * deduplicates items by key, speeds up playback if >2 items are queued,
 * and supports clean teardown/cancellation.
 */

export class AnimationQueue {
  constructor() {
    this.queue = [];
    this.isPlaying = false;
    this.activeTask = null;
    this.seenKeys = new Set();
  }

  /**
   * Enqueues an animation task.
   * @param {string} key - unique identifier for deduplication (e.g. lineId)
   * @param {(isAccelerated: boolean) => Promise<void>} taskFn
   */
  enqueue(key, taskFn) {
    if (this.seenKeys.has(key)) {
      return;
    }
    this.seenKeys.add(key);
    this.queue.push({ key, taskFn });

    if (!this.isPlaying) {
      this._processNext();
    }
  }

  /**
   * Marks a key as already seen/hydrated without animating it.
   * @param {string} key
   */
  markSeen(key) {
    this.seenKeys.add(key);
  }

  async _processNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.activeTask = null;
      return;
    }

    this.isPlaying = true;
    const item = this.queue.shift();
    // Speed up playback if more than 2 items are waiting in the queue
    const isAccelerated = this.queue.length >= 2;

    this.activeTask = item;
    try {
      await item.taskFn(isAccelerated);
    } catch (err) {
      console.error('[AnimationQueue] Error playing task for key:', item.key, err);
    } finally {
      this.activeTask = null;
      this._processNext();
    }
  }

  /**
   * Clears the queue and resets state.
   */
  clear() {
    this.queue = [];
    this.isPlaying = false;
    this.activeTask = null;
  }
}
