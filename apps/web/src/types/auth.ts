export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface LoginResponseData {
  user: User;
  accessToken: string;
}

export interface RegisterResponseData {
  user: User;
}

export interface RefreshResponseData {
  accessToken: string;
}
