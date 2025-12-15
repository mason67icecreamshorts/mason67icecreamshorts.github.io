// Enhanced web DAW using Tone.js
const STEPS = 16;
const TRACKS = 8;
const tracks = [];
let masterReverb, masterDelay, masterGain;

function createTrack(i){
  const track = {
    id: i,
    // each step: { active: bool, note: string|null, duration: '8n'|'4n' etc, velocity: 0-1 }
    steps: new Array(STEPS).fill(null).map(()=>({active:false,note:null,duration:'8n',velocity:1})),
    player: null,
    synth: null,
    panner: new Tone.Panner(0),
    sendReverb: new Tone.Gain(0),
    sendDelay: new Tone.Gain(0),
    gain: new Tone.Gain(0.9),
    muted: false,
    vol: 0.9,
    instrument: 'membrane',
    velocity: 1,
    midiEnabled: false,
  };

  track.synth = new Tone.MembraneSynth().connect(track.panner);
  track.panner.connect(track.gain);
  track.gain.connect(masterGain);
  track.panner.connect(track.sendReverb);
  track.panner.connect(track.sendDelay);
  track.sendReverb.connect(masterReverb);
  track.sendDelay.connect(masterDelay);

  return track;
}

function buildUI(){
  const container = document.getElementById('tracks');
  container.innerHTML = '';
  for(let i=0;i<TRACKS;i++){
    const t = createTrack(i);
    tracks.push(t);

    const el = document.createElement('div');
    el.className = 'track';

    const top = document.createElement('div');
    top.className = 'row';
    top.innerHTML = `<div class="name">Track ${i+1}</div>`;

    const fileInput = document.createElement('input');
    fileInput.type='file';
    fileInput.accept='audio/*';
    fileInput.addEventListener('change', async (e)=>{
      const f = e.target.files[0];
      if(!f) return;
      const url = URL.createObjectURL(f);
      if(t.player){ t.player.dispose(); }
      t.player = new Tone.Player(url).connect(t.panner);
      await t.player.load();
    });

    const mute = document.createElement('button');
    mute.textContent='Mute';
    mute.className='mutebtn btn';
    mute.addEventListener('click', ()=>{
      t.muted = !t.muted;
      t.gain.gain.value = t.muted ? 0 : t.vol;
      mute.textContent = t.muted ? 'Unmute' : 'Mute';
    });

    const vol = document.createElement('input'); vol.type='range'; vol.min=0; vol.max=1; vol.step=0.01; vol.value=t.vol; vol.className='slider';
    vol.addEventListener('input',()=>{ t.vol = parseFloat(vol.value); t.gain.gain.value = t.muted ? 0 : t.vol; });

    const pan = document.createElement('input'); pan.type='range'; pan.min=-1; pan.max=1; pan.step=0.01; pan.value=0; pan.className='slider';
    pan.addEventListener('input',()=>{ t.panner.pan.value = parseFloat(pan.value); });

    const reverbSend = document.createElement('input'); reverbSend.type='range'; reverbSend.min=0; reverbSend.max=1; reverbSend.step=0.01; reverbSend.value=0; reverbSend.className='slider';
    reverbSend.addEventListener('input',()=>{ t.sendReverb.gain.value = parseFloat(reverbSend.value); });

    const delaySend = document.createElement('input'); delaySend.type='range'; delaySend.min=0; delaySend.max=1; delaySend.step=0.01; delaySend.value=0; delaySend.className='slider';
    delaySend.addEventListener('input',()=>{ t.sendDelay.gain.value = parseFloat(delaySend.value); });

    // instrument selector
    const instrSel = document.createElement('select'); instrSel.className='select';
    ['membrane','synth','fmsynth','wavetable','player'].forEach(k=>{ const op=document.createElement('option'); op.value=k; op.textContent=k; instrSel.appendChild(op); });
    instrSel.value = t.instrument;
    instrSel.addEventListener('change', ()=>{
      t.instrument = instrSel.value;
      if(t.synth) t.synth.dispose();
      if(t.instrument === 'membrane') t.synth = new Tone.MembraneSynth().connect(t.panner);
      else if(t.instrument === 'synth') t.synth = new Tone.Synth().connect(t.panner);
      else if(t.instrument === 'fmsynth') t.synth = new Tone.FMSynth().connect(t.panner);
      else if(t.instrument === 'wavetable') t.synth = new Tone.Synth({oscillator:{type:'fatsawtooth',count:3,spread:30}}).connect(t.panner);
      else t.synth = new Tone.Synth().connect(t.panner);
    });

    const controls = document.createElement('div');
    controls.className = 'track-controls';
    controls.appendChild(fileInput);
    controls.appendChild(mute);
    controls.appendChild(vol);
    controls.appendChild(pan);
    controls.appendChild(reverbSend);
    controls.appendChild(delaySend);
    controls.appendChild(instrSel);

    top.appendChild(controls);
    el.appendChild(top);

    const stepsWrap = document.createElement('div'); stepsWrap.className='steps';
    for(let s=0;s<STEPS;s++){
      const step = document.createElement('div'); step.className='step';
      const label = (s%4===0)?(s/4+1):''; step.textContent = label; step.dataset.step = s;
      if(t.steps[s] && t.steps[s].active) step.classList.add('active');
      step.addEventListener('click', ()=>{
        const st = t.steps[s];
        st.active = !st.active;
        if(st.active && !st.note) st.note = 'C3';
        step.classList.toggle('active', st.active);
      });
      stepsWrap.appendChild(step);
    }
    el.appendChild(stepsWrap);
    container.appendChild(el);
  }
}

