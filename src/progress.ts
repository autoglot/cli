const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export class Spinner {
  private interval: ReturnType<typeof setInterval> | null = null;
  private frame = 0;
  private message = "";

  start(message: string) {
    this.message = message;
    this.frame = 0;
    this.render();
    this.interval = setInterval(() => this.render(), 80);
  }

  update(message: string) {
    this.message = message;
  }

  stop(finalMessage?: string) {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stderr.write("\r\x1b[K");
    if (finalMessage) {
      process.stderr.write(finalMessage + "\n");
    }
  }

  private render() {
    const char = SPINNER_FRAMES[this.frame % SPINNER_FRAMES.length];
    process.stderr.write(`\r\x1b[K${char} ${this.message}`);
    this.frame++;
  }
}
