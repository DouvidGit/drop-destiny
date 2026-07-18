// Syntax/runtime validation runner for the DROP//DESTINY tape.
// Environment variables:
//   DD_TAPE, DD_SAMPLE_DIR

~ddValidationFailed = false;

~cc = CC.boot(
    onComplete: {
        Routine({
            try {
                "DD_TAPE".getenv.load;
                s.sync;
                "DROP_DESTINY_VALIDATION_OK".postln;
            } { |error|
                ~ddValidationFailed = true;
                "DROP_DESTINY_VALIDATION_FAILED".postln;
                error.reportError;
            };
            ~cc.stop;
            s.quit;
            1.wait;
            if(~ddValidationFailed) { 1.exit } { 0.exit };
        }).play(AppClock);
    }
);
