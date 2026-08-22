export interface Config {
    apiKey: string;
    apiUrl: string;
}
export declare function resolveConfig(opts: {
    apiKey?: string;
    apiUrl?: string;
}): Config;
