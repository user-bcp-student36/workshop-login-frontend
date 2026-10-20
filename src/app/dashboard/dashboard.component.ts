import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import axios from 'axios';
import { formatTaskLabel } from '../utils/legacy-format';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  tasks: any[] = [];
  visibleTasks: any[] = [];
  user: any = {};
  loading: any = true;
  error: any = '';

  constructor(private router: Router) {}

  async ngOnInit(): Promise<void> {
    const token = localStorage.getItem('workshop_token');
    this.user = JSON.parse(localStorage.getItem('workshop_user') || '{}');
    if (!token) {
      await this.router.navigate(['/login']);
    } else {
      try {
        const response: any = await axios.get('http://localhost:8000/api/tasks?owner=' + (this.user.username || ''), {
          headers: { Authorization: 'Bearer ' + token }
        });
        this.tasks = response.data;
        const tmp: any[] = [];
        for (let i = 0; i < this.tasks.length; i++) {
          if (this.tasks[i].status !== 'ARCHIVED') {
            this.tasks[i].label = formatTaskLabel(this.tasks[i]);
            tmp.push(this.tasks[i]);
          }
        }
        tmp.sort((a: any, b: any) => a.priority > b.priority ? -1 : 1);
        this.visibleTasks = tmp;
      } catch (error: any) {
        this.error = error?.response?.data?.detail || error?.message || 'No se pudo cargar el dashboard';
      }
      this.loading = false;
    }
  }

  async logout(): Promise<void> {
    localStorage.removeItem('workshop_token');
    localStorage.removeItem('workshop_user');
    await this.router.navigate(['/login']);
  }
}