function buildSidebar(){
  const list = document.getElementById('channelList'); list.innerHTML='';
  tracks.forEach((t, idx)=>{
    const item = document.createElement('div'); item.className = 'channel-item';
    const name = document.createElement('div'); name.className='ch-name'; name.textContent = `Track ${idx+1}`;
    const pattBtn = document.createElement('button'); pattBtn.textContent='Pattern';
    pattBtn.addEventListener('click', ()=> openPianoRoll(idx));
    const midiBtn = document.createElement('button'); midiBtn.className='btn'; midiBtn.textContent = 'MIDI';
    midiBtn.addEventListener('click', ()=>{ t.midiEnabled = !t.midiEnabled; midiBtn.textContent = t.midiEnabled ? 'MIDI ✓' : 'MIDI'; });
    item.appendChild(name);
    item.appendChild(pattBtn);
    item.appendChild(midiBtn);
    list.appendChild(item);
  });
}

function buildMixerUI(){
  const mixer = document.getElementById('mixerChannels') || document.getElementById('mixer');
  if(!mixer) return; mixer.innerHTML='';
  tracks.forEach((t, idx)=>{
    const ch = document.createElement('div'); ch.className='mixer-channel';
    const label = document.createElement('div'); label.className='label'; label.textContent=`T${idx+1}`;
    const fader = document.createElement('input'); fader.type='range'; fader.min=0; fader.max=1; fader.step=0.01; fader.value=t.vol; fader.className='slider';
    fader.addEventListener('input', ()=>{ t.vol = parseFloat(fader.value); t.gain.gain.value = t.muted ? 0 : t.vol; });
    const pan = document.createElement('input'); pan.type='range'; pan.min=-1; pan.max=1; pan.step=0.01; pan.value= t.panner.pan.value || 0; pan.className='slider';
    pan.addEventListener('input', ()=>{ t.panner.pan.value = parseFloat(pan.value); });
    ch.appendChild(label); ch.appendChild(fader); ch.appendChild(pan); mixer.appendChild(ch);
  });
}

let currentStep = 0;
function schedule(){
  Tone.Transport.cancel();
  Tone.Transport.scheduleRepeat((time)=>{
    for(const t of tracks){
      const stepObj = t.steps[currentStep];
      if(stepObj && stepObj.active){
        if(t.player){
          t.player.start(time, 0);
        } else {
          const note = stepObj.note || 'C3';
          const dur = stepObj.duration || '8n';
          if(t.synth && typeof t.synth.triggerAttackRelease === 'function'){
            const vel = (stepObj.velocity !== undefined) ? stepObj.velocity : 1;
            t.synth.triggerAttackRelease(note, dur, time, vel);
          }
        }
      }
    }
    highlightStep(currentStep);
    currentStep = (currentStep+1) % STEPS;
  }, '16n');
}

function highlightStep(step){
  document.querySelectorAll('.step').forEach((el, idx)=>{
    const trackIdx = Math.floor(idx / STEPS);
    const pos = idx % STEPS;
    el.classList.toggle('playing', pos === step);
  });
}

