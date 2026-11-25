import { AlarmSoundType } from './taskLogic';

let sharedAudioCtx: AudioContext | null = null;
let activeLoopInterval: number | null = null;
let activeCustomAudioEl: HTMLAudioElement | null = null;
let previewCustomAudioEl: HTMLAudioElement | null = null;
let previewTimeoutId: number | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {
      // Browser autoplay restriction until first user interaction
    });
  }
  return sharedAudioCtx;
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startOffsetSec: number,
  durationSec: number,
  type: OscillatorType = 'sine',
  peakGain: number = 0.22
) {
  const now = ctx.currentTime + startOffsetSec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + durationSec + 0.02);
}

/**
 * Plays one full musical/alert cycle of a built-in alarm sound from the Sound Gallery.
 */
export function playAlarmPatternOnce(sound: AlarmSoundType): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  switch (sound) {
    case 'classic':
      // Dual-bell alternating ring (classic desk alarm)
      for (let i = 0; i < 6; i++) {
        playTone(
          ctx,
          i % 2 === 0 ? 987.77 : 1318.51,
          i * 0.11,
          0.1,
          'triangle',
          0.24
        );
      }
      break;
    case 'digital':
      // Crisp 4-beep digital watch alarm
      for (let i = 0; i < 4; i++) {
        playTone(ctx, 1760, i * 0.16, 0.09, 'square', 0.14);
      }
      break;
    case 'chime':
      // Warm ascending triad chime
      playTone(ctx, 523.25, 0.0, 0.45, 'sine', 0.22); // C5
      playTone(ctx, 659.25, 0.18, 0.45, 'sine', 0.22); // E5
      playTone(ctx, 783.99, 0.36, 0.55, 'sine', 0.24); // G5
      playTone(ctx, 1046.5, 0.56, 0.65, 'sine', 0.22); // C6
      break;
    case 'urgent':
      // High-urgency rising pulse
      playTone(ctx, 880, 0.0, 0.14, 'sawtooth', 0.16);
      playTone(ctx, 1174.66, 0.16, 0.14, 'sawtooth', 0.18);
      playTone(ctx, 1396.91, 0.32, 0.22, 'sawtooth', 0.2);
      playTone(ctx, 1174.66, 0.58, 0.14, 'sawtooth', 0.18);
      playTone(ctx, 1396.91, 0.74, 0.24, 'sawtooth', 0.2);
      break;
    case 'harp':
      // Morning Harp pentatonic arpeggio
      [392.0, 440.0, 523.25, 587.33, 659.25, 783.99].forEach((freq, idx) => {
        playTone(ctx, freq, idx * 0.12, 0.5, 'triangle', 0.19);
      });
      break;
    case 'gong':
      // Deep resonant Zen Gong with harmonic shimmer
      playTone(ctx, 196.0, 0.0, 1.4, 'sine', 0.28);
      playTone(ctx, 293.66, 0.02, 1.1, 'sine', 0.14);
      playTone(ctx, 587.33, 0.05, 0.9, 'triangle', 0.08);
      break;
    case 'custom':
    default:
      // Fallback chime if custom file isn't attached
      playTone(ctx, 523.25, 0.0, 0.35, 'sine', 0.22);
      playTone(ctx, 659.25, 0.16, 0.35, 'sine', 0.22);
      playTone(ctx, 783.99, 0.32, 0.45, 'sine', 0.22);
      break;
  }
}

export function stopPreviewAudio(): void {
  if (previewTimeoutId !== null) {
    window.clearTimeout(previewTimeoutId);
    previewTimeoutId = null;
  }
  if (previewCustomAudioEl) {
    try {
      previewCustomAudioEl.pause();
      previewCustomAudioEl.currentTime = 0;
    } catch {
      // Ignore cleanup errors
    }
    previewCustomAudioEl = null;
  }
}

/**
 * Plays a short preview of either a built-in gallery tone or a user-chosen audio file.
 */
export function previewAlarmSound(
  sound: AlarmSoundType,
  customAudioDataUrl?: string | null
): void {
  stopPreviewAudio();

  if (sound === 'custom' && customAudioDataUrl && typeof Audio !== 'undefined') {
    try {
      const audio = new Audio(customAudioDataUrl);
      audio.volume = 0.85;
      previewCustomAudioEl = audio;
      audio.play().catch(() => {
        playAlarmPatternOnce('chime');
      });
      previewTimeoutId = window.setTimeout(() => {
        stopPreviewAudio();
      }, 4500);
      return;
    } catch {
      playAlarmPatternOnce('chime');
      return;
    }
  }

  playAlarmPatternOnce(sound);
}

