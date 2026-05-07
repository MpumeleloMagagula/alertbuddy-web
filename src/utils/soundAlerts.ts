import type { Severity } from '../types';

/**
 * Play an alert sound based on severity level
 * Uses Web Audio API for cross-browser compatibility
 */
export const playAlertSound = (severity: Severity, duration: number = 500) => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Different frequencies for different severities
    const frequencies: Record<Severity, number> = {
      CRITICAL: 800,  // High pitch for critical
      WARNING: 600,   // Medium pitch for warning
      INFO: 400,      // Low pitch for info
    };

    oscillator.frequency.value = frequencies[severity];
    oscillator.type = 'sine';

    // Fade out effect
    const startTime = audioContext.currentTime;
    const endTime = startTime + duration / 1000;

    gainNode.gain.setValueAtTime(0.3, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);

    oscillator.start(startTime);
    oscillator.stop(endTime);

    // Cleanup
    setTimeout(() => {
      audioContext.close();
    }, duration + 100);
  } catch (error) {
    console.error('Failed to play alert sound:', error);
  }
};

/**
 * Play a sequence of beeps for critical alerts
 */
export const playCriticalAlertSequence = () => {
  playAlertSound('CRITICAL', 200);
  setTimeout(() => playAlertSound('CRITICAL', 200), 300);
  setTimeout(() => playAlertSound('CRITICAL', 200), 600);
};

/**
 * Check if sound is enabled in user preferences
 */
export const isSoundEnabled = (): boolean => {
  const preference = localStorage.getItem('alert-buddy-sound-enabled');
  return preference !== 'false'; // Enabled by default
};

/**
 * Toggle sound preference
 */
export const toggleSound = (): boolean => {
  const currentValue = isSoundEnabled();
  const newValue = !currentValue;
  localStorage.setItem('alert-buddy-sound-enabled', String(newValue));
  return newValue;
};

/**
 * Play notification sound (lighter than alert sounds)
 */
export const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Gentle notification tone
    oscillator.frequency.value = 440; // A4 note
    oscillator.type = 'sine';

    const startTime = audioContext.currentTime;
    gainNode.gain.setValueAtTime(0.2, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

    oscillator.start(startTime);
    oscillator.stop(startTime + 0.15);

    setTimeout(() => {
      audioContext.close();
    }, 200);
  } catch (error) {
    console.error('Failed to play notification sound:', error);
  }
};
