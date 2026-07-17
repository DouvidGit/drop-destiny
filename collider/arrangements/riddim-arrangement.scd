// A minor riddim: negative-space bass calls with formant/metal answers.
~ddTempo = 140;
~ddDuration = 14 * 4 * (60 / ~ddTempo);
~ddRecordingName = "01-riddim-destiny.wav";

~ddArrangement = CCArrangement([
    [\intro, 2, [\riddim_pad, \riddim_texture, \riddim_accent]],
    [\build, 3, [\riddim_pad, \riddim_texture, \riddim_chords, \riddim_leadA, \riddim_hat, \riddim_perc]],
    [\predrop, 1, [\riddim_texture, \riddim_riser, \riddim_roll]],
    [\dropA, 4, [\riddim_kick, \riddim_snare, \riddim_hat, \riddim_perc, \riddim_bassA, \riddim_auxBass, \riddim_chords, \riddim_accent]],
    [\dropB, 3, [\riddim_kick, \riddim_snare, \riddim_hat, \riddim_perc, \riddim_bassB, \riddim_auxBass, \riddim_chords, \riddim_leadB, \riddim_accent]],
    [\final, 1, [\riddim_finalImpact, \riddim_finalChord]]
]);
