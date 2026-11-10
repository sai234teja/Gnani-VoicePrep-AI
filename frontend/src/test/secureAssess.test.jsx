import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CameraDiagnostic from '../components/secure_assess/CameraDiagnostic';
import MicrophoneDiagnostic from '../components/secure_assess/MicrophoneDiagnostic';
import NetworkDiagnostic from '../components/secure_assess/NetworkDiagnostic';
import BrowserDiagnostic from '../components/secure_assess/BrowserDiagnostic';
import ConsentDialog from '../components/secure_assess/ConsentDialog';
import IdentityPhotoCapture from '../components/secure_assess/IdentityPhotoCapture';
import ScreenShareDiagnostic from '../components/secure_assess/ScreenShareDiagnostic';

describe('Gnani SecureAssess Diagnostic Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. CameraDiagnostic handles successful stream and reports ready', async () => {
    const mockTrack = {
      label: 'Integrated HD Webcam',
      getSettings: () => ({ width: 1280, height: 720, frameRate: 30 }),
      stop: vi.fn()
    };
    const mockStream = {
      getVideoTracks: () => [mockTrack],
      getTracks: () => [mockTrack]
    };

    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(mockStream)
    };

    const handleStatus = vi.fn();
    render(<CameraDiagnostic onStatusChange={handleStatus} autoStart={true} />);

    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument();
      expect(screen.getByText('Integrated HD Webcam')).toBeInTheDocument();
      expect(screen.getByText('1280 × 720')).toBeInTheDocument();
    });

    expect(handleStatus).toHaveBeenCalledWith(
      expect.objectContaining({ pass: true })
    );
  });

  it('2. CameraDiagnostic handles NotAllowedError with actionable instructions', async () => {
    const error = new Error('Permission denied');
    error.name = 'NotAllowedError';

    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockRejectedValue(error)
    };

    const handleStatus = vi.fn();
    render(<CameraDiagnostic onStatusChange={handleStatus} autoStart={true} />);

    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getByText(/Permission denied\. Please click the lock\/camera icon/i)).toBeInTheDocument();
    });

    expect(handleStatus).toHaveBeenCalledWith(
      expect.objectContaining({ pass: false })
    );
  });

  it('3. MicrophoneDiagnostic mounts AudioContext and detects volume meter', async () => {
    const mockAudioTrack = {
      label: 'Realtek High Definition Audio',
      stop: vi.fn()
    };
    const mockAudioStream = {
      getAudioTracks: () => [mockAudioTrack],
      getTracks: () => [mockAudioTrack]
    };

    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(mockAudioStream)
    };

    const mockAnalyser = {
      fftSize: 256,
      smoothingTimeConstant: 0.5,
      frequencyBinCount: 128,
      getByteFrequencyData: vi.fn(arr => {
        arr[0] = 50; // Simulate audio level
      })
    };

    class MockAudioContext {
      constructor() {
        this.state = 'running';
        this.sampleRate = 48000;
      }
      resume() { return Promise.resolve(); }
      close() { return Promise.resolve(); }
      createMediaStreamSource() {
        return { connect: vi.fn() };
      }
      createAnalyser() {
        return mockAnalyser;
      }
    }

    window.AudioContext = MockAudioContext;

    const handleStatus = vi.fn();
    render(<MicrophoneDiagnostic onStatusChange={handleStatus} autoStart={true} />);

    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument();
      expect(screen.getByText('Realtek High Definition Audio')).toBeInTheDocument();
    });

    expect(handleStatus).toHaveBeenCalledWith(
      expect.objectContaining({ pass: true })
    );
  });

  it('4. NetworkDiagnostic measures latency against health endpoint', async () => {
    global.fetch = vi.fn((url) => {
      if (url === '/api/health') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: 'healthy' })
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({})
      });
    });

    const handleStatus = vi.fn();
    render(<NetworkDiagnostic onStatusChange={handleStatus} autoStart={true} />);

    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument();
      expect(screen.getByText(/Target < 350ms/i)).toBeInTheDocument();
    });

    expect(handleStatus).toHaveBeenCalledWith(
      expect.objectContaining({ pass: true })
    );
  });

  it('5. BrowserDiagnostic detects required APIs and enables sound check', async () => {
    window.MediaRecorder = class {};
    document.fullscreenEnabled = true;

    const handleStatus = vi.fn();
    render(<BrowserDiagnostic onStatusChange={handleStatus} autoStart={true} />);

    await waitFor(() => {
      expect(screen.getByText('Compatible')).toBeInTheDocument();
      expect(screen.getByText('Play Test Chime')).toBeInTheDocument();
    });

    expect(handleStatus).toHaveBeenCalledWith(
      expect.objectContaining({ pass: true })
    );
  });

  it('6. ConsentDialog requires explicit agreement before granting consent', async () => {
    const handleConsent = vi.fn();
    const handleCancel = vi.fn();

    render(
      <ConsentDialog
        roleTitle="Senior Backend Engineer"
        onConsentGranted={handleConsent}
        onCancel={handleCancel}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Accept & Continue/i });
    expect(submitBtn).toBeDisabled();

    // Check all three consent checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(3);

    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);

    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    expect(handleConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        granted: true,
        scope: expect.arrayContaining(['telemetry_integrity'])
      })
    );
  });

  it('7. IdentityPhotoCapture requires consent before requesting camera', async () => {
    const mockTrack = { stop: vi.fn() };
    const mockStream = {
      getTracks: () => [mockTrack]
    };
    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(mockStream)
    };

    render(<IdentityPhotoCapture sessionId="test-session-123" onStatusChange={vi.fn()} />);

    expect(screen.getByText(/Candidate Privacy & Verification Notice/i)).toBeInTheDocument();
    const consentBtn = screen.getByRole('button', { name: /I Consent & Wish to Take Verification Photo/i });
    expect(consentBtn).toBeInTheDocument();

    fireEvent.click(consentBtn);

    await waitFor(() => {
      expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({ video: expect.anything() })
      );
    });
  });

  it('8. ScreenShareDiagnostic handles getDisplayMedia stream and stop event', async () => {
    const mockScreenTrack = {
      label: 'Primary Display Screen',
      getSettings: () => ({ width: 1920, height: 1080 }),
      stop: vi.fn(),
      onended: null
    };
    const mockScreenStream = {
      getVideoTracks: () => [mockScreenTrack],
      getTracks: () => [mockScreenTrack]
    };

    global.navigator.mediaDevices = {
      getDisplayMedia: vi.fn().mockResolvedValue(mockScreenStream)
    };

    const handleStatus = vi.fn();
    render(<ScreenShareDiagnostic onStatusChange={handleStatus} isRequired={false} />);

    const startBtn = screen.getByRole('button', { name: /Test Screen Share/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText('Sharing Active')).toBeInTheDocument();
      expect(screen.getByText(/Primary Display Screen/i)).toBeInTheDocument();
    });

    expect(handleStatus).toHaveBeenCalledWith(
      expect.objectContaining({ pass: true, active: true })
    );

    // Stop sharing
    const stopBtn = screen.getByRole('button', { name: /Stop Sharing/i });
    fireEvent.click(stopBtn);

    await waitFor(() => {
      expect(screen.getByText('Stopped')).toBeInTheDocument();
    });
  });
});
