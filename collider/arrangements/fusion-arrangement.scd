// G modal Destiny Fusion: bell/pad foreshadowing and mixed bass responses.
~ddTempo = 145;
~ddDuration = 14 * 4 * (60 / ~ddTempo);
~ddRecordingName = "06-destiny-fusion.wav";

~ddArrangement = CCArrangement([
    [\intro, 2, [\fusion_pad, \fusion_texture, \fusion_arp]],
    [\build, 3, [\fusion_pad, \fusion_texture, \fusion_chords, \fusion_leadA, \fusion_arp, \fusion_hat, \fusion_perc]],
    [\predrop, 1, [\fusion_texture, \fusion_riser, \fusion_roll]],
    [\dropA, 4, [\fusion_kick, \fusion_snare, \fusion_hat, \fusion_perc, \fusion_bassA, \fusion_auxBass, \fusion_chords, \fusion_accent]],
    [\dropB, 3, [\fusion_kick, \fusion_snare, \fusion_hat, \fusion_perc, \fusion_bassB, \fusion_auxBass, \fusion_chords, \fusion_leadB, \fusion_arp, \fusion_accent]],
    [\final, 1, [\fusion_finalImpact, \fusion_finalChord]]
]);
