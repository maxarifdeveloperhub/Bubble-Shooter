// A high-fidelity Web Audio API sound synthesizer that operates with zero assets
// and fully respects settings toggles.

let audioCtx: AudioContext | null = null;
let currentBpmOscillators: { node: OscillatorNode; gain: GainNode }[] = [];
let musicPlaying = false;
let musicInterval: number | null = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Low level sound playing helper
function playTone(freqStart: number, freqEnd: number, duration: number, type: OscillatorType = 'sine', volume = 0.1, customCurve = false) {
  try {
    initAudio();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, audioCtx.currentTime);
    if (freqEnd !== freqStart) {
      if (customCurve) {
        osc.frequency.exponentialRampToValueAtTime(freqEnd, audioCtx.currentTime + duration);
      } else {
        osc.frequency.linearRampToValueAtTime(freqEnd, audioCtx.currentTime + duration);
      }
    }

    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.warn('Audio failure:', e);
  }
}

export const SoundManager = {
  playShoot(sfxOn: boolean) {
    if (!sfxOn) return;
    // Synthesize shoot: freq sweep 120Hz to 350Hz, pitch decay with noise-like quality
    playTone(120, 480, 0.15, 'triangle', 0.25);
  },

  playPop(sfxOn: boolean, comboCount = 0) {
    if (!sfxOn) return;
    // Popping bubble: distinct high pitch drop with a slight pitch bend
    const pitchM = 1 + (comboCount * 0.12); // Pitch goes higher with combo!
    playTone(400 * pitchM, 180 * pitchM, 0.08, 'sine', 0.35, true);
    // Extra click
    setTimeout(() => {
      playTone(1200, 300, 0.02, 'sine', 0.1);
    }, 15);
  },

  playBounce(sfxOn: boolean) {
    if (!sfxOn) return;
    // Wall bounce: brief mid-low pluck
    playTone(220, 150, 0.06, 'sine', 0.2);
  },

  playComboUp(sfxOn: boolean, combo: number) {
    if (!sfxOn || combo <= 1) return;
    // Plays a sweet pentatonic rising chime
    const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25]; // C D E G A C D E
    const note = notes[Math.min(combo, notes.length - 1)];
    playTone(note, note * 1.5, 0.25, 'triangle', 0.2);
  },

  playUnlockPowerup(sfxOn: boolean) {
    if (!sfxOn) return;
    playTone(300, 900, 0.4, 'sine', 0.15);
    setTimeout(() => {
      playTone(450, 1350, 0.3, 'sine', 0.15);
    }, 100);
  },

  playUpgrade(sfxOn: boolean) {
    if (!sfxOn) return;
    playTone(261.63, 523.25, 0.12, 'sine', 0.2);
    setTimeout(() => {
      playTone(329.63, 659.25, 0.12, 'sine', 0.2);
    }, 80);
    setTimeout(() => {
      playTone(392.00, 783.99, 0.12, 'sine', 0.2);
    }, 160);
    setTimeout(() => {
      playTone(523.25, 1046.50, 0.3, 'sine', 0.2);
    }, 240);
  },

  playWin(sfxOn: boolean) {
    if (!sfxOn) return;
    // Winning melody C major chord
    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        playTone(freq, freq * 1.05, 0.35, 'sine', 0.2);
      }, idx * 120);
    });
  },

  playLose(sfxOn: boolean) {
    if (!sfxOn) return;
    // Sad falling tone
    const notes = [392.00, 311.13, 261.63, 196.00];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        playTone(freq, freq * 0.8, 0.4, 'triangle', 0.2);
      }, idx * 150);
    });
  },

  playClick(sfxOn: boolean) {
    if (!sfxOn) return;
    playTone(800, 400, 0.04, 'sine', 0.15);
  },

  startMusic(musicOn: boolean) {
    if (!musicOn) {
      this.stopMusic();
      return;
    }
    if (musicPlaying) return;
    musicPlaying = true;
    initAudio();

    // Loop simple synth baseline & melody notes every 500ms
    let step = 0;
    const melody = [
      440.00, 493.88, 523.25, 587.33, 659.25, 587.33, 523.25, 493.88,
      440.00, 440.00, 523.25, 440.00, 587.33, 440.00, 659.25, 392.00
    ];
    const bass = [
      110.00, 110.00, 130.81, 130.81, 146.83, 146.83, 164.81, 164.81,
      110.00, 110.00, 130.81, 130.81, 146.83, 164.81, 110.00, 98.00
    ];

    musicInterval = window.setInterval(() => {
      if (!musicOn || !audioCtx) return;
      try {
        if (audioCtx.state === 'suspended') return;
        
        const time = audioCtx.currentTime;

        // Play gentle Bass Pluck
        if (step % 2 === 0) {
          const bassFreq = bass[Math.floor(step / 2) % bass.length];
          const oscBase = audioCtx.createOscillator();
          const gainBase = audioCtx.createGain();
          oscBase.type = 'triangle';
          oscBase.frequency.setValueAtTime(bassFreq, time);
          gainBase.gain.setValueAtTime(0.04, time);
          gainBase.gain.exponentialRampToValueAtTime(0.001, time + 0.6);
          oscBase.connect(gainBase);
          gainBase.connect(audioCtx.destination);
          oscBase.start(time);
          oscBase.stop(time + 0.65);
        }

        // Play occasional melody note
        if (step % 3 === 0) {
          const melodyFreq = melody[Math.floor(step / 3) % melody.length];
          const oscMel = audioCtx.createOscillator();
          const gainMel = audioCtx.createGain();
          oscMel.type = 'sine';
          oscMel.frequency.setValueAtTime(melodyFreq, time);
          gainMel.gain.setValueAtTime(0.02, time);
          gainMel.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
          oscMel.connect(gainMel);
          gainMel.connect(audioCtx.destination);
          oscMel.start(time);
          oscMel.stop(time + 0.45);
        }

        step++;
      } catch (e) {
        console.warn('Music playback error:', e);
      }
    }, 380); // ~158 BPM
  },

  stopMusic() {
    musicPlaying = false;
    if (musicInterval) {
      clearInterval(musicInterval);
      musicInterval = null;
    }
  }
};
