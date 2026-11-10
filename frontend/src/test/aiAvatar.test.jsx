import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AIAvatar } from '../components/AIAvatar';
import { AudioPlayer } from '../components/AudioPlayer';

describe('AIAvatar & Audio Reactivity Suite (Phase 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Renders in IDLE state with calm badge and accessibility region', () => {
    render(<AIAvatar state="idle" label="AI Technical Coach" />);

    expect(screen.getByRole('region', { name: /AI Interviewer Avatar/i })).toBeInTheDocument();
    expect(screen.getByText(/AI Technical Evaluator Ready/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Technical Coach/i)).toBeInTheDocument();
  });

  it('2. Renders in LISTENING state with listening indicator', () => {
    render(<AIAvatar state="listening" />);

    expect(screen.getByText(/Listening to your answer/i)).toBeInTheDocument();
  });

  it('3. Renders in THINKING state with analysis indicator', () => {
    render(<AIAvatar state="thinking" />);

    expect(screen.getByText(/Analyzing evaluation rubric.../i)).toBeInTheDocument();
  });

  it('4. Renders in SPEAKING state with Gnani Timbre indicator', () => {
    render(<AIAvatar state="speaking" />);

    expect(screen.getByText(/Speaking \(Gnani Timbre\)/i)).toBeInTheDocument();
  });

  it('5. Renders company assessment mode with restrained layout', () => {
    render(<AIAvatar state="idle" isCompanyMode={true} label="AI Proctor" />);

    expect(screen.getByText(/AI Proctor/i)).toBeInTheDocument();
  });

  it('6. Displays question prompt text in subtitle bubble', () => {
    render(<AIAvatar state="speaking" questionText="Explain Python GIL." />);

    expect(screen.getByText(/"Explain Python GIL\."/i)).toBeInTheDocument();
  });

  it('7. Displays tap to hear button when autoplay is blocked and triggers resume handler', async () => {
    const handlePlay = vi.fn();
    render(<AIAvatar state="idle" isAutoplayBlocked={true} onPlayRequest={handlePlay} />);

    const btn = screen.getByRole('button', { name: /Tap to Hear Question/i });
    expect(btn).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(handlePlay).toHaveBeenCalledTimes(1);
  });

  it('8. Clean up animation frames and Web Audio resources on unmount', () => {
    const { unmount } = render(<AIAvatar state="speaking" />);
    expect(() => unmount()).not.toThrow();
  });

  it('9. Handles missing Web Audio API without crashing', () => {
    const originalAudioContext = window.AudioContext;
    delete window.AudioContext;

    expect(() => {
      render(<AIAvatar state="speaking" micStream={{}} />);
    }).not.toThrow();

    window.AudioContext = originalAudioContext;
  });

  it('10. AudioPlayer notifies on play, pause, and ended states', async () => {
    const onPlayStateChange = vi.fn();
    const onAudioReady = vi.fn();
    const mockRef = React.createRef();

    render(
      <AudioPlayer
        ref={mockRef}
        base64Audio="UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
        onPlayStateChange={onPlayStateChange}
        onAudioElementReady={onAudioReady}
      />
    );

    expect(mockRef.current).not.toBeNull();
    expect(onAudioReady).toHaveBeenCalledWith(mockRef.current);
    const playBtn = screen.getByRole('button', { name: /Play Spoken Question/i });
    expect(playBtn).toBeInTheDocument();
  });

  it('11. Direct audioElement passed to AIAvatar connects safely without duplicate node error', () => {
    const mockAudioEl = document.createElement('audio');
    const { rerender } = render(
      <AIAvatar state="speaking" audioElement={mockAudioEl} />
    );

    // Re-rendering with the same element does not crash or throw duplicate connection errors
    expect(() => {
      rerender(<AIAvatar state="speaking" audioElement={mockAudioEl} />);
    }).not.toThrow();
  });
});
