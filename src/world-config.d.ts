export type MMLDocument = {
    url: string;
    position?: {
        x: number;
        y: number;
        z: number;
    };
    rotation?: {
        x: number;
        y: number;
        z: number;
    };
    scale?: {
        x: number;
        y: number;
        z: number;
    };
};
export interface MMLWorldConfig {
    name: string;
    mmlDocumentsConfiguration: {
        mmlDocuments: Record<string, MMLDocument>;
    };
}
