export interface WorldConfig {
  id: string;
  name: string;
  description?: string;
  enableTweakPane?: boolean;
  authConfiguration?: {
    allowAnonymous?: boolean;
    password?: string;
    authProviders?: {
      webhook?: { webhookUrl: string };
      google?: { allowedOrganzations: string[] };
      discord?: { allowedUsers: string[] };
    };
  };
  generalConfiguration?: {
    maxUserConnections?: number;
  };
  chatConfiguration?: {
    enabled?: boolean;
  };
  mmlDocumentConfiguration: {
    mmlDocuments: Record<
      string,
      {
        url: string;
        position?: { x: number; y: number; z: number };
        rotation?: { x: number; y: number; z: number };
        scale?: { x: number; y: number; z: number };
      }
    >;
  };
  environmentConfiguration?: {
    groundPlane?: boolean;
    skybox?: {
      intensity?: number;
      blurriness?: number;
      azimuthalAngle?: number;
      polarAngle?: number;
    };
    envMap?: {
      intensity?: number; // Don't think this is correct in the API.
    };
    sun?: {
      blurriness?: number;
      azimuthalAngle?: number;
      polarAngle?: number;
    };
    postProcessing?: {
      bloomIntensity?: number;
    };
    ambientLight?: {
      intensity?: number;
    };
  };
  avatarConfiguration?: {
    allowCustomAvatars?: boolean;
    customAvatarWebhook?: boolean;
  };
}
