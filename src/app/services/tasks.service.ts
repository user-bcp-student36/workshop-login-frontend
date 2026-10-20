import { Injectable } from '@angular/core';
import axios from 'axios';
import { environment } from '../../environments/environment';
import { isRecord } from '../models/auth.models';
import { Task } from '../models/task.models';
import { formatTaskLabel } from '../utils/legacy-format';

const ARCHIVED_STATUS = 'ARCHIVED';

@Injectable({ providedIn: 'root' })
export class TasksService {
  async load(owner: string, token: string): Promise<Task[]> {
    const response = await axios.get<unknown>(environment.tasksUrl + '?owner=' + owner, {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!Array.isArray(response.data) || !response.data.every(isRecord)) {
      throw new Error('No se pudo cargar el dashboard');
    }
    return response.data as Task[];
  }

  visibleTasks(tasks: Task[]): Task[] {
    const visible = tasks.filter((task) => task.status !== ARCHIVED_STATUS);
    for (const task of visible) task.label = formatTaskLabel(task);
    return visible.sort((left, right) => left.priority > right.priority ? -1 : 1);
  }
}