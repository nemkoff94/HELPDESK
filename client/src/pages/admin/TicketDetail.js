import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../hooks/useAuth';

const TicketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Обновление каждые 5 секунд
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchData = async () => {
    try {
      const [ticketRes, commentsRes] = await Promise.all([
        api.get(`/tickets/${id}`),
        api.get(`/tickets/${id}/comments`),
      ]);
      setTicket(ticketRes.data);
      setComments(commentsRes.data);
    } catch (error) {
      console.error('Ошибка при загрузке данных:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await api.put(`/tickets/${id}`, { status: newStatus });
      fetchData();
    } catch (error) {
      console.error('Ошибка при изменении статуса:', error);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      await api.post(`/tickets/${id}/comments`, { message: newComment });
      setNewComment('');
      fetchData();
    } catch (error) {
      console.error('Ошибка при отправке комментария:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'open':
        return 'Открыт';
      case 'in_progress':
        return 'В работе';
      case 'resolved':
        return 'Решен';
      case 'closed':
        return 'Закрыт';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!ticket) {
    return <div>Тикет не найден</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="text-primary-600 hover:text-primary-700 flex items-center"
        >
          ← Назад
        </button>
        {user?.role === 'admin' && (
          <div className="flex gap-2">
            <select
              value={ticket.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className={`px-3 py-1 rounded text-sm font-medium border ${getStatusColor(
                ticket.status
              )}`}
            >
              <option value="open">Открыт</option>
              <option value="in_progress">В работе</option>
              <option value="resolved">Решен</option>
              <option value="closed">Закрыт</option>
            </select>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              {ticket.title}
            </h1>
            <p className="text-sm text-gray-500">
              Создан: {new Date(ticket.created_at).toLocaleString('ru-RU')}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(
              ticket.status
            )}`}
          >
            {getStatusText(ticket.status)}
          </span>
        </div>

        <div className="border-t pt-4">
          <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Комментарии</h2>

        <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className={`p-4 rounded-lg ${
                comment.user_id
                  ? 'bg-primary-50 border-l-4 border-primary-500'
                  : 'bg-gray-50 border-l-4 border-gray-400'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-gray-800">
                    {comment.user_name || comment.client_name || 'Клиент'}
                  </p>
                  {comment.user_role && (
                    <p className="text-xs text-gray-500">
                      {comment.user_role === 'admin'
                        ? 'Администратор'
                        : 'Специалист'}
                    </p>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {new Date(comment.created_at).toLocaleString('ru-RU')}
                </p>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">
                {comment.message}
              </p>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmitComment} className="space-y-3">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Написать комментарий..."
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          />
          <button
            type="submit"
            disabled={submitting || !newComment.trim()}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Отправка...' : 'Отправить'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TicketDetail;