function wireTransport(){
  const playBtn = document.getElementById('playBtn');
  const stopBtn = document.getElementById('stopBtn');
  const bpm = document.getElementById('bpm');
  const exportBtn = document.getElementById('exportBtn');
  const saveBtn = document.getElementById('savePattern');
  const loadSel = document.getElementById('loadPattern');

  bpm.addEventListener('change', ()=>Tone.Transport.bpm.value = parseFloat(bpm.value));

  playBtn.addEventListener('click', async ()=>{
    await Tone.start();
    currentStep = 0; schedule(); Tone.Transport.start();
  });

  stopBtn.addEventListener('click', ()=>{ Tone.Transport.stop(); highlightStep(-1); });

  exportBtn.addEventListener('click', async ()=>{
    const bars = parseInt(document.getElementById('exportBars')?.value || 4, 10);
    const bpmVal = parseFloat(bpm.value) || 120;
    const seconds = (60 / bpmVal) * 4 * bars;
    const recorder = new Tone.Recorder(); masterGain.connect(recorder); recorder.start();
    currentStep = 0; schedule(); Tone.Transport.start();
    await new Promise(res => setTimeout(res, (seconds + 0.4) * 1000));
    Tone.Transport.stop(); const recording = await recorder.stop(); masterGain.disconnect(recorder);
    const url = URL.createObjectURL(recording); const a = document.createElement('a'); a.href = url; a.download = `mix_${Date.now()}.wav`; document.body.appendChild(a); a.click(); a.remove();
  });

  saveBtn.addEventListener('click', ()=>{
    const name = prompt('Save pattern as:','pattern1'); if(!name) return;
    const data = { bpm: parseFloat(bpm.value), tracks: tracks.map(t=>t.steps) };
    const store = JSON.parse(localStorage.getItem('patterns')||'{}'); store[name] = data; localStorage.setItem('patterns', JSON.stringify(store)); refreshPatternList(); alert('Pattern saved.');
  });

  loadSel.addEventListener('change', ()=>{
    const key = loadSel.value; if(!key) return; const store = JSON.parse(localStorage.getItem('patterns')||'{}'); const data = store[key]; if(!data) return;
    document.getElementById('bpm').value = data.bpm || 120; Tone.Transport.bpm.value = data.bpm || 120;
    tracks.forEach((t, idx)=>{
      const src = (data.tracks && data.tracks[idx]) ? data.tracks[idx] : null;
      if(!src){ t.steps = new Array(STEPS).fill(null).map(()=>({active:false,note:null,duration:'8n'})); return; }
      t.steps = new Array(STEPS).fill(null).map((_,s)=>{ const val = src[s]; if(typeof val === 'boolean') return {active: !!val, note: val? 'C3' : null, duration: '8n'}; if(!val) return {active:false,note:null,duration:'8n'}; return {active: !!val.active, note: val.note || null, duration: val.duration || '8n'}; });
    });
    document.querySelectorAll('.step').forEach((el, idx)=>{ const trackIdx = Math.floor(idx / STEPS); const pos = idx % STEPS; const stepObj = tracks[trackIdx].steps[pos]; el.classList.toggle('active', !!(stepObj && stepObj.active)); });
  });

  refreshPatternList();
}

function refreshPatternList(){
  const loadSel = document.getElementById('loadPattern'); const store = JSON.parse(localStorage.getItem('patterns')||'{}'); loadSel.innerHTML = '<option value="">Load...</option>';
  Object.keys(store).forEach(k=>{ const op = document.createElement('option'); op.value = k; op.textContent = k; loadSel.appendChild(op); });
}

function setupMaster(){
  masterGain = new Tone.Gain(0.9).toDestination();
  masterReverb = new Tone.Reverb({decay: 2, wet: 0.5}).connect(masterGain);
  masterDelay = new Tone.FeedbackDelay('8n', 0.35).connect(masterGain);
}

async function setupMIDI(){
  if(!navigator.requestMIDIAccess) return;
  try{
    const access = await navigator.requestMIDIAccess();
    access.inputs.forEach(input=>{
      input.onmidimessage = (msg)=>{
        const [status, data1, data2] = msg.data; const cmd = status & 0xf0;
        if(cmd === 0x90 && data2>0){ // note on
          const noteName = Tone.Frequency(data1, 'midi').toNote();
          const vel = data2 / 127;
          // trigger any enabled track immediately
          tracks.forEach((t, idx)=>{
            if(t.midiEnabled){
              if(t.synth && typeof t.synth.triggerAttackRelease === 'function'){
                t.synth.triggerAttackRelease(noteName, '8n', undefined, vel);
              }
              // if transport running, write into current step (record)
              if(Tone.Transport.state === 'started'){
                const st = t.steps[currentStep];
                st.active = true; st.note = noteName; st.duration = st.duration || '8n'; st.velocity = vel;
                // update UI step element
                const idxEl = document.querySelectorAll('.step')[idx*STEPS + currentStep];
                if(idxEl) idxEl.classList.add('active');
              }
            }
          });
        }
      };
    });
  }catch(e){ console.warn('MIDI not available', e); }
}

// Piano roll helpers
const PIANO_NOTES = ['C5','B4','A4','G4','F4','E4','D4','C4','B3','A3','G3','F3'];
let pianoEditingTrack = null;
let pianoMouseDown = false;
let pianoMouseUpListenerInstalled = false;

