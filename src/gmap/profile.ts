const PROFILE_STORAGE_KEY = 'gmap_profile_v1';

export interface Profile {
  name: string;
  birthday: string;
  profileKey: string;
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Profile;
  } catch {
    return null;
  }
}

export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ストレージが使えない場合はプロフィールの永続化を諦める
  }
}

export function clearProfile(): void {
  try {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
  } catch {
    // no-op
  }
}
