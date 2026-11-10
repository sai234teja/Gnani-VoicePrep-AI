import '@testing-library/jest-dom';

// Polyfills for JSDOM browser environment
if (typeof window !== 'undefined') {
  // Mock HTMLCanvasElement getContext
  window.HTMLCanvasElement.prototype.getContext = () => ({
    drawImage: () => { },
    getImageData: () => ({ data: new Uint8ClampedArray(160 * 120 * 4) }),
    clearRect: () => { },
    strokeRect: () => { },
    fillRect: () => { },
    setTransform: () => { },
    measureText: () => ({ width: 0 })
  });

  // Mock HTMLMediaElement play / pause
  window.HTMLMediaElement.prototype.play = () => Promise.resolve();
  window.HTMLMediaElement.prototype.pause = () => { };

  // Mock navigator.mediaDevices.getUserMedia
  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {};
  }
  navigator.mediaDevices.getUserMedia = () => {
    const mockTrack = {
      stop: () => { },
      enabled: true,
      addEventListener: () => { },
      removeEventListener: () => { }
    };
    return Promise.resolve({
      getTracks: () => [mockTrack],
      getVideoTracks: () => [mockTrack],
      getAudioTracks: () => [mockTrack]
    });
  };

  // Mock MediaRecorder
  window.MediaRecorder = class MockMediaRecorder {
    constructor(stream, options) {
      this.stream = stream;
      this.options = options;
      this.state = 'inactive';
    }
    start() {
      this.state = 'recording';
    }
    stop() {
      this.state = 'inactive';
      if (this.onstop) this.onstop();
    }
    static isTypeSupported() {
      return true;
    }
  };

  // Mock AudioContext
  window.AudioContext = class MockAudioContext {
    createAnalyser() {
      return {
        fftSize: 64,
        frequencyBinCount: 32,
        getByteFrequencyData: (arr) => arr.fill(20),
        connect: () => { }
      };
    }
    createMediaStreamSource() {
      return { connect: () => { } };
    }
    close() {
      return Promise.resolve();
    }
  };
  window.webkitAudioContext = window.AudioContext;

  // Mock URL.createObjectURL
  window.URL.createObjectURL = () => 'blob:mock-preview-url';
  window.URL.revokeObjectURL = () => { };
}
