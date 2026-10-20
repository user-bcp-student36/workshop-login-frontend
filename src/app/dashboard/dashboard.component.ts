import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '../models/auth.models';
import { Task } from '../models/task.models';
import { SessionService } from '../services/session.service';
import { TasksService } from '../services/tasks.service';
import { publicErrorMessage } from '../utils/auth-errors';

const STATUS_LABELS: Record<string, string> = {
  TODO: 'Por hacer',
  IN_PROGRESS: 'En progreso',
  DONE: 'Completado',
  RESUELTO: 'Resuelto',
  COMPLETED: 'Completado'
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  tasks: Task[] = [];
  visibleTasks: Task[] = [];
  user: User = {};
  loading = true;
  error = '';

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private session: SessionService,
    private tasksService: TasksService
  ) {}

  statusLabel(status: string): string {
    return STATUS_LABELS[(status || '').toUpperCase()] || status;
  }

  async ngOnInit(): Promise<void> {
    const token = this.session.readToken();
    this.user = this.session.readUser();
    if (!token) {
      await this.router.navigate(['/login']);
      return;
    }
    try {
      this.tasks = await this.tasksService.load(this.user.username || '', token);
      this.visibleTasks = this.tasksService.visibleTasks(this.tasks);
    } catch (error: unknown) {
      this.error = publicErrorMessage(error, 'tasks');
    } finally {
      this.zone.run(() => {
        this.loading = false;
        this.cdr.detectChanges();
      });
    }
  }

  async logout(): Promise<void> {
    this.session.clear();
    await this.router.navigate(['/login']);
  }
}
