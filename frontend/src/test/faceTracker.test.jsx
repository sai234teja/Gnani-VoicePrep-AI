import { describe, it, expect, vi } from 'vitest';
import { applyNMS, TemporalSmoother } from '../utils/nms';
import { RobustFaceTracker } from '../utils/faceTracker';

describe('Face Tracking & Overlap Resolution Unit Tests', () => {

  it('NMS removes redundant overlapping bounding boxes around one face', () => {
    // Simulate multiple overlapping candidate detections around the same face
    const overlappingBoxes = [
      { x: 100, y: 100, width: 80, height: 80, score: 0.95 },
      { x: 104, y: 102, width: 78, height: 79, score: 0.91 },
      { x: 98, y: 105, width: 82, height: 81, score: 0.88 },
      { x: 102, y: 99, width: 79, height: 80, score: 0.85 },
      { x: 105, y: 105, width: 75, height: 76, score: 0.82 }
    ];

    const uniqueFaces = applyNMS(overlappingBoxes, 0.35);

    // Exactly 1 unique face should be retained after NMS
    expect(uniqueFaces.length).toBe(1);
    expect(uniqueFaces[0].score).toBe(0.95);
  });

  it('NMS correctly preserves two distinct separate faces', () => {
    const twoPeopleBoxes = [
      // Person 1 (left) with 2 overlapping hits
      { x: 50, y: 100, width: 80, height: 80, score: 0.92 },
      { x: 53, y: 102, width: 78, height: 80, score: 0.85 },
      // Person 2 (right) with 2 overlapping hits
      { x: 350, y: 100, width: 85, height: 85, score: 0.94 },
      { x: 348, y: 103, width: 84, height: 86, score: 0.88 }
    ];

    const uniqueFaces = applyNMS(twoPeopleBoxes, 0.35);

    // Exactly 2 distinct faces must be retained
    expect(uniqueFaces.length).toBe(2);
  });

  it('Temporal smoother stabilizes head movement across consecutive frames', () => {
    const smoother = new TemporalSmoother(4);

    // Sequence of observations when candidate moves head: [1, 1, 1, 1]
    smoother.addObservation(1);
    smoother.addObservation(1);
    smoother.addObservation(1);
    smoother.addObservation(1);
    expect(smoother.getSmoothedCount()).toBe(1);

    // One momentary single-frame flicker / missed frame should not toggle state
    smoother.addObservation(0);
    // History is [1, 1, 1, 0] -> majority vote remains 1
    expect(smoother.getSmoothedCount()).toBe(1);
  });

  it('RobustFaceTracker outputs the exact required 4 states', async () => {
    const tracker = new RobustFaceTracker();

    // 1. Empty room
    expect(tracker._formatStateResult(0, [], true).state).toBe('No face detected');

    // 2. One person in front of camera
    expect(tracker._formatStateResult(1, [{ x: 10, y: 10, width: 50, height: 50 }], true).state).toBe('One face detected');

    // 3. Two people visible
    expect(tracker._formatStateResult(2, [{}, {}], true).state).toBe('Multiple faces detected');

    // 4. Face detection unavailable (model or camera hardware missing)
    expect(tracker._formatStateResult(0, [], false).state).toBe('Face detection unavailable');
  });

});