/**
 * Starts a continuous repeating alarm ring until stopRingingAlarm() is called.
 * Supports both built-in gallery tones and custom uploaded device audio files.
 */
export function startRingingAlarm(
  sound: AlarmSoundType,
  customAudioDataUrl?: string | null
): void {
  stopRingingAlarm();

  if (sound === 'custom' && customAudioDataUrl && typeof Audio !== 'undefined') {
    try {
      const audio = new Audio(customAudioDataUrl);
      audio.loop = true;
      audio.volume = 0.9;
      activeCustomAudioEl = audio;
      audio.play().catch(() => {
        // Fallback to Web Audio API loop if custom HTMLAudio playback fails
        activeCustomAudioEl = null;
        playAlarmPatternOnce('classic');
        activeLoopInterval = window.setInterval(() => {
          playAlarmPatternOnce('classic');
        }, 1800);
      });
      return;
    } catch {
      // Fall through to synthesized loop
    }
  }

  playAlarmPatternOnce(sound);
  activeLoopInterval = window.setInterval(() => {
    playAlarmPatternOnce(sound);
  }, 1800);
}

/**
 * Immediately silences any active ringing alarm loop or custom audio element.
 */
export function stopRingingAlarm(): void {
  if (activeLoopInterval !== null) {
    window.clearInterval(activeLoopInterval);
    activeLoopInterval = null;
  }
  if (activeCustomAudioEl) {
    try {
      activeCustomAudioEl.pause();
      activeCustomAudioEl.currentTime = 0;
    } catch {
      // Ignore cleanup error
    }
    activeCustomAudioEl = null;
  }
}

/**
 * Reads an audio file chosen from the user's device/gallery as a base64 Data URL.
 * Validates type and size (<= 2.5 MB) for safe PostgreSQL persistence.
 */
export function readAudioFileAsDataUrl(
  file: File
): Promise<{ name: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const maxBytes = 2.5 * 1024 * 1024;
    if (file.size > maxBytes) {
      reject(
        new Error(
          'Audio file is too large (max 2.5 MB). Please choose a shorter ringtone or clip.'
        )
      );
      return;
    }
    const isAudioMime = file.type.startsWith('audio/');
    const hasAudioExt = /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name);
    if (!isAudioMime && !hasAudioExt) {
      reject(
        new Error('Please select a valid audio file (MP3, WAV, OGG, M4A, or AAC).')
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result.startsWith('data:')) {
        reject(new Error('Could not read audio file data.'));
        return;
      }
      resolve({ name: file.name, dataUrl: result });
    };
    reader.onerror = () => reject(new Error('Failed to read selected audio file.'));
    reader.readAsDataURL(file);
  });
}

// Browser Web Notifications API helpers for task alarms
export function getNotificationPermissionState():
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestAlarmNotificationPermission(): Promise<
  'granted' | 'denied' | 'default' | 'unsupported'
> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function sendAlarmBrowserNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      tag: 'taskflow-alarm',
      requireInteraction: true,
    });
  } catch {
    // Ignore restricted iframe notification context
  }
}

export const ALARM_SOUND_OPTIONS: {
  value: AlarmSoundType;
  label: string;
  description: string;
  category: 'built-in' | 'custom';
}[] = [
  {
    value: 'classic',
    label: 'Classic Bell',
    description: 'Traditional twin-bell ringing tone',
    category: 'built-in',
  },
  {
    value: 'digital',
    label: 'Digital Beep',
    description: 'Crisp repeating electronic watch beeps',
    category: 'built-in',
  },
  {
    value: 'chime',
    label: 'Gentle Chime',
    description: 'Warm ascending harmonic triad chime',
    category: 'built-in',
  },
  {
    value: 'urgent',
    label: 'Urgent Pulse',
    description: 'High-attention rising deadline alert',
    category: 'built-in',
  },
  {
    value: 'harp',
    label: 'Morning Harp',
    description: 'Soft pentatonic sunrise arpeggio',
    category: 'built-in',
  },
  {
    value: 'gong',
    label: 'Zen Gong',
    description: 'Deep resonant meditation bell for mindful transitions',
    category: 'built-in',
  },
  {
    value: 'custom',
    label: 'Custom Audio (Gallery)',
    description: 'Play your own audio ringtone chosen from device gallery',
    category: 'custom',
  },
];
