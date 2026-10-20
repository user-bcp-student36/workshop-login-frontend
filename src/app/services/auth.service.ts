import { Injectable } from '@angular/core';
import axios from 'axios';
import { environment } from '../../environments/environment';
import { Credentials, isRecord, LoginResponse, User } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  async login(credentials: Credentials): Promise<LoginResponse> {
    const response = await axios.post<unknown>(environment.authUrl, {
      ...credentials, client: environment.loginClient
    }, { timeout: environment.loginTimeoutMs });
    if (!isRecord(response.data)) return {};
    return {
      token: response.data.token,
      user: isRecord(response.data.user) ? response.data.user as User : undefined
    };
  }
}