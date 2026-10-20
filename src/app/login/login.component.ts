import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Preferences } from '../models/auth.models';
import { AuthService } from '../services/auth.service';
import { SessionService } from '../services/session.service';
import { LOGIN_MESSAGES, publicErrorMessage } from '../utils/auth-errors';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  username: string | null | undefined = '';
  password: string | null | undefined = '';
  busy = false;
  message = '';
  preferences: Preferences;

  constructor(
    private router: Router,
    private auth: AuthService,
    private session: SessionService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {
    this.preferences = this.session.loadPreferences();
  }

  async login(): Promise<void> {
    this.message = '';
    if (!this.username?.trim()) {
      this.message = LOGIN_MESSAGES.usernameRequired;
      return;
    }
    if (!this.password?.trim()) {
      this.message = LOGIN_MESSAGES.passwordRequired;
      return;
    }
    this.busy = true;
    try {
      const response = await this.auth.login({ username: this.username, password: this.password });
      if (!response.token) {
        this.message = LOGIN_MESSAGES.tokenMissing;
        return;
      }
      this.session.save(response.token, response.user, this.preferences);
      await this.router.navigate(['/dashboard']);
    } catch (error: unknown) {
      this.message = publicErrorMessage(error, 'login');
    } finally {
      this.zone.run(() => {
        this.busy = false;
        this.cdr.detectChanges();
      });
    }
  }
}
