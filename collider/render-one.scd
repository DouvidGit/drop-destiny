// Render one saved CCArrangement through the ClaudeCollider recorder.
// Required environment variables:
// DD_TAPE, DD_ARRANGEMENT, DD_SAMPLE_DIR, DD_RECORDINGS_DIR

~ddRenderFailed = false;

~cc = CC.boot(
    recordingsDir: "DD_RECORDINGS_DIR".getenv,
    onComplete: {
        Routine({
            try {
                "DD_TAPE".getenv.load;
                s.sync;
                "DD_ARRANGEMENT".getenv.load;
                ~cc.tempo(~ddTempo);
                ~cc.recorder.start(~ddRecordingName).postln;
                0.35.wait;
                ~ddArrangement.play;
                while { ~ddArrangement.isPlaying } { 0.25.wait };
                4.wait;
                ~cc.recorder.stop.postln;
                "DROP_DESTINY_RENDER_OK:%".format(~ddRecordingName).postln;
            } { |error|
                ~ddRenderFailed = true;
                "DROP_DESTINY_RENDER_FAILED".postln;
                error.reportError;
                if(~cc.recorder.isRecording) { ~cc.recorder.stop.postln };
            };
            ~cc.stop;
            s.quit;
            1.wait;
            if(~ddRenderFailed) { 1.exit } { 0.exit };
        }).play(AppClock);
    }
);
