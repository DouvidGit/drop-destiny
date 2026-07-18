// D minor melodic dubstep: supersaw harmony and saw lead stay in front.
~ddTempo = 150;
~ddDuration = 14 * 4 * (60 / ~ddTempo);
~ddRecordingName = "05-melodic-dubstep-destiny.wav";

~ddArrangement = CCArrangement([
    [\intro, 2, [\melodic_pad, \melodic_texture, \melodic_arp, \melodic_leadA]],
    [\build, 3, [\melodic_pad, \melodic_texture, \melodic_chords, \melodic_leadA, \melodic_arp, \melodic_hat, \melodic_perc]],
    [\predrop, 1, [\melodic_texture, \melodic_riser, \melodic_roll]],
    [\dropA, 4, [\melodic_kick, \melodic_snare, \melodic_hat, \melodic_perc, \melodic_bassA, \melodic_chords, \melodic_leadA, \melodic_arp, \melodic_pad]],
    [\dropB, 3, [\melodic_kick, \melodic_snare, \melodic_hat, \melodic_perc, \melodic_bassB, \melodic_auxBass, \melodic_chords, \melodic_leadB, \melodic_arp, \melodic_accent, \melodic_pad]],
    [\final, 1, [\melodic_finalImpact, \melodic_finalChord]]
]);
