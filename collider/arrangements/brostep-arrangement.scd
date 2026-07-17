// A minor brostep: brass/screech setup, dense bass dialogue in the drop.
~ddTempo = 150;
~ddDuration = 14 * 4 * (60 / ~ddTempo);
~ddRecordingName = "02-brostep-destiny.wav";

~ddArrangement = CCArrangement([
    [\intro, 2, [\brostep_pad, \brostep_texture, \brostep_accent]],
    [\build, 3, [\brostep_pad, \brostep_texture, \brostep_chords, \brostep_leadA, \brostep_hat, \brostep_perc]],
    [\predrop, 1, [\brostep_texture, \brostep_riser, \brostep_roll]],
    [\dropA, 4, [\brostep_kick, \brostep_snare, \brostep_hat, \brostep_perc, \brostep_bassA, \brostep_auxBass, \brostep_chords, \brostep_accent]],
    [\dropB, 3, [\brostep_kick, \brostep_snare, \brostep_hat, \brostep_perc, \brostep_bassB, \brostep_auxBass, \brostep_chords, \brostep_leadB, \brostep_arp, \brostep_accent]],
    [\final, 1, [\brostep_finalImpact, \brostep_finalChord]]
]);
