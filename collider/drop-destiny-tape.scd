// DROP//DESTINY ClaudeCollider tape
// Defines shared high-quality SynthDefs and all six ending element sets.
// Arrangements live in collider/arrangements/*.scd and control playback.

(
// -----------------------------------------------------------------------------
// Embedded CC0 drum samples extracted from audio-assets.js
// -----------------------------------------------------------------------------
~ddSampleDir = "DD_SAMPLE_DIR".getenv;
~ddSamples = IdentityDictionary.new;
~ddSampleNames = [
    \kickClean, \kickTearout, \snareBeefy, \snareWide, \clapFat,
    \hatRiddim, \hatBrostep, \hatTrap, \hatHouse, \hatMelodic, \hatFusion,
    \hatOpenHouse, \hatOpenSoft, \hatOpenTrap
];

~ddSampleNames.do { |name|
    ~ddSamples[name] = Buffer.read(s, ~ddSampleDir +/+ (name.asString ++ ".wav"));
};
s.sync;

// -----------------------------------------------------------------------------
// Custom instruments. Pdefs provide rhythm; Ndefs below provide sustained beds.
// -----------------------------------------------------------------------------
SynthDef(\dd_kick, { |out=0, freq=48, amp=0.3, decay=0.42, tone=0.5|
    var env, pitch, body, click, sig;
    env = EnvGen.ar(Env.perc(0.001, decay, curve: -7), doneAction: 2);
    pitch = EnvGen.kr(Env([freq * 5.2, freq * 1.45, freq], [0.018, 0.105], [-9, -4]));
    body = SinOsc.ar(pitch) * env;
    click = HPF.ar(WhiteNoise.ar, 4200) * EnvGen.ar(Env.perc(0.001, 0.026)) * tone;
    sig = LeakDC.ar((body + (click * 0.24)).tanh);
    Out.ar(out, Limiter.ar(sig ! 2, 0.92) * amp);
}).add;

SynthDef(\dd_snare, { |out=0, freq=48, amp=0.28, decay=0.24, body=185, bright=0.6|
    var env, bodyEnv, noise, clap, sig;
    env = EnvGen.ar(Env.perc(0.001, decay, curve: -5), doneAction: 2);
    bodyEnv = EnvGen.ar(Env.perc(0.001, decay * 0.7, curve: -6));
    noise = BPF.ar(WhiteNoise.ar, 1900 + (bright * 3100), 0.52) * env;
    clap = HPF.ar(DelayC.ar(WhiteNoise.ar, 0.03, [0, 0.012, 0.021]).sum, 1200) * env * 0.16;
    sig = (SinOsc.ar(body) * bodyEnv * 0.55) + noise + clap;
    Out.ar(out, Limiter.ar(Splay.ar([sig, DelayC.ar(sig, 0.02, 0.008)]), 0.92) * amp);
}).add;

SynthDef(\dd_hat, { |out=0, freq=48, amp=0.12, decay=0.07, color=8500, open=0|
    var env, metal, noise, sig;
    env = EnvGen.ar(Env.perc(0.001, decay * (1 + (open * 5)), curve: -7), doneAction: 2);
    metal = Mix.ar(Pulse.ar([4013, 5237, 6451, 7897], 0.48, 0.08));
    noise = HPF.ar(WhiteNoise.ar, color);
    sig = BPF.ar(noise + metal, color.clip(5000, 13000), 0.75) * env;
    Out.ar(out, Limiter.ar(Splay.ar([sig, DelayC.ar(sig, 0.02, 0.006)]), 0.9) * amp);
}).add;

SynthDef(\dd_mainBass, { |out=0, freq=55, amp=0.22, gate=1, att=0.004, rel=0.16,
    mode=0, cutoff=1200, res=0.22, drive=2.4, wobble=2, index=4|
    var env, motion, mechanical, brutal, trap, house, melodic, source, filtered, sub, sig;
    env = EnvGen.kr(Env.adsr(att, 0.045, 0.82, rel, curve: -4), gate, doneAction: 2);
    motion = LFTri.kr(wobble.max(0.1)).exprange(0.58, 1.34);
    mechanical = Mix.ar(Pulse.ar(freq * [0.5, 1, 1.505], [0.34, 0.46, 0.41], [0.35, 0.36, 0.18]));
    mechanical = mechanical + (SinOsc.ar(freq * 2 + (SinOsc.ar(freq * 3) * freq * 2.5)) * 0.34);
    brutal = Mix.ar(Saw.ar(freq * [0.5, 0.997, 1.006], [0.32, 0.38, 0.38]));
    brutal = brutal + (SinOsc.ar(freq * (1 + (SinOsc.ar(freq * 2.01) * (index * 0.18)))) * 0.42);
    trap = SinOsc.ar(XLine.kr(freq * 1.05, freq, 0.08)) + (VarSaw.ar(freq * 2, 0, 0.35) * 0.12);
    house = SinOsc.ar(XLine.kr(freq * 2.8, freq, 0.075)) + (Pulse.ar(freq, 0.42) * 0.22);
    melodic = Mix.ar(Saw.ar(freq * [0.5, 0.992, 1.008], [0.34, 0.32, 0.32]));
    source = SelectX.ar(mode.clip(0, 4), [mechanical, brutal, trap, house, melodic]);
    filtered = RLPF.ar(source, (cutoff * motion * (0.62 + (env * 1.15))).clip(70, 12000), res.clip(0.08, 0.8));
    // Keep the hybrid-trap mode sub-heavier while allowing fractional modes
    // (used by Destiny Fusion) to interpolate safely at control rate.
    sub = SinOsc.ar(freq * 0.5) * SelectX.kr(
        mode.clip(0, 4),
        [0.42, 0.44, 0.67, 0.5, 0.38]
    );
    sig = LeakDC.ar(((filtered * drive).tanh * 0.78) + sub);
    sig = Splay.ar([sig, DelayC.ar(sig, 0.03, 0.011)], 0.38);
    Out.ar(out, Limiter.ar(sig * env * amp, 0.94));
}).add;

SynthDef(\dd_auxBass, { |out=0, freq=82.5, amp=0.13, gate=1, rel=0.18, mode=0, cutoff=2100|
    var env, vowel, metal, reese, donk, fusion, sig;
    env = EnvGen.kr(Env.adsr(0.003, 0.04, 0.75, rel, curve: -4), gate, doneAction: 2);
    vowel = Formant.ar(freq, XLine.kr(520, 1550, 0.22), XLine.kr(110, 320, 0.22));
    metal = SinOsc.ar(freq * (1 + (SinOsc.ar(freq * 2.7) * 2.2))) + (Pulse.ar(freq * 1.5, 0.37) * 0.32);
    reese = Mix.ar(Saw.ar(freq * [0.988, 1, 1.012])) * 0.38;
    donk = SinOsc.ar(XLine.kr(freq * 2.6, freq, 0.07)) + (BPF.ar(Pulse.ar(freq, 0.42), 760, 0.35) * 0.28);
    fusion = (Formant.ar(freq, 820, 190) * 0.55) + (SinOsc.ar(freq * (1 + (SinOsc.ar(freq * 3) * 1.6))) * 0.45);
    sig = SelectX.ar(mode.clip(0, 4), [vowel, metal, reese, donk, fusion]);
    sig = RLPF.ar(sig, cutoff.clip(250, 9000), 0.22);
    sig = LeakDC.ar((sig * 2.7).tanh);
    Out.ar(out, Limiter.ar(Splay.ar([sig, DelayC.ar(sig, 0.02, 0.009)]) * env * amp, 0.92));
}).add;

SynthDef(\dd_supersaw, { |out=0, freq=220, amp=0.055, gate=1, att=0.035, rel=0.8,
    cutoff=6200, hardness=0|
    var env, detunes, softVoices, hardVoices, softCore, hardCore, edge, sig;
    env = EnvGen.kr(Env.adsr(att, 0.12, 0.76, rel, curve: -3), gate, doneAction: 2);
    detunes = [-0.018, -0.011, -0.005, 0, 0.006, 0.012, 0.019];
    softVoices = detunes.collect { |det, i|
        VarSaw.ar(freq * (1 + det), i / 7, 0.38 + (i * 0.025), 0.14)
    };
    hardVoices = detunes.collect { |det| Saw.ar(freq * (1 + det), 0.135) };
    softCore = Splay.ar(softVoices, 0.86);
    hardCore = Splay.ar(hardVoices, 0.92);
    sig = XFade2.ar(softCore, hardCore, hardness.clip(0, 1).linlin(0, 1, -1, 1));
    edge = HPF.ar(hardCore, 1450) * hardness.clip(0, 1) * 0.42;
    sig = RLPF.ar(sig + edge,
        (cutoff * (0.82 + (env * 0.5))).clip(500, 16500),
        (0.2 - (hardness * 0.08)).clip(0.1, 0.3));
    sig = BHiShelf.ar(sig, 2300, 0.65, hardness * 5.5);
    sig = ((sig * (1 + (hardness * 2.6))).tanh * (0.82 + (hardness * 0.26)));
    sig = sig + (CombC.ar(sig, 0.25, 0.125, 1.1) * (0.13 - (hardness * 0.07)));
    // The harder spectrum carries much more perceived energy; compensate before
    // per-voice limiting so polyphonic chords retain headroom instead of clipping.
    sig = sig * (1 - (hardness.clip(0, 1) * 0.55));
    Out.ar(out, Limiter.ar(sig * env * amp, 0.9));
}).add;

SynthDef(\dd_lead, { |out=0, freq=440, amp=0.09, gate=1, mode=0, att=0.008, rel=0.28, cutoff=5600|
    var env, sawLead, pluck, screech, hollow, sig;
    env = EnvGen.kr(Env.adsr(att, 0.06, 0.72, rel, curve: -4), gate, doneAction: 2);
    sawLead = Splay.ar(Saw.ar(freq * [0.992, 0.997, 1, 1.004, 1.009], [0.16, 0.16, 0.2, 0.16, 0.16]), 0.75);
    pluck = Pluck.ar(PinkNoise.ar(0.6), Impulse.kr(0), 0.2, freq.reciprocal, 1.8, 0.42) ! 2;
    screech = BPF.ar((Saw.ar(freq * [1, 1.503]).sum + SinOsc.ar(freq * (1 + (SinOsc.ar(freq * 2.5) * 1.4)))),
        XLine.kr(5200, 1250, 0.3), 0.17) ! 2;
    hollow = BPF.ar(Pulse.ar(freq * [0.5, 1], [0.35, 0.48]).sum, cutoff * 0.42, 0.16) ! 2;
    sig = SelectX.ar(mode.clip(0, 3), [sawLead, pluck, screech, hollow]);
    sig = RLPF.ar(sig, cutoff.clip(600, 14000), 0.24);
    sig = sig + (CombC.ar(sig, 0.3, 0.1875, 1.1) * 0.11);
    Out.ar(out, Limiter.ar(sig * env * amp, 0.91));
}).add;

SynthDef(\dd_bell, { |out=0, freq=660, amp=0.075, decay=2.2, bright=3|
    var env, ratios, amps, sig;
    env = EnvGen.ar(Env.perc(0.002, decay, curve: -5), doneAction: 2);
    ratios = [1, 2.01, 2.71, 4.08, 5.43];
    amps = [1, 0.52, 0.32, 0.18, 0.1];
    sig = Mix.ar(SinOsc.ar(freq * ratios, 0, amps)) * env;
    sig = HPF.ar(sig, 180) + (BPF.ar(sig, freq * bright, 0.3) * 0.18);
    Out.ar(out, Limiter.ar(Splay.ar([sig, DelayC.ar(sig, 0.03, 0.014)]) * amp, 0.9));
}).add;

SynthDef(\dd_brass, { |out=0, freq=220, amp=0.07, gate=1, rel=0.42, cutoff=2800|
    var env, filterEnv, source, sig;
    env = EnvGen.kr(Env.adsr(0.008, 0.09, 0.68, rel, curve: -4), gate, doneAction: 2);
    filterEnv = EnvGen.kr(Env([0.35, 1.35, 0.62], [0.045, 0.32], [-3, -4]), gate);
    source = Splay.ar(VarSaw.ar(freq * [0.992, 1, 1.008, 2], [0, 0.1, 0.2, 0], [0.42, 0.48, 0.38, 0.32]), 0.62);
    sig = RLPF.ar(source, (cutoff * filterEnv).clip(350, 9500), 0.23);
    sig = (sig * 1.8).tanh;
    Out.ar(out, Limiter.ar(sig * env * amp, 0.91));
}).add;

SynthDef(\dd_impact, { |out=0, freq=48, amp=0.34, decay=1.8|
    var env, sub, noise, sig;
    env = EnvGen.ar(Env.perc(0.002, decay, curve: -5), doneAction: 2);
    sub = SinOsc.ar(XLine.kr(freq * 1.8, freq * 0.52, 0.34));
    noise = BPF.ar(PinkNoise.ar, XLine.kr(5200, 110, decay), 0.5) * 0.58;
    sig = (sub + noise) * env;
    Out.ar(out, Limiter.ar(Splay.ar([sig, DelayC.ar(sig, 0.04, 0.017)]) * amp, 0.93));
}).add;

SynthDef(\dd_riser, { |out=0, freq=48, amp=0.12, duration=1.7, startFreq=180, endFreq=12000|
    var env, sweep, tone, noise, sig;
    env = EnvGen.ar(Env([0, 1, 0], [duration * 0.86, duration * 0.14], [3, -6]), doneAction: 2);
    sweep = XLine.kr(startFreq, endFreq, duration);
    tone = BPF.ar(WhiteNoise.ar, sweep, XLine.kr(0.7, 0.12, duration));
    noise = HPF.ar(PinkNoise.ar, XLine.kr(250, 6500, duration));
    sig = (tone + (noise * 0.42)) * env;
    Out.ar(out, Limiter.ar(Splay.ar([sig, DelayC.ar(sig, 0.03, 0.015)]) * amp, 0.9));
}).add;

s.sync;

// -----------------------------------------------------------------------------
// Style factory
// -----------------------------------------------------------------------------
~ddOffsets = { |root, offsets|
    offsets.collect { |item| if(item.isNil) { Rest() } { root + item } }
};

~ddAmpsWithRests = { |values, multiplier=1|
    values.collect { |value|
        if(value <= 0) { Rest() } { value * multiplier }
    }
};

~ddMakeStyle = { |cfg|
    var prefix, sym, bassA, bassB, auxBass;
    var motif, padName, textureName, rootFreq, drumGain, bassGain, musicGain, chordGain;

    prefix = cfg[\prefix].asString;
    sym = { |suffix| (prefix ++ "_" ++ suffix).asSymbol };
    bassA = ~ddOffsets.(cfg[\bassRoot], cfg[\bassA]);
    bassB = ~ddOffsets.(cfg[\bassRoot], cfg[\bassB]);
    auxBass = ~ddOffsets.(cfg[\bassRoot], cfg[\aux]);
    motif = CCMotif(cfg[\motif]);
    padName = sym.("pad");
    textureName = sym.("texture");
    rootFreq = cfg[\padFreq];
    drumGain = cfg[\drumGain] ? 1;
    bassGain = cfg[\bassGain] ? 1;
    musicGain = cfg[\musicGain] ? 1;
    chordGain = cfg[\chordGain] ? 1;

    Pdef(sym.("kick"), Ppar([
        Pbind(
            \instrument, \cc_sampler, \freq, 48,
            \buf, ~ddSamples[cfg[\kickSample]], \rate, cfg[\kickRate],
            \dur, 0.25,
            \amp, Pseq(~ddAmpsWithRests.(cfg[\kick], cfg[\kickSampleAmp] * drumGain), inf)
        ),
        Pbind(
            \instrument, \dd_kick, \freq, 48,
            \dur, 0.25,
            \amp, Pseq(~ddAmpsWithRests.(cfg[\kick], cfg[\kickSynthAmp] * drumGain), inf),
            \decay, cfg[\kickDecay], \tone, cfg[\kickTone]
        )
    ]));

    Pdef(sym.("snare"), Ppar([
        Pbind(
            \instrument, \cc_sampler, \freq, 48,
            \buf, ~ddSamples[cfg[\snareSample]], \rate, cfg[\snareRate],
            \dur, 0.25,
            \amp, Pseq(~ddAmpsWithRests.(cfg[\snare], cfg[\snareSampleAmp] * drumGain), inf)
        ),
        Pbind(
            \instrument, \dd_snare, \freq, 48,
            \dur, 0.25,
            \amp, Pseq(~ddAmpsWithRests.(cfg[\snare], cfg[\snareSynthAmp] * drumGain), inf),
            \body, cfg[\snareBody], \bright, cfg[\snareBright]
        )
    ]));

    Pdef(sym.("hat"), Pbind(
        \instrument, \cc_sampler, \freq, 48,
        \buf, ~ddSamples[cfg[\hatSample]], \rate, cfg[\hatRate],
        \dur, 0.25,
        \amp, Pseq(~ddAmpsWithRests.(cfg[\hat], cfg[\hatAmp] * drumGain), inf)
    ));

    Pdef(sym.("perc"), Pbind(
        \instrument, \dd_hat, \freq, 48,
        \dur, 0.25,
        \amp, Pseq(~ddAmpsWithRests.(cfg[\perc], cfg[\percAmp] * drumGain), inf),
        \decay, Pseq([0.035, 0.055, 0.03, 0.075], inf),
        \color, cfg[\percColor]
    ));

    Pdef(sym.("roll"), Pbind(
        \instrument, \dd_snare, \freq, 48,
        \dur, 0.25,
        \amp, Pseq([0.05, 0.07, 0.08, 0.1, 0.11, 0.13, 0.16, 0.18,
            0.2, 0.22, 0.25, 0.28, 0.31, 0.34, 0.38, 0.42], inf) * drumGain,
        \body, cfg[\snareBody], \bright, cfg[\snareBright]
    ));

    Pdef(sym.("riser"), Pbind(
        \instrument, \dd_riser, \freq, 48,
        \dur, 4, \amp, cfg[\riserAmp] * musicGain, \duration, cfg[\riserDuration],
        \startFreq, cfg[\riserStart], \endFreq, cfg[\riserEnd]
    ));

    Pdef(sym.("bassA"), Pbind(
        \instrument, \dd_mainBass,
        \midinote, Pseq(bassA, inf), \dur, 0.25,
        \amp, Pseq(cfg[\bassAmpA], inf) * bassGain, \sustain, Pseq(cfg[\bassSustainA], inf),
        \mode, cfg[\bassMode], \cutoff, Pseq(cfg[\bassCutoffA], inf),
        \res, cfg[\bassRes], \drive, cfg[\bassDrive],
        \wobble, Pseq(cfg[\wobbleA], inf), \index, cfg[\bassIndex]
    ));

    Pdef(sym.("bassB"), Pbind(
        \instrument, \dd_mainBass,
        \midinote, Pseq(bassB, inf), \dur, 0.25,
        \amp, Pseq(cfg[\bassAmpB], inf) * bassGain, \sustain, Pseq(cfg[\bassSustainB], inf),
        \mode, cfg[\bassMode], \cutoff, Pseq(cfg[\bassCutoffB], inf),
        \res, cfg[\bassRes], \drive, cfg[\bassDrive] * 1.08,
        \wobble, Pseq(cfg[\wobbleB], inf), \index, cfg[\bassIndex] * 1.08
    ));

    Pdef(sym.("auxBass"), Pbind(
        \instrument, \dd_auxBass,
        \midinote, Pseq(auxBass, inf), \dur, 0.25,
        \amp, Pseq(cfg[\auxAmp], inf) * bassGain, \sustain, Pseq(cfg[\auxSustain], inf),
        \mode, cfg[\auxMode], \cutoff, Pseq(cfg[\auxCutoff], inf)
    ));

    Pdef(sym.("chords"), Pbind(
        \instrument, \dd_supersaw,
        \midinote, Pseq(cfg[\chords], inf), \dur, 4,
        \amp, cfg[\chordAmp] * musicGain * chordGain, \sustain, cfg[\chordSustain],
        \att, cfg[\chordAttack], \rel, cfg[\chordRelease], \cutoff, cfg[\chordCutoff],
        \hardness, cfg[\chordHardness] ? 0
    ));

    Pdef(sym.("leadA"), Pbind(
        \instrument, \dd_lead,
        \scale, cfg[\scale], \root, cfg[\root], \octave, cfg[\leadOctave],
        \degree, CCPhrase(motif, [\state, \state, \transpose, 2, \state]),
        \dur, 0.25, \amp, cfg[\leadAmpA] * musicGain, \sustain, cfg[\leadSustain],
        \mode, cfg[\leadMode], \cutoff, cfg[\leadCutoff]
    ));

    Pdef(sym.("leadB"), Pbind(
        \instrument, \dd_lead,
        \scale, cfg[\scale], \root, cfg[\root], \octave, cfg[\leadOctave],
        \degree, CCPhrase(motif, [\state, \transpose, 2, \invert, \retrograde]),
        \dur, 0.25, \amp, cfg[\leadAmpB] * musicGain, \sustain, cfg[\leadSustain],
        \mode, cfg[\leadModeB], \cutoff, cfg[\leadCutoffB]
    ));

    Pdef(sym.("arp"), Pbind(
        \instrument, \dd_bell,
        \scale, cfg[\scale], \root, cfg[\root], \octave, cfg[\arpOctave],
        \degree, CCPhrase(motif.retrograde, [\state, \transpose, 2]),
        \dur, 0.5, \amp, cfg[\arpAmp] * musicGain, \decay, cfg[\arpDecay], \bright, cfg[\arpBright]
    ));

    Pdef(sym.("accent"), Pbind(
        \instrument, \dd_brass,
        \midinote, Pseq(cfg[\accentChords], inf), \dur, 0.5,
        \amp, cfg[\accentAmp] * musicGain, \sustain, cfg[\accentSustain], \cutoff, cfg[\accentCutoff]
    ));

    Pdef(sym.("finalImpact"), Pbind(
        \instrument, \dd_impact, \freq, cfg[\padFreq],
        \dur, 4, \amp, cfg[\finalImpactAmp] * drumGain, \decay, 1.8
    ));

    Pdef(sym.("finalChord"), Pbind(
        \instrument, \dd_supersaw,
        \midinote, Pseq([cfg[\finalChord]], inf), \dur, 4,
        \amp, cfg[\finalChordAmp] * musicGain * chordGain, \sustain, 3.4,
        \att, 0.018, \rel, 1.15, \cutoff, cfg[\finalChordCutoff],
        \hardness, cfg[\chordHardness] ? 0
    ));

    Ndef(padName, {
        var drift, source, filter, breath;
        drift = LFNoise1.kr([0.08, 0.11, 0.14, 0.17]).range(0.994, 1.006);
        source = Splay.ar(VarSaw.ar(rootFreq * [1, 1.5, 2, 3] * drift, [0, 0.2, 0.4, 0.6], 0.42), 0.82);
        breath = LFNoise1.kr(0.12).range(0.68, 1);
        filter = RLPF.ar(source, LFNoise1.kr(0.09).exprange(cfg[\padCutoffLo], cfg[\padCutoffHi]), 0.28);
        // Pads provide width and harmony, never competing with the kick/sub lane.
        filter = HPF.ar(filter, 145);
        Limiter.ar((filter + (CombC.ar(filter, 0.5, 0.25, 2.2) * 0.12)) * cfg[\padAmp] * musicGain * breath, 0.8);
    });
    Ndef(padName).fadeTime = 1.2;

    Ndef(textureName, {
        var air, tonal, sig;
        air = BPF.ar(PinkNoise.ar, LFNoise1.kr(0.16).exprange(900, 7800), 0.38);
        tonal = SinOsc.ar(rootFreq * [0.5, 1.005], 0, [0.45, 0.24]).sum;
        sig = Splay.ar([air, DelayC.ar(air, 0.04, 0.021)]) + (tonal ! 2);
        Limiter.ar(HPF.ar(sig, 105) * cfg[\textureAmp] * musicGain, 0.76);
    });
    Ndef(textureName).fadeTime = 1.5;
};

// -----------------------------------------------------------------------------
// Six style definitions
// -----------------------------------------------------------------------------

~ddMakeStyle.((
    prefix: \riddim, root: 9, scale: Scale.minor, bassRoot: 33, padFreq: 55,
    kickSample: \kickTearout, snareSample: \snareWide, hatSample: \hatRiddim,
    kickRate: 0.91, snareRate: 0.93, hatRate: 1.04,
    kickSampleAmp: 0.42, kickSynthAmp: 0.28, kickDecay: 0.34, kickTone: 0.5,
    snareSampleAmp: 0.38, snareSynthAmp: 0.2, snareBody: 155, snareBright: 0.48,
    hatAmp: 0.72, percAmp: 0.42, percColor: 7600,
    kick: [1,0,0,0, 0,0,0.78,0, 0,0,0,0, 0,0,0.7,0, 1,0,0,0, 0,0,0.82,0, 0,0,0,0.62, 0,0,0,0],
    snare:[0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    hat:  [0,0,0.72,0, 0,0,0.42,0, 0,0,0.64,0, 0,0,0.36,0, 0,0,0.76,0, 0,0,0.4,0, 0,0,0.68,0, 0,0,0.32,0],
    perc: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0.28, 0,0,0,0, 0,0,0,0, 0.3,0,0,0, 0,0,0.24,0],
    bassA: [0,nil,nil,nil, nil,nil,0,nil, 12,nil,nil,nil, nil,nil,7,nil, 0,nil,nil,nil, nil,nil,0,nil, 0,nil,nil,7, nil,nil,12,nil],
    bassB: [0,nil,nil,12, nil,nil,7,nil, 0,nil,0,nil, nil,7,nil,nil, 0,nil,nil,nil, nil,12,nil,nil, 7,nil,nil,0, nil,nil,12,nil],
    aux: [nil,nil,nil,nil, nil,nil,12,nil, nil,nil,nil,nil, nil,nil,19,nil, nil,nil,nil,nil, nil,nil,12,nil, nil,nil,nil,nil, nil,nil,7,nil],
    bassAmpA: [0.25,0,0,0, 0,0,0.21,0, 0.22,0,0,0, 0,0,0.23,0, 0.26,0,0,0, 0,0,0.21,0, 0.24,0,0,0.2, 0,0,0.21,0],
    bassAmpB: [0.26,0,0,0.2, 0,0,0.22,0, 0.23,0,0.18,0, 0,0.2,0,0, 0.27,0,0,0, 0,0.2,0,0, 0.22,0,0,0.2, 0,0,0.23,0],
    bassSustainA: [0.62,0,0,0, 0,0,0.34,0, 0.28,0,0,0, 0,0,0.42,0, 0.68,0,0,0, 0,0,0.32,0, 0.28,0,0,0.36, 0,0,0.32,0],
    bassSustainB: [0.54,0,0,0.22, 0,0,0.34,0, 0.28,0,0.2,0, 0,0.32,0,0, 0.62,0,0,0, 0,0.22,0,0, 0.3,0,0,0.24, 0,0,0.34,0],
    bassMode: 0, bassRes: 0.2, bassDrive: 2.8, bassIndex: 4.8,
    bassCutoffA: [760,760,760,760, 920,920,1380,1380, 820,820,820,820, 1100,1100,1650,1650],
    bassCutoffB: [820,1180,820,1620, 740,1460,920,1880, 780,1280,860,1740, 720,1540,980,2050],
    wobbleA: [1.16,1.16,2.33,2.33, 1.16,1.16,2.33,2.33],
    wobbleB: [2.33,4.66,2.33,1.16, 4.66,2.33,3.5,1.16],
    auxMode: 0, auxAmp: [0,0,0,0, 0,0,0.13,0, 0,0,0,0, 0,0,0.12,0],
    auxSustain: [0,0,0,0, 0,0,0.45,0, 0,0,0,0, 0,0,0.38,0],
    auxCutoff: [1400,2200,1200,2800, 1500,2400,1300,3200],
    chords: [[45,52,59,60,64], [46,53,58,65], [45,52,59,60,64], [43,50,57,59,64]],
    chordAmp: 0.028, chordSustain: 3.5, chordAttack: 0.08, chordRelease: 0.9, chordCutoff: 2800,
    motif: [0,Rest(),1,4, Rest(),4,1,Rest()], leadOctave: 5,
    leadMode: 3, leadModeB: 2, leadAmpA: 0.055, leadAmpB: 0.068, leadSustain: 0.16,
    leadCutoff: 3200, leadCutoffB: 5200, arpOctave: 6, arpAmp: 0.025, arpDecay: 1.1, arpBright: 2.4,
    accentChords: [[57,64,70],Rest(),Rest(),Rest(), [58,65,70],Rest(),Rest(),Rest()],
    accentAmp: 0.04, accentSustain: 0.22, accentCutoff: 1900,
    padAmp: 0.035, padCutoffLo: 480, padCutoffHi: 1700, textureAmp: 0.024,
    riserAmp: 0.1, riserDuration: 1.65, riserStart: 160, riserEnd: 9800,
    finalChord: [45,52,59,60,64,69], finalChordAmp: 0.045, finalChordCutoff: 4200, finalImpactAmp: 0.38
));

~ddMakeStyle.((
    prefix: \brostep, root: 9, scale: Scale.minor, bassRoot: 33, padFreq: 55,
    drumGain: 0.78, bassGain: 0.84, musicGain: 0.9,
    kickSample: \kickTearout, snareSample: \snareWide, hatSample: \hatBrostep,
    kickRate: 1.03, snareRate: 1.04, hatRate: 1.08,
    kickSampleAmp: 0.45, kickSynthAmp: 0.3, kickDecay: 0.38, kickTone: 0.72,
    snareSampleAmp: 0.42, snareSynthAmp: 0.22, snareBody: 205, snareBright: 0.82,
    hatAmp: 0.7, percAmp: 0.48, percColor: 9200,
    kick: [1,0,0.72,0, 0,0.65,0,0, 0,0,0.78,0, 0,0,0.68,0, 1,0,0,0.62, 0,0.72,0,0, 0,0.64,0,0, 0,0,0.7,0],
    snare:[0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    hat:  [0.68,0,0.34,0.2, 0.58,0,0.4,0, 0.72,0.18,0.36,0, 0.6,0,0.42,0.22, 0.72,0,0.38,0.18, 0.62,0,0.44,0, 0.78,0.2,0.4,0, 0.64,0,0.46,0.26],
    perc: [0,0,0,0.22, 0,0,0.18,0, 0,0,0,0.2, 0,0,0.16,0, 0,0,0.2,0, 0,0,0.18,0, 0,0,0.24,0, 0,0,0.2,0],
    bassA: [0,nil,12,nil, nil,7,nil,nil, 0,nil,nil,3, nil,nil,7,nil, 0,nil,nil,7, nil,12,nil,10, nil,nil,7,nil, 0,nil,nil,12],
    bassB: [0,12,nil,7, nil,nil,3,12, nil,7,nil,nil, 0,nil,10,nil, 0,nil,12,nil, 7,nil,nil,3, nil,10,7,nil, 0,nil,12,nil],
    aux: [nil,nil,19,nil, nil,nil,nil,nil, nil,nil,nil,15, nil,nil,nil,nil, nil,nil,nil,19, nil,nil,12,nil, nil,nil,nil,nil, nil,nil,22,nil],
    bassAmpA: [0.27,0,0.2,0, 0,0.23,0,0, 0.26,0,0,0.21, 0,0,0.23,0, 0.28,0,0,0.21, 0,0.22,0,0.19, 0,0,0.23,0, 0.25,0,0,0.2],
    bassAmpB: [0.28,0.19,0,0.22, 0,0,0.2,0.18, 0,0.22,0,0, 0.27,0,0.2,0, 0.29,0,0.19,0, 0.22,0,0,0.2, 0,0.18,0.21,0, 0.27,0,0.2,0],
    bassSustainA: [0.28,0,0.18,0, 0,0.32,0,0, 0.3,0,0,0.22, 0,0,0.34,0, 0.3,0,0,0.22, 0,0.2,0,0.22, 0,0,0.3,0, 0.28,0,0,0.24],
    bassSustainB: [0.24,0.18,0,0.2, 0,0,0.2,0.16, 0,0.22,0,0, 0.3,0,0.18,0, 0.26,0,0.18,0, 0.22,0,0,0.19, 0,0.18,0.22,0, 0.28,0,0.18,0],
    bassMode: 1, bassRes: 0.17, bassDrive: 3.15, bassIndex: 6.2,
    bassCutoffA: [1250,820,1680,980, 1450,760,1920,1120, 1320,880,2100,1040, 1520,720,2300,1180],
    bassCutoffB: [1550,2600,920,2100, 740,2850,1180,2350, 1700,3100,860,2500, 680,3300,1320,2800],
    wobbleA: [2.33,4.66,3.5,2.33, 4.66,2.33,7,3.5],
    wobbleB: [4.66,7,3.5,9.33, 2.33,7,4.66,11.66],
    auxMode: 1, auxAmp: [0,0,0.14,0, 0,0,0,0, 0,0,0,0.13, 0,0,0,0],
    auxSustain: [0,0,0.22,0, 0,0,0,0, 0,0,0,0.28, 0,0,0,0],
    auxCutoff: [2600,4200,1900,5200, 2800,4600,2200,5800],
    chords: [[45,52,60,64,71], [41,48,57,62,64], [46,53,57,62,65], [40,47,57,59,64]],
    chordAmp: 0.034, chordSustain: 3.45, chordAttack: 0.055, chordRelease: 0.82, chordCutoff: 3600,
    motif: [0,2,Rest(),1, 4,Rest(),3,Rest()], leadOctave: 5,
    leadMode: 2, leadModeB: 2, leadAmpA: 0.065, leadAmpB: 0.082, leadSustain: 0.13,
    leadCutoff: 5100, leadCutoffB: 7200, arpOctave: 6, arpAmp: 0.024, arpDecay: 0.9, arpBright: 3.2,
    accentChords: [[57,64,72],Rest(),Rest(),Rest(), [53,60,69],Rest(), [58,65,69],Rest()],
    accentAmp: 0.068, accentSustain: 0.32, accentCutoff: 3300,
    padAmp: 0.038, padCutoffLo: 520, padCutoffHi: 2400, textureAmp: 0.026,
    riserAmp: 0.13, riserDuration: 1.65, riserStart: 180, riserEnd: 12500,
    finalChord: [45,52,60,64,69,71], finalChordAmp: 0.056, finalChordCutoff: 6400, finalImpactAmp: 0.44
));

~ddMakeStyle.((
    prefix: \hybrid, root: 7, scale: Scale.minor, bassRoot: 31, padFreq: 49,
    kickSample: \kickClean, snareSample: \snareBeefy, hatSample: \hatTrap,
    kickRate: 0.88, snareRate: 0.94, hatRate: 1,
    kickSampleAmp: 0.4, kickSynthAmp: 0.27, kickDecay: 0.46, kickTone: 0.42,
    snareSampleAmp: 0.4, snareSynthAmp: 0.2, snareBody: 175, snareBright: 0.66,
    hatAmp: 0.62, percAmp: 0.44, percColor: 8800,
    kick: [1,0,0,0, 0,0,0.78,0, 0,0,0,0.7, 0,0,0.68,0, 1,0,0,0, 0,0.74,0,0, 0,0,0.72,0, 0,0,0.7,0],
    snare:[0,0,0,0, 0.92,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0, 0.94,0,0,0, 0,0,0,0, 1,0,0,0],
    hat:  [0.7,0,0.38,0, 0.56,0,0.34,0.18, 0.72,0,0.4,0, 0.58,0.2,0.36,0, 0.74,0,0.4,0.2, 0.6,0,0.42,0, 0.76,0,0.34,0.18, 0.62,0,0.44,0.24],
    perc: [0,0.14,0,0, 0,0,0,0.18, 0,0,0.12,0, 0,0,0,0.22, 0,0.16,0,0, 0,0,0.12,0, 0,0,0.14,0, 0,0,0,0.24],
    bassA: [0,nil,nil,nil, nil,0,nil,12, nil,nil,7,nil, nil,nil,nil,12, 0,nil,nil,nil, nil,nil,7,nil, nil,3,nil,nil, 12,nil,nil,nil],
    bassB: [0,nil,nil,12, nil,nil,nil,nil, 0,nil,7,nil, nil,3,nil,nil, 0,nil,nil,nil, 12,nil,nil,7, nil,nil,3,nil, nil,nil,12,nil],
    aux: [0,nil,nil,nil, nil,nil,nil,nil, nil,nil,nil,19, nil,nil,nil,nil, 0,nil,nil,nil, nil,nil,12,nil, nil,nil,nil,nil, 19,nil,nil,nil],
    bassAmpA: [0.25,0,0,0, 0,0.2,0,0.18, 0,0,0.21,0, 0,0,0,0.18, 0.27,0,0,0, 0,0,0.21,0, 0,0.19,0,0, 0.18,0,0,0],
    bassAmpB: [0.27,0,0,0.18, 0,0,0,0, 0.24,0,0.2,0, 0,0.18,0,0, 0.28,0,0,0, 0.19,0,0,0.21, 0,0,0.19,0, 0,0,0.2,0],
    bassSustainA: [1.1,0,0,0, 0,0.24,0,0.2, 0,0,0.26,0, 0,0,0,0.2, 1.2,0,0,0, 0,0,0.28,0, 0,0.22,0,0, 0.2,0,0,0],
    bassSustainB: [0.72,0,0,0.2, 0,0,0,0, 0.44,0,0.22,0, 0,0.2,0,0, 1.0,0,0,0, 0.22,0,0,0.24, 0,0,0.22,0, 0,0,0.24,0],
    bassMode: 2, bassRes: 0.28, bassDrive: 2.2, bassIndex: 3.2,
    bassCutoffA: [480,620,820,1050, 520,760,1180,920, 440,680,980,1320, 560,840,1240,1080],
    bassCutoffB: [520,980,680,1480, 460,1220,760,1760, 580,1080,720,1580, 500,1360,860,1940],
    wobbleA: [1.25,2.5,1.25,3.75, 1.25,2.5,1.25,5],
    wobbleB: [2.5,5,1.25,6.25, 2.5,3.75,1.25,7.5],
    auxMode: 1, auxAmp: [0.11,0,0,0, 0,0,0,0, 0,0,0,0.12, 0,0,0,0],
    auxSustain: [0.72,0,0,0, 0,0,0,0, 0,0,0,0.28, 0,0,0,0],
    auxCutoff: [2400,3900,1800,4700, 2600,4200,2000,5200],
    chords: [[43,50,58,62,69], [44,51,56,63,67], [39,46,55,58,62], [38,45,55,57,62]],
    chordAmp: 0.04, chordSustain: 3.5, chordAttack: 0.07, chordRelease: 0.95, chordCutoff: 3900,
    motif: [0,Rest(),2,5, Rest(),4,2,Rest()], leadOctave: 5,
    leadMode: 1, leadModeB: 2, leadAmpA: 0.052, leadAmpB: 0.072, leadSustain: 0.17,
    leadCutoff: 4200, leadCutoffB: 6800, arpOctave: 6, arpAmp: 0.05, arpDecay: 2.4, arpBright: 3.8,
    accentChords: [[55,62,70],Rest(),Rest(), [56,63,68],Rest(),Rest(), [51,58,67],Rest()],
    accentAmp: 0.082, accentSustain: 0.38, accentCutoff: 3600,
    padAmp: 0.043, padCutoffLo: 420, padCutoffHi: 2800, textureAmp: 0.03,
    riserAmp: 0.12, riserDuration: 1.35, riserStart: 160, riserEnd: 13000,
    finalChord: [43,50,58,62,67,69], finalChordAmp: 0.058, finalChordCutoff: 7000, finalImpactAmp: 0.42
));

~ddMakeStyle.((
    prefix: \house, root: 0, scale: Scale.dorian, bassRoot: 36, padFreq: 65.4,
    drumGain: 0.82, bassGain: 0.92, musicGain: 1,
    kickSample: \kickClean, snareSample: \snareBeefy, hatSample: \hatHouse,
    kickRate: 1.04, snareRate: 1.08, hatRate: 1.02,
    kickSampleAmp: 0.46, kickSynthAmp: 0.31, kickDecay: 0.39, kickTone: 0.64,
    snareSampleAmp: 0.34, snareSynthAmp: 0.16, snareBody: 225, snareBright: 0.72,
    hatAmp: 0.74, percAmp: 0.38, percColor: 8200,
    kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
    snare:[0,0,0,0, 0.82,0,0,0, 0,0,0,0, 0.88,0,0,0, 0,0,0,0, 0.82,0,0,0, 0,0,0,0, 0.9,0,0,0],
    hat:  [0,0,0.52,0, 0,0,0.58,0, 0,0,0.54,0, 0,0,0.62,0, 0,0,0.56,0, 0,0,0.6,0, 0,0,0.58,0, 0,0,0.68,0],
    perc: [0,0.18,0,0, 0,0.14,0,0, 0,0.2,0,0, 0,0.16,0,0, 0,0.18,0,0, 0,0.14,0,0, 0,0.22,0,0, 0,0.18,0,0],
    bassA: [nil,nil,0,nil, nil,nil,0,nil, nil,nil,0,nil, nil,nil,0,nil, nil,nil,5,nil, nil,nil,5,nil, nil,nil,5,nil, nil,nil,5,nil],
    bassB: [nil,nil,0,nil, nil,7,nil,nil, nil,nil,0,nil, nil,nil,nil,12, nil,nil,5,nil, nil,nil,5,nil, nil,12,nil,nil, nil,nil,5,nil],
    aux: [nil,nil,12,nil, nil,nil,nil,nil, nil,nil,12,nil, nil,nil,nil,nil, nil,nil,17,nil, nil,nil,nil,nil, nil,nil,17,nil, nil,nil,nil,nil],
    bassAmpA: [0,0,0.24,0, 0,0,0.21,0, 0,0,0.23,0, 0,0,0.2,0, 0,0,0.24,0, 0,0,0.21,0, 0,0,0.23,0, 0,0,0.2,0],
    bassAmpB: [0,0,0.25,0, 0,0.19,0,0, 0,0,0.23,0, 0,0,0,0.18, 0,0,0.25,0, 0,0,0.22,0, 0,0.19,0,0, 0,0,0.21,0],
    bassSustainA: [0,0,0.32,0, 0,0,0.28,0, 0,0,0.3,0, 0,0,0.26,0, 0,0,0.32,0, 0,0,0.28,0, 0,0,0.3,0, 0,0,0.26,0],
    bassSustainB: [0,0,0.3,0, 0,0.22,0,0, 0,0,0.28,0, 0,0,0,0.2, 0,0,0.31,0, 0,0,0.27,0, 0,0.22,0,0, 0,0,0.26,0],
    bassMode: 3, bassRes: 0.31, bassDrive: 2.35, bassIndex: 2.8,
    bassCutoffA: [720,920,1180,1460, 760,980,1260,1580, 800,1040,1340,1700, 760,1120,1420,1840],
    bassCutoffB: [820,1320,940,1760, 760,1540,1080,2020, 880,1440,980,1880, 820,1660,1160,2240],
    wobbleA: [2.06,2.06,4.13,2.06, 2.06,4.13,2.06,4.13],
    wobbleB: [4.13,2.06,6.2,4.13, 2.06,6.2,4.13,8.26],
    auxMode: 3, auxAmp: [0,0,0.12,0, 0,0,0,0, 0,0,0.11,0, 0,0,0,0],
    auxSustain: [0,0,0.22,0, 0,0,0,0, 0,0,0.2,0, 0,0,0,0],
    auxCutoff: [720,980,1260,1680, 820,1120,1420,1960],
    chords: [[36,43,58,63,67], [41,48,57,63,67]],
    chordAmp: 0.04, chordSustain: 0.5, chordAttack: 0.006, chordRelease: 0.24, chordCutoff: 4300,
    motif: [0,Rest(),2,Rest(), 4,3,Rest(),2], leadOctave: 5,
    leadMode: 1, leadModeB: 0, leadAmpA: 0.05, leadAmpB: 0.062, leadSustain: 0.12,
    leadCutoff: 4600, leadCutoffB: 6200, arpOctave: 6, arpAmp: 0.036, arpDecay: 1.1, arpBright: 2.8,
    accentChords: [[60,67,70],Rest(), [65,72,75],Rest(), [60,67,70],Rest(), [65,72,75],Rest()],
    accentAmp: 0.052, accentSustain: 0.16, accentCutoff: 4200,
    padAmp: 0.032, padCutoffLo: 620, padCutoffHi: 2600, textureAmp: 0.02,
    riserAmp: 0.1, riserDuration: 1.85, riserStart: 220, riserEnd: 10800,
    finalChord: [36,43,58,63,67,72], finalChordAmp: 0.05, finalChordCutoff: 6100, finalImpactAmp: 0.4
));

~ddMakeStyle.((
    prefix: \melodic, root: 2, scale: Scale.minor, bassRoot: 38, padFreq: 73.4,
    drumGain: 0.92, bassGain: 0.68, musicGain: 1.75, chordGain: 4.4,
    kickSample: \kickClean, snareSample: \snareWide, hatSample: \hatMelodic,
    kickRate: 0.96, snareRate: 0.98, hatRate: 1.05,
    kickSampleAmp: 0.38, kickSynthAmp: 0.24, kickDecay: 0.44, kickTone: 0.36,
    snareSampleAmp: 0.36, snareSynthAmp: 0.17, snareBody: 185, snareBright: 0.58,
    hatAmp: 0.58, percAmp: 0.32, percColor: 7400,
    kick: [1,0,0,0, 0,0,0.68,0, 0,0,0,0, 0,0,0.62,0, 1,0,0,0, 0,0,0,0, 0,0,0.66,0, 0,0,0,0],
    snare:[0,0,0,0, 0,0,0,0, 0.92,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0.94,0,0,0, 0,0,0,0],
    hat:  [0,0,0.58,0, 0,0,0.36,0, 0,0,0.52,0, 0,0,0.32,0, 0,0,0.62,0, 0,0,0.38,0, 0,0,0.56,0, 0,0,0.34,0],
    perc: [0,0,0,0, 0,0,0,0.14, 0,0,0,0, 0,0,0,0.18, 0,0,0,0, 0,0,0,0.14, 0,0,0,0, 0,0,0,0.2],
    bassA: [0,nil,nil,nil, nil,nil,nil,nil, nil,nil,7,nil, nil,nil,nil,nil, 0,nil,nil,nil, nil,nil,nil,nil, nil,nil,3,nil, nil,nil,7,nil],
    bassB: [0,nil,nil,nil, nil,nil,nil,7, nil,nil,nil,nil, nil,nil,3,nil, 0,nil,nil,nil, nil,nil,nil,7, nil,nil,nil,nil, nil,nil,10,nil],
    aux: [0,nil,nil,nil, nil,nil,nil,nil, nil,nil,nil,nil, nil,nil,nil,nil, 0,nil,nil,nil, nil,nil,nil,nil, nil,nil,7,nil, nil,nil,nil,nil],
    bassAmpA: [0.18,0,0,0, 0,0,0,0, 0,0,0.16,0, 0,0,0,0, 0.19,0,0,0, 0,0,0,0, 0,0,0.15,0, 0,0,0.16,0],
    bassAmpB: [0.18,0,0,0, 0,0,0,0.14, 0,0,0,0, 0,0,0.15,0, 0.19,0,0,0, 0,0,0,0.14, 0,0,0,0, 0,0,0.16,0],
    bassSustainA: [0.82,0,0,0, 0,0,0,0, 0,0,0.3,0, 0,0,0,0, 0.86,0,0,0, 0,0,0,0, 0,0,0.32,0, 0,0,0.3,0],
    bassSustainB: [0.72,0,0,0, 0,0,0,0.28, 0,0,0,0, 0,0,0.3,0, 0.78,0,0,0, 0,0,0,0.3, 0,0,0,0, 0,0,0.32,0],
    bassMode: 4, bassRes: 0.24, bassDrive: 1.8, bassIndex: 2.2,
    bassCutoffA: [980,1280,1580,2100, 1100,1420,1760,2400, 920,1360,1680,2260, 1040,1480,1880,2600],
    bassCutoffB: [1160,1760,1380,2680, 1080,2100,1520,3100, 1260,1900,1440,2840, 1120,2320,1640,3400],
    wobbleA: [1.16,2.33,1.16,3.5, 1.16,2.33,1.16,4.66],
    wobbleB: [2.33,3.5,1.16,4.66, 2.33,5.83,1.16,7],
    auxMode: 2, auxAmp: [0.08,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    auxSustain: [0.8,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    auxCutoff: [1200,1800,1400,2200, 1300,2000,1500,2500],
    chords: [[38,45,53,57,64], [46,53,58,62,67], [39,46,55,58,62], [45,52,55,62,64]],
    chordAmp: 0.064, chordSustain: 3.72, chordAttack: 0.006, chordRelease: 0.62,
    chordCutoff: 13200, chordHardness: 1,
    motif: [0,2,4,Rest(), 3,2,Rest(),1], leadOctave: 5,
    leadMode: 0, leadModeB: 0, leadAmpA: 0.075, leadAmpB: 0.09, leadSustain: 0.34,
    leadCutoff: 7200, leadCutoffB: 9200, arpOctave: 6, arpAmp: 0.052, arpDecay: 1.7, arpBright: 3.4,
    accentChords: [[62,69,77],Rest(),Rest(),Rest(), [70,77,82],Rest(),Rest(),Rest()],
    accentAmp: 0.052, accentSustain: 0.4, accentCutoff: 5200,
    padAmp: 0.052, padCutoffLo: 720, padCutoffHi: 4200, textureAmp: 0.026,
    riserAmp: 0.11, riserDuration: 1.65, riserStart: 220, riserEnd: 14000,
    finalChord: [38,45,53,57,62,64,69], finalChordAmp: 0.075, finalChordCutoff: 9800, finalImpactAmp: 0.38
));

~ddMakeStyle.((
    prefix: \fusion, root: 7, scale: Scale.dorian, bassRoot: 31, padFreq: 49,
    kickSample: \kickTearout, snareSample: \snareWide, hatSample: \hatFusion,
    kickRate: 0.98, snareRate: 1, hatRate: 1.1,
    kickSampleAmp: 0.43, kickSynthAmp: 0.29, kickDecay: 0.4, kickTone: 0.62,
    snareSampleAmp: 0.4, snareSynthAmp: 0.2, snareBody: 190, snareBright: 0.74,
    hatAmp: 0.67, percAmp: 0.46, percColor: 9000,
    kick: [1,0,0,0, 0,0,0,0.72, 0,0,0,0, 0.7,0,0,0, 1,0,0,0.66, 0,0,0,0, 0,0.7,0,0, 0.68,0,0,0],
    snare:[0,0,0,0, 0.88,0,0,0, 0,0,0,0, 0.94,0,0,0, 0,0,0,0, 0.9,0,0,0, 0,0,0,0, 0.96,0,0,0],
    hat:  [0.62,0,0.28,0, 0,0.48,0,0.22, 0.68,0,0.34,0.18, 0,0.46,0,0.26, 0.66,0,0.3,0, 0,0.52,0,0.24, 0.72,0,0.38,0.2, 0,0.5,0,0.3],
    perc: [0,0,0,0.18, 0,0,0.14,0, 0,0.2,0,0, 0,0,0.16,0, 0,0,0.2, 0,0,0.15,0, 0,0.22,0,0, 0,0,0.18,0],
    bassA: [0,nil,nil,7, nil,12,nil,nil, 0,nil,nil,nil, nil,3,nil,12, 0,nil,nil,nil, 7,nil,12,nil, nil,nil,3,nil, 0,nil,nil,7],
    bassB: [0,12,nil,nil, nil,nil,7,nil, nil,3,nil,12, nil,nil,7,nil, 0,nil,12,nil, nil,7,nil,nil, 3,nil,nil,7, nil,12,nil,nil],
    aux: [0,nil,nil,nil, nil,nil,19,nil, nil,nil,nil,15, nil,nil,nil,nil, 0,nil,nil,12, nil,nil,nil,nil, 19,nil,nil,nil, nil,15,nil,nil],
    bassAmpA: [0.26,0,0,0.2, 0,0.18,0,0, 0.24,0,0,0, 0,0.19,0,0.18, 0.27,0,0,0, 0.2,0,0.18,0, 0,0,0.19,0, 0.25,0,0,0.2],
    bassAmpB: [0.27,0.18,0,0, 0,0,0.2,0, 0,0.19,0,0.18, 0,0,0.2,0, 0.28,0,0.18,0, 0,0.2,0,0, 0.19,0,0,0.2, 0,0.18,0,0],
    bassSustainA: [0.5,0,0,0.24, 0,0.2,0,0, 0.46,0,0,0, 0,0.22,0,0.18, 0.56,0,0,0, 0.24,0,0.2,0, 0,0,0.22,0, 0.5,0,0,0.24],
    bassSustainB: [0.42,0.18,0,0, 0,0,0.22,0, 0,0.2,0,0.18, 0,0,0.22,0, 0.48,0,0.18,0, 0,0.22,0,0, 0.2,0,0,0.22, 0,0.18,0,0],
    bassMode: 0.7, bassRes: 0.19, bassDrive: 2.9, bassIndex: 5.2,
    bassCutoffA: [880,1460,980,1880, 760,1680,1120,2240, 920,1540,1040,2020, 720,1760,1240,2460],
    bassCutoffB: [1280,2380,820,1940, 620,2680,1140,2260, 1460,2860,940,2140, 680,3120,1320,2540],
    wobbleA: [2.41,4.83,2.41,6.04, 3.62,2.41,4.83,7.25],
    wobbleB: [4.83,7.25,3.62,9.66, 2.41,8.45,4.83,12.08],
    auxMode: 4, auxAmp: [0.11,0,0,0, 0,0,0.13,0, 0,0,0,0.12, 0,0,0,0],
    auxSustain: [0.54,0,0,0, 0,0,0.26,0, 0,0,0,0.24, 0,0,0,0],
    auxCutoff: [1900,3300,1500,4100, 2200,3600,1700,4700],
    chords: [[43,50,58,62,69], [44,51,55,60,63], [36,43,55,62,67], [38,45,55,60,65]],
    chordAmp: 0.046, chordSustain: 3.55, chordAttack: 0.065, chordRelease: 0.9, chordCutoff: 5200,
    motif: [0,2,Rest(),5, 3,Rest(),1,4], leadOctave: 5,
    leadMode: 3, leadModeB: 0, leadAmpA: 0.06, leadAmpB: 0.078, leadSustain: 0.22,
    leadCutoff: 4800, leadCutoffB: 7600, arpOctave: 6, arpAmp: 0.045, arpDecay: 1.8, arpBright: 3.6,
    accentChords: [[55,62,70],Rest(), [56,63,67],Rest(), [60,67,74],Rest(), [57,64,72],Rest()],
    accentAmp: 0.065, accentSustain: 0.34, accentCutoff: 4300,
    padAmp: 0.046, padCutoffLo: 520, padCutoffHi: 3400, textureAmp: 0.03,
    riserAmp: 0.125, riserDuration: 1.58, riserStart: 170, riserEnd: 13800,
    finalChord: [43,50,58,62,67,69,74], finalChordAmp: 0.067, finalChordCutoff: 8200, finalImpactAmp: 0.45
));

// A restrained two-beat pulse keeps the short Bass House build grounded
// without spending the full four-on-floor impact before the drop.
Pdef(\house_buildPulse, Ppar([
    Pbind(
        \instrument, \cc_sampler, \freq, 48,
        \buf, ~ddSamples[\kickClean], \rate, 1.04,
        \dur, 1,
        \amp, Pseq([0.24, Rest(), 0.18, Rest()], inf)
    ),
    Pbind(
        \instrument, \dd_kick, \freq, 48,
        \dur, 1,
        \amp, Pseq([0.14, Rest(), 0.1, Rest()], inf),
        \decay, 0.34, \tone, 0.52
    )
]));

"DROP_DESTINY_TAPE_READY".postln;
)
