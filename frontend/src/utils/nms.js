/**
 * Non-Maximum Suppression (NMS) utility for bounding boxes.
 * Removes redundant overlapping detections around the same face.
 *
 * @param {Array<{x: number, y: number, width: number, height: number, score?: number}>} boxes
 * @param {number} iouThreshold Intersection Over Union threshold (typically 0.3 - 0.4)
 * @returns {Array<{x: number, y: number, width: number, height: number, score?: number}>}
 */
export function applyNMS(boxes, iouThreshold = 0.35) {
  if (!boxes || boxes.length === 0) return [];

  // Sort boxes descending by score / area
  const sorted = [...boxes].sort((a, b) => {
    const scoreA = a.score !== undefined ? a.score : (a.width * a.height);
    const scoreB = b.score !== undefined ? b.score : (b.width * b.height);
    return scoreB - scoreA;
  });

  const selected = [];

  for (const box of sorted) {
    let shouldKeep = true;
    for (const kept of selected) {
      const iou = calculateIoU(box, kept);
      if (iou > iouThreshold) {
        shouldKeep = false;
        break;
      }
    }
    if (shouldKeep) {
      selected.push(box);
    }
  }

  return selected;
}

function calculateIoU(boxA, boxB) {
  const xA = Math.max(boxA.x, boxB.x);
  const yA = Math.max(boxA.y, boxB.y);
  const xB = Math.min(boxA.x + boxA.width, boxB.x + boxB.width);
  const yB = Math.min(boxA.y + boxA.height, boxB.y + boxB.height);

  const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
  const areaA = boxA.width * boxA.height;
  const areaB = boxB.width * boxB.height;

  const unionArea = areaA + areaB - interArea;
  if (unionArea <= 0) return 0;
  return interArea / unionArea;
}

/**
 * Temporal smoothing buffer across consecutive frames.
 * Requires consistent face count across consecutive observations
 * to prevent flickering between states or false spikes.
 */
export class TemporalSmoother {
  constructor(windowSize = 4) {
    this.windowSize = windowSize;
    this.history = [];
  }

  addObservation(count) {
    this.history.push(count);
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }
  }

  getSmoothedCount() {
    if (this.history.length === 0) return 0;

    // Count frequency of observations
    const counts = {};
    for (const val of this.history) {
      counts[val] = (counts[val] || 0) + 1;
    }

    // Return the majority count
    let maxOccurrences = -1;
    let majorityCount = this.history[this.history.length - 1];

    for (const [valStr, occurrences] of Object.entries(counts)) {
      if (occurrences > maxOccurrences) {
        maxOccurrences = occurrences;
        majorityCount = Number(valStr);
      }
    }

    return majorityCount;
  }

  clear() {
    this.history = [];
  }
}

