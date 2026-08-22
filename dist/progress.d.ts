export declare class Spinner {
    private interval;
    private frame;
    private message;
    start(message: string): void;
    update(message: string): void;
    stop(finalMessage?: string): void;
    private render;
}
