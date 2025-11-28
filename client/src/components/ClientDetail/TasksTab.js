import React from 'react';
import formatDate from '../../utils/formatDate';

const TasksTab = ({ tasks, user, navigate, onDeleteTask }) => {
  const getTaskStatusColor = (status) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTaskStatusText = (status) => {
    switch (status) {
      case 'new':
        return 'Новая';
      case 'in_progress':
        return 'В работе';
      case 'completed':
        return 'Завершена';
      default:
        return status;
    }
  };

  const isTaskOverdue = (deadline, status) => {
    if (!deadline || status === 'completed') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(0, 0, 0, 0);
    return deadlineDate < today;
  };

  return (
    <div className="space-y-3">
      {user?.role === 'admin' && (
        <div className="mb-4">
          <button
            onClick={() => navigate('/admin/tasks/new')}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm"
          >
            + Создать задачу
          </button>
        </div>
      )}
      {tasks.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          Задач пока нет
        </p>
      ) : (
        tasks.map((task) => {
          const overdue = isTaskOverdue(task.deadline, task.status);
          return (
            <div
              key={task.id}
              onClick={() => navigate(`/admin/tasks/${task.id}`)}
              className={`border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                overdue ? 'border-2 border-red-500 bg-red-50' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-800">
                      {task.title}
                    </h3>
                    {overdue && (
                      <span className="text-red-600 text-xs font-semibold">
                        ⚠️ ПРОСРОЧЕНА
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>
                      Создана: {formatDate(task.created_at, { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    </span>
                    {task.deadline && (
                      <span className={overdue ? 'text-red-600 font-semibold' : ''}>
                        Дедлайн: {formatDate(task.deadline, { year: 'numeric', month: '2-digit', day: '2-digit' })}
                      </span>
                    )}
                    {task.created_by_name && (
                      <span>Автор: {task.created_by_name}</span>
                    )}
                  </div>
                </div>
                <span
                  className={`ml-4 px-2 py-1 rounded text-xs font-medium ${getTaskStatusColor(
                    task.status
                  )}`}
                >
                  {getTaskStatusText(task.status)}
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default TasksTab;
