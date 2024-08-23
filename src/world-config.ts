export interface MMLWorldConfig {
  mmlDocuments: Record<
    string,
    {
      url: string;
      position?: { x: number; y: number; z: number };
      rotation?: { x: number; y: number; z: number };
      scale?: { x: number; y: number; z: number };
    }
  >;
}
