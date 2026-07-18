// Render a web backing stem from one saved CCArrangement.
// The primary bassA/bassB parts are removed; auxiliary response bass remains.
// Required env: DD_TAPE, DD_ARRANGEMENT, DD_SAMPLE_DIR,
// DD_RECORDINGS_DIR, DD_BACKING_NAME

~ddRenderFailed = false;

~cc = CC.boot(
    recordingsDir: "DD_RECORDINGS_DIR".getenv,
    onComplete: {
        Routine({
            try {
                "DD_TAPE".getenv.load;
                s.sync;
                "DD_ARRANGEMENT".getenv.load;

                ~ddBackingSections = ~ddArrangement.sections.collect { |section|
                    var elements = section[2].reject { |name|
                        var text = name.asString;
                        text.endsWith("bassA") or: { text.endsWith("bassB") }
                    };
                    if(section.size > 3) {
                        [section[0], section[1], elements, section[3]]
                    } {
                        [section[0], section[1], elements]
                    }
                };
                ~ddArrangement = CCArrangement(~ddBackingSections);
                ~ddRecordingName = "DD_BACKING_NAME".getenv;

                ~cc.tempo(~ddTempo);
                ~cc.recorder.start(~ddRecordingName).postln;
                0.35.wait;
                ~ddArrangement.play;
                while { ~ddArrangement.isPlaying } { 0.25.wait };
                4.wait;
                ~cc.recorder.stop.postln;
                "DROP_DESTINY_BACKING_OK:%".format(~ddRecordingName).postln;
            } { |error|
                ~ddRenderFailed = true;
                "DROP_DESTINY_BACKING_FAILED".postln;
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