function openPianoRoll(trackIdx){
  pianoEditingTrack = trackIdx; const modal = document.getElementById('pianoRollModal'); modal.setAttribute('aria-hidden','false');
  const title = document.getElementById('pianoTitle'); title.textContent = `Piano Roll — Track ${trackIdx+1}`;
  const grid = document.getElementById('pianoGrid'); grid.innerHTML = '';
  // header: duration selector + velocity
  const header = document.createElement('div'); header.style.display='flex'; header.style.justifyContent='flex-end'; header.style.alignItems='center'; header.style.gap='12px'; header.style.marginBottom='8px';
  const durSel = document.createElement('select'); ['16n','8n','4n','2n','1n'].forEach(d=>{ const o=document.createElement('option'); o.value=d; o.textContent=d; durSel.appendChild(o); });
  const velLabel = document.createElement('div'); velLabel.style.color='var(--muted)'; velLabel.textContent = 'Vel';
  const velSel = document.createElement('input'); velSel.type='range'; velSel.min=0; velSel.max=1; velSel.step=0.01; velSel.value = tracks[trackIdx].velocity || 1; velSel.style.width='120px';
  header.appendChild(velLabel); header.appendChild(velSel); header.appendChild(durSel);
  grid.appendChild(header);
  // grid rows
  const rows = document.createElement('div'); rows.className='piano-rows';
  rows.style.display='grid'; rows.style.gridTemplateRows = `repeat(${PIANO_NOTES.length},32px)`;
    for(let r=0;r<PIANO_NOTES.length;r++){
    const note = PIANO_NOTES[r];
    const row = document.createElement('div'); row.className='piano-row';
    const cells = document.createElement('div'); cells.style.display='grid'; cells.style.gridTemplateColumns = `repeat(${STEPS},1fr)`; cells.style.gap='4px';
    for(let c=0;c<STEPS;c++){
      const cell = document.createElement('div'); cell.className='piano-cell'; cell.dataset.step = c; cell.dataset.note = note; cell.textContent = '';
      const stepObj = tracks[trackIdx].steps[c];
      if(stepObj && stepObj.active && stepObj.note === note) cell.classList.add('active');
      // support drag-to-draw and velocity assignment
      cell.addEventListener('mousedown', (ev)=>{
        ev.preventDefault(); pianoMouseDown = true;
        const st = tracks[trackIdx].steps[c];
        st.active = !st.active;
        if(st.active){ st.note = note; st.duration = durSel.value; st.velocity = parseFloat(velSel.value); cell.classList.add('active'); }
        else { st.note = null; cell.classList.remove('active'); }
      });
      cell.addEventListener('mouseenter', ()=>{
        if(!pianoMouseDown) return;
        const st = tracks[trackIdx].steps[c];
        st.active = true; st.note = note; st.duration = durSel.value; st.velocity = parseFloat(velSel.value); cell.classList.add('active');
      });
      cell.addEventListener('click', ()=>{
        // toggle single click as well (keeps behavior)
        const st = tracks[trackIdx].steps[c];
        if(st.active && st.note === note){ st.active = false; st.note = null; cell.classList.remove('active'); }
        else { st.active = true; st.note = note; st.duration = durSel.value; st.velocity = parseFloat(velSel.value); cell.classList.add('active'); }
      });
      cells.appendChild(cell);
    }
    const label = document.createElement('div'); label.style.width='64px'; label.style.color='var(--muted)'; label.textContent = note;
    row.appendChild(label); row.appendChild(cells); rows.appendChild(row);
  }
  grid.appendChild(rows);
  // ensure a single global mouseup listener is installed once
  if(!pianoMouseUpListenerInstalled){
    document.addEventListener('mouseup', ()=>{ pianoMouseDown = false; });
    pianoMouseUpListenerInstalled = true;
  }
}

function closePianoRoll(){ const modal = document.getElementById('pianoRollModal'); modal.setAttribute('aria-hidden','true'); pianoEditingTrack = null; }

document.addEventListener('DOMContentLoaded', async ()=>{
  setupMaster(); buildUI(); buildSidebar(); buildMixerUI(); wireTransport();
  const masterF = document.getElementById('masterFader'); if(masterF){ masterF.addEventListener('input', ()=> masterGain.gain.value = parseFloat(masterF.value)); }
  // piano roll buttons
  const closeBtn = document.getElementById('closePiano'); if(closeBtn) closeBtn.addEventListener('click', closePianoRoll);
  const pianoSave = document.getElementById('pianoSave'); if(pianoSave) pianoSave.addEventListener('click', ()=>{ closePianoRoll(); });
  await Tone.loaded(); setupMIDI();
});


