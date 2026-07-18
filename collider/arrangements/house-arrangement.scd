// C Dorian bass house: four-on-floor, donk responses and organ-like stabs.
~ddTempo = 126;
~ddDuration = 14 * 4 * (60 / ~ddTempo);
~ddRecordingName = "04-bass-house-destiny.wav";

~ddArrangement = CCArrangement([
    [\intro, 2, [\house_pad, \house_texture, \house_chords]],
    [\build, 3, [\house_pad, \house_texture, \house_buildPulse, \house_hat, \house_perc, \house_chords, \house_leadA]],
    [\predrop, 1, [\house_pad, \house_riser, \house_roll]],
    [\dropA, 4, [\house_kick, \house_snare, \house_hat, \house_perc, \house_bassA, \house_auxBass, \house_chords, \house_leadA, \house_accent]],
    [\dropB, 3, [\house_kick, \house_snare, \house_hat, \house_perc, \house_bassB, \house_auxBass, \house_chords, \house_leadB, \house_arp, \house_accent]],
    [\final, 1, [\house_finalImpact, \house_finalChord]]
]);
