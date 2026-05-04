const noteArea = document.getElementById('noteArea');
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const accuracyEl = document.getElementById('accuracy');
const startButton = document.getElementById('startButton');
const pauseButton = document.getElementById('pauseButton');
const audioInput = document.getElementById('audioInput');
const audioStatus = document.getElementById('audioStatus');
const musicPreview = document.getElementById('musicPreview');

const laneKeys = {
  KeyA: 0,
  Digit1: 0,
  KeyS: 1,
  Digit2: 1,
  KeyD: 2,
  Digit3: 2,
  KeyF: 3,
  Digit4: 3,
};

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const state = {
  running: false,
  lastFrame: 0,
  spawnTimer: 0,
  notes: [],
  score: 0,
  combo: 0,
  hits: 0,
  total: 0,
  noteId: 0,
  musicLoaded: false,
  beatMap: [],
  nextBeatIndex: 0,
  startTimestamp: 0,
};

const travelDuration = 2500;
const spawnInterval = 600;
const hitWindow = 0.18;
const laneCount = 4;

function createLanes() {
  noteArea.innerHTML = '';
  for (let i = 0; i < laneCount; i += 1) {
    const lane = document.createElement('div');
    lane.className = 'note-lane';
    lane.dataset.lane = i.toString();
    noteArea.appendChild(lane);
  }
}

function updateStats() {
  scoreEl.textContent = state.score.toString();
  comboEl.textContent = state.combo.toString();
  const accuracy = state.total === 0 ? 100 : Math.round((state.hits / state.total) * 100);
  accuracyEl.textContent = `${accuracy}%`;
}

function playBeep(freq) {
  if (!audioContext) return;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  gain.gain.value = 0.18;
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start();
  osc.stop(audioContext.currentTime + 0.08);
}

function analyzeBeatMap(buffer) {
  const raw = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const windowSize = 2048;
  const hopSize = 512;
  const energies = [];

  for (let i = 0; i + windowSize < raw.length; i += hopSize) {
    let sum = 0;
    for (let j = 0; j < windowSize; j += 1) {
      const value = raw[i + j];
      sum += value * value;
    }
    energies.push(sum / windowSize);
  }

  const beatTimes = [];
  const thresholdWindow = 8;
  for (let i = thresholdWindow; i < energies.length - thresholdWindow; i += 1) {
    const localAvg = energies.slice(i - thresholdWindow, i + thresholdWindow + 1).reduce((a, b) => a + b, 0) / (thresholdWindow * 2 + 1);
    if (energies[i] > localAvg * 1.5 && energies[i] > 1e-6) {
      const time = (i * hopSize) / sampleRate;
      beatTimes.push(time);
    }
  }

  if (beatTimes.length === 0 && raw.length > 0) {
    const duration = raw.length / sampleRate;
    const count = Math.max(8, Math.floor(duration * 2));
    for (let i = 0; i < count; i += 1) {
      beatTimes.push((i + 1) * (duration / (count + 1)));
    }
  }

  return beatTimes.map((time, index) => ({
    time,
    lane: index % laneCount,
  }));
}

function updateAudioStatus(text) {
  audioStatus.textContent = text;
}

async function loadMusicFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const decoded = await audioContext.decodeAudioData(arrayBuffer);
  state.beatMap = analyzeBeatMap(decoded);
  state.musicLoaded = true;
  state.nextBeatIndex = 0;
  musicPreview.src = URL.createObjectURL(file);
  musicPreview.load();
  updateAudioStatus(`Loaded: ${file.name} — ${state.beatMap.length} beats detected`);
}

function spawnNote(lane, spawnTime, hitTime) {
  const noteEl = document.createElement('div');
  noteEl.className = 'note';
  noteEl.dataset.lane = lane.toString();
  noteEl.textContent = '';

  const laneContainer = noteArea.children[lane];
  laneContainer.appendChild(noteEl);

  const note = {
    id: state.noteId += 1,
    lane,
    spawnTime,
    hitTime,
    element: noteEl,
    judged: false,
    removed: false,
  };

  state.notes.push(note);
}

function spawnRandomNote(currentTime) {
  const lane = Math.floor(Math.random() * laneCount);
  spawnNote(lane, currentTime, currentTime + travelDuration);
}

function scheduleNotes(timestamp) {
  const gameTime = timestamp - state.startTimestamp;
  while (state.nextBeatIndex < state.beatMap.length) {
    const nextBeat = state.beatMap[state.nextBeatIndex];
    const beatMs = nextBeat.time * 1000;
    if (gameTime >= beatMs - travelDuration) {
      spawnNote(nextBeat.lane, state.startTimestamp + beatMs - travelDuration, state.startTimestamp + beatMs);
      state.nextBeatIndex += 1;
    } else {
      break;
    }
  }
}

function finishNote(note, result) {
  if (note.removed) return;
  note.judged = true;
  note.removed = true;
  note.element.classList.add(result);
  note.element.textContent = result === 'miss' ? '✕' : result === 'perfect' ? 'P' : result === 'good' ? 'G' : 'O';
  setTimeout(() => {
    if (note.element.parentNode) {
      note.element.remove();
    }
  }, 260);
}

