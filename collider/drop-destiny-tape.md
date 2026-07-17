---
title: DROP//DESTINY Six Ending Tape
tempo: 126-150 BPM
bars: 14
engine: SuperCollider + ClaudeCollider
---

# DROP//DESTINY ending tape

This tape defines the instruments and repeatable musical elements for six representative endings. The saved `CCArrangement` files live in `collider/arrangements/`; the tape itself contains no autoplay logic.

## Shared form

1. **Sound-world intro** (2 bars) - pad, texture and a compact identity motif.
2. **Layered build** (3 bars) - harmony, motif, hats and percussion establish forward motion.
3. **Pre-drop vacuum** (1 bar) - bass and kick disappear; riser and controlled snare roll create contrast.
4. **Drop A** (4 bars) - the main groove and primary bass conversation arrive.
5. **Drop B** (3 bars) - the groove remains coherent while a transformed motif, response timbre or arp raises density.
6. **Final hit** (1 bar) - impact plus a voiced tonic-color chord, followed by a clean tail.

## Harmonic and melodic identities

- **Riddim** - A minor, centered on `i(add9)` and a tense flat-II color. Hollow/formant responses leave deliberate holes around the main bass.
- **Brostep** - A minor, `i - iv6 - flat-II - Vsus`. Brass and FM/screech colors frame the more active bass dialogue.
- **Hybrid Trap** - G minor, `i(add9) - flat-II - flat-VImaj7 - V`. Bell and brass punctuate a stable halftime/trap groove.
- **Bass House** - C Dorian, `i7 - IV9`. Four-on-floor kick, offbeat bass/donk and compact organ-like stabs carry the hook.
- **Melodic Dubstep** - D minor, `i(add9) - iv6 - flat-IImaj7 - Vsus`. Supersaw chords and a saw lead are foreground; bass is support and punctuation.
- **Destiny Fusion** - G minor with Dorian/Phrygian color. Bell, modal pad and mixed response timbres connect the six possible destinies.

Melodies are constructed from short `CCMotif` cells and developed with `CCPhrase` (statement, repetition, transposition, inversion or retrograde). Bass patterns use two-bar call-and-response grids with rests, octave jumps, approach tones and timbral motion rather than continuous random notes.

## Approximate durations

| Ending | Tempo | Musical duration |
|---|---:|---:|
| Riddim | 140 BPM | 24.0 s |
| Brostep | 150 BPM | 22.4 s |
| Hybrid Trap | 150 BPM | 22.4 s |
| Bass House | 126 BPM | 26.7 s |
| Melodic Dubstep | 150 BPM | 22.4 s |
| Destiny Fusion | 145 BPM | 23.2 s |

Rendered files include a short final reverb/release tail. Leading grid silence and excess trailing silence are trimmed after recording.

## Render

Run `node dev/render-collider-endings.js` from the project root. On Windows the script creates/uses an ASCII-only junction for SuperCollider path compatibility, renders each arrangement sequentially, trims boundary silence, writes listening MP3s, and saves objective analysis beside the audio.

## Web backing stems

Run `node dev/build-ending-assets.js` to rebuild `assets/endings/*.wav`. These web stems use the same six Collider arrangements but omit each style's primary `bassA`/`bassB` parts. The website synchronizes its live Web Audio bass synth over the drop, so the user's waveform, oscillator mix, detune, filter, resonance, drive, FM, LFO, envelope, variation and recorded D/F performance still change the finished song. Auxiliary response basses remain in the backing as orchestration rather than replacing the user's main bass.
