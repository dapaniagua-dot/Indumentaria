// No longer needed in local mode - kept for import compatibility
export const appParams = {
  appId: 'local',
  token: null,
  fromUrl: typeof window !== 'undefined' ? window.location.href : '',
  functionsVersion: 'local',
  appBaseUrl: '',
};
