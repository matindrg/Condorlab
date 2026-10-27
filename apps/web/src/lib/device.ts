export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    let did = localStorage.getItem('condor_device_id');
    if (!did || !did.startsWith('dev_')) {
      did = `dev_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
      localStorage.setItem('condor_device_id', did);
    }
    return did;
  } catch {
    return 'dev_default_client';
  }
}
