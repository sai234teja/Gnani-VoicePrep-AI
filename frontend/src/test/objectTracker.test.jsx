import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MediaPipeObjectTracker } from '../utils/objectTracker';

describe('Computer Vision Integrity Monitoring - Stage 7 Conditions', () => {
  let tracker;

  beforeEach(() => {
    tracker = new MediaPipeObjectTracker();
  });

  it('Condition 1: One person in frame, no phone -> 1 person, 0 objects', async () => {
    tracker.isInitialized = true;
    tracker.detector = {
      detect: vi.fn().mockReturnValue({
        detections: [
          {
            categories: [{ categoryName: 'person', score: 0.88 }],
            boundingBox: { originX: 100, originY: 100, width: 200, height: 300 }
          }
        ]
      })
    };

    const mockVideo = { readyState: 4 };
    const res = await tracker.analyzeFrame(mockVideo);

    expect(res.personCount).toBe(1);
    expect(res.personState).toBe('one person');
    expect(res.objects).toHaveLength(0);
    expect(res.isAvailable).toBe(true);
  });

  it('Condition 2: One person with visible cell phone -> phone detected with confidence score', async () => {
    tracker.isInitialized = true;
    tracker.detector = {
      detect: vi.fn().mockReturnValue({
        detections: [
          {
            categories: [{ categoryName: 'person', score: 0.92 }],
            boundingBox: { originX: 100, originY: 100, width: 200, height: 300 }
          },
          {
            categories: [{ categoryName: 'cell phone', score: 0.79 }],
            boundingBox: { originX: 50, originY: 50, width: 40, height: 70 }
          }
        ]
      })
    };

    const mockVideo = { readyState: 4 };
    // Frame 1 (temporal accumulation)
    await tracker.analyzeFrame(mockVideo);

    // Frame 2 (temporal confirmation)
    tracker.lastProcessedTime = 0; // bypass throttle in test
    const res = await tracker.analyzeFrame(mockVideo);

    expect(res.personCount).toBe(1);
    expect(res.objects.length).toBeGreaterThanOrEqual(1);
    const phone = res.objects.find(o => o.label.toLowerCase() === 'cell phone');
    expect(phone).toBeDefined();
    expect(phone.score).toBe(79);
  });

  it('Condition 3: Two people in frame -> exactly 2 people, multiple people state', async () => {
    tracker.isInitialized = true;
    tracker.detector = {
      detect: vi.fn().mockReturnValue({
        detections: [
          {
            categories: [{ categoryName: 'person', score: 0.89 }],
            boundingBox: { originX: 50, originY: 50, width: 120, height: 250 }
          },
          {
            categories: [{ categoryName: 'person', score: 0.85 }],
            // Separate spatial position, non-overlapping
            boundingBox: { originX: 250, originY: 50, width: 120, height: 250 }
          }
        ]
      })
    };

    const mockVideo = { readyState: 4 };
    const res = await tracker.analyzeFrame(mockVideo);

    expect(res.personCount).toBe(2);
    expect(res.personState).toBe('multiple people');
  });

  it('Condition 4: Person entering and leaving frame -> transitions smoothly between 1 and 2', async () => {
    tracker.isInitialized = true;
    const mockVideo = { readyState: 4 };

    // Initially 1 person
    tracker.detector = {
      detect: vi.fn().mockReturnValue({
        detections: [
          {
            categories: [{ categoryName: 'person', score: 0.90 }],
            boundingBox: { originX: 50, originY: 50, width: 120, height: 250 }
          }
        ]
      })
    };
    let res = await tracker.analyzeFrame(mockVideo);
    expect(res.personCount).toBe(1);

    // Second person enters
    tracker.lastProcessedTime = 0;
    tracker.detector.detect.mockReturnValue({
      detections: [
        {
          categories: [{ categoryName: 'person', score: 0.90 }],
          boundingBox: { originX: 50, originY: 50, width: 120, height: 250 }
        },
        {
          categories: [{ categoryName: 'person', score: 0.82 }],
          boundingBox: { originX: 250, originY: 50, width: 120, height: 250 }
        }
      ]
    });
    res = await tracker.analyzeFrame(mockVideo);
    expect(res.personCount).toBe(2);
    expect(res.personState).toBe('multiple people');

    // Second person leaves
    tracker.lastProcessedTime = 0;
    tracker.detector.detect.mockReturnValue({
      detections: [
        {
          categories: [{ categoryName: 'person', score: 0.90 }],
          boundingBox: { originX: 50, originY: 50, width: 120, height: 250 }
        }
      ]
    });
    res = await tracker.analyzeFrame(mockVideo);
    expect(res.personCount).toBe(1);
    expect(res.personState).toBe('one person');
  });

  it('Condition 5: Book or laptop visible -> detected with proper label and score', async () => {
    tracker.isInitialized = true;
    tracker.detector = {
      detect: vi.fn().mockReturnValue({
        detections: [
          {
            categories: [{ categoryName: 'person', score: 0.91 }],
            boundingBox: { originX: 100, originY: 100, width: 200, height: 300 }
          },
          {
            categories: [{ categoryName: 'laptop', score: 0.81 }],
            boundingBox: { originX: 80, originY: 200, width: 150, height: 100 }
          },
          {
            categories: [{ categoryName: 'book', score: 0.65 }],
            boundingBox: { originX: 240, originY: 210, width: 80, height: 60 }
          }
        ]
      })
    };

    const mockVideo = { readyState: 4 };
    // Pass two frames for temporal confirmation
    await tracker.analyzeFrame(mockVideo);
    tracker.lastProcessedTime = 0;
    const res = await tracker.analyzeFrame(mockVideo);

    const labels = res.objects.map(o => o.label.toLowerCase());
    expect(labels).toContain('laptop');
    expect(labels).toContain('book');
  });

  it('Condition 6: Low confidence or poor lighting -> falls below threshold, no spurious objects', async () => {
    tracker.isInitialized = true;
    tracker.detector = {
      detect: vi.fn().mockReturnValue({
        detections: [
          // Below threshold score 0.45
          {
            categories: [{ categoryName: 'cell phone', score: 0.28 }],
            boundingBox: { originX: 50, originY: 50, width: 40, height: 70 }
          },
          {
            categories: [{ categoryName: 'person', score: 0.85 }],
            boundingBox: { originX: 100, originY: 100, width: 200, height: 300 }
          }
        ]
      })
    };

    const mockVideo = { readyState: 4 };
    const res = await tracker.analyzeFrame(mockVideo);

    expect(res.personCount).toBe(1);
    expect(res.objects).toHaveLength(0); // low-confidence phone ignored
  });

  it('Condition 7: Video unready or camera disconnected -> handles gracefully without crashing', async () => {
    tracker.isInitialized = true;
    const unreadyVideo = { readyState: 0 };
    const res = await tracker.analyzeFrame(unreadyVideo);

    expect(res.personCount).toBe(0);
    expect(res.personState).toBe('no person');
    expect(res.objects).toEqual([]);
    expect(res.isAvailable).toBe(true);
  });

  it('Condition 8: Model initialization failure -> graceful fallback with notice', async () => {
    tracker.isInitialized = false;
    tracker.initFailed = true; // Simulating failed download / WebGL unsupported

    const mockVideo = { readyState: 4 };
    const res = await tracker.analyzeFrame(mockVideo);

    expect(res.isAvailable).toBe(false);
    expect(res.personState).toBe('detection unavailable');
    expect(res.notice).toContain('unavailable');
  });
});