function evaluateNote(note, currentTime) {
  const delta = Math.abs(currentTime - note.hitTime) / 1000;
  if (delta > hitWindow) return false;

  let scoreGain = 40;
  let result = 'good';
  if (delta <= 0.06) {
    scoreGain = 100;
    result = 'perfect';
  } else if (delta <= 0.12) {
    scoreGain = 70;
    result = 'great';
  }

  state.score += scoreGain;
  state.combo += 1;
  state.hits += 1;
  state.total += 1;
  playBeep(1100 - delta * 720);
  finishNote(note, result);
  updateStats();
  return true;
}

function missNote(note) {
  if (note.judged) return;
  note.judged = true;
  note.removed = true;
  state.combo = 0;
  state.total += 1;
  finishNote(note, 'miss');
  updateStats();
}

function findNoteForLane(lane, currentTime) {
  const laneNotes = state.notes.filter((note) => note.lane === lane && !note.judged);
  if (laneNotes.length === 0) return null;
  return laneNotes.reduce((closest, note) => {
    const currentDelta = Math.abs(currentTime - note.hitTime);
    const closestDelta = Math.abs(currentTime - closest.hitTime);
    return currentDelta < closestDelta ? note : closest;
  });
}

function handleKeyDown(event) {
  if (!state.running) return;
  const lane = laneKeys[event.code];
  if (lane === undefined) return;
  triggerLane(lane);
}

function handleLanePointer(event) {
  if (!state.running) return;
  const lane = Number(event.currentTarget.dataset.lane);
  if (Number.isNaN(lane)) return;
  triggerLane(lane);
  event.currentTarget.classList.add('active');
}

function handleLanePointerUp(event) {
  event.currentTarget.classList.remove('active');
}

function triggerLane(lane) {
  const now = performance.now();
  const note = findNoteForLane(lane, now);
  if (!note) return;
  evaluateNote(note, now);
}

function update(timestamp) {
  if (!state.running) return;
  if (!state.lastFrame) state.lastFrame = timestamp;

  const elapsed = timestamp - state.lastFrame;
  state.lastFrame = timestamp;

  if (!state.musicLoaded) {
    state.spawnTimer += elapsed;
    if (state.spawnTimer >= spawnInterval) {
      state.spawnTimer -= spawnInterval;
      spawnRandomNote(timestamp);
    }
  } else {
    scheduleNotes(timestamp);
  }

  state.notes.forEach((note) => {
    if (note.removed) return;
    const age = timestamp - note.spawnTime;
    const progress = age / travelDuration;
    const laneHeight = noteArea.clientHeight;
    const startY = -72;
    const endY = laneHeight - 52;
    const y = startY + Math.min(progress, 1.1) * (endY - startY);
    note.element.style.top = `${y}px`;

    if (!note.judged && age >= travelDuration + hitWindow * 1000) {
      missNote(note);
    }

    if (progress > 1.2 && !note.removed) {
      note.element.remove();
      note.removed = true;
    }
  });

  state.notes = state.notes.filter((note) => !note.removed);
  requestAnimationFrame(update);
}

function setButtons(running) {
  pauseButton.disabled = !running;
  pauseButton.textContent = running ? 'Pause' : 'Resume';
}

function startGame() {
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  state.running = true;
  state.lastFrame = 0;
  state.spawnTimer = 0;
  state.notes = [];
  state.score = 0;
  state.combo = 0;
  state.hits = 0;
  state.total = 0;
  state.noteId = 0;
  state.nextBeatIndex = 0;
  state.startTimestamp = performance.now();

  createLanes();
  updateStats();
  setButtons(true);

  if (state.musicLoaded) {
    musicPreview.currentTime = 0;
    musicPreview.play();
  }

  requestAnimationFrame(update);
}

function togglePause() {
  state.running = !state.running;
  setButtons(state.running);
  if (!state.running && state.musicLoaded) {
    musicPreview.pause();
  }
  if (state.running) {
    if (state.musicLoaded) {
      musicPreview.play();
    }
    state.lastFrame = 0;
    requestAnimationFrame(update);
  }
}

startButton.addEventListener('click', startGame);
pauseButton.addEventListener('click', togglePause);
window.addEventListener('keydown', handleKeyDown);
audioInput.addEventListener('change', async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    updateAudioStatus('Analyzing song...');
    await loadMusicFile(file);
  } catch (error) {
    updateAudioStatus('Failed to load music file.');
    console.error(error);
  }
});

musicPreview.addEventListener('ended', () => {
  if (state.running) {
    state.running = false;
    setButtons(false);
  }
});

document.querySelectorAll('.lane-button').forEach((button) => {
  button.addEventListener('pointerdown', handleLanePointer);
  button.addEventListener('pointerup', handleLanePointerUp);
  button.addEventListener('pointerleave', handleLanePointerUp);
  button.addEventListener('lostpointercapture', handleLanePointerUp);
});

createLanes();
updateStats();
