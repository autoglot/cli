"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Spinner = void 0;
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
class Spinner {
    interval = null;
    frame = 0;
    message = "";
    start(message) {
        this.message = message;
        this.frame = 0;
        this.render();
        this.interval = setInterval(() => this.render(), 80);
    }
    update(message) {
        this.message = message;
    }
    stop(finalMessage) {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        process.stderr.write("\r\x1b[K");
        if (finalMessage) {
            process.stderr.write(finalMessage + "\n");
        }
    }
    render() {
        const char = SPINNER_FRAMES[this.frame % SPINNER_FRAMES.length];
        process.stderr.write(`\r\x1b[K${char} ${this.message}`);
        this.frame++;
    }
}
exports.Spinner = Spinner;
