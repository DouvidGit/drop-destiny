// G minor hybrid trap: spacious 808 foundation, bell and brass punctuation.
~ddTempo = 150;
~ddDuration = 14 * 4 * (60 / ~ddTempo);
~ddRecordingName = "03-hybrid-trap-destiny.wav";

~ddArrangement = CCArrangement([
    [\intro, 2, [\hybrid_pad, \hybrid_texture, \hybrid_arp]],
    [\build, 3, [\hybrid_pad, \hybrid_texture, \hybrid_chords, \hybrid_leadA, \hybrid_arp, \hybrid_hat, \hybrid_perc]],
    [\predrop, 1, [\hybrid_texture, \hybrid_riser, \hybrid_roll]],
    [\dropA, 4, [\hybrid_kick, \hybrid_snare, \hybrid_hat, \hybrid_perc, \hybrid_bassA, \hybrid_auxBass, \hybrid_chords, \hybrid_accent]],
    [\dropB, 3, [\hybrid_kick, \hybrid_snare, \hybrid_hat, \hybrid_perc, \hybrid_bassB, \hybrid_auxBass, \hybrid_chords, \hybrid_leadB, \hybrid_arp, \hybrid_accent]],
    [\final, 1, [\hybrid_finalImpact, \hybrid_finalChord]]
]);
