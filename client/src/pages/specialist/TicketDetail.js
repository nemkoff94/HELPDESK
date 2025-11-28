import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import transliterateForDisplay from '../../utils/transliterate';
import { useAuth } from '../../hooks/useAuth';

const SpecialistTicketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentFiles, setCommentFiles] = useState([]);
  const { user } = useAuth();
  const [commentPreviews, setCommentPreviews] = useState([]);
  // cleanup previews on unmount
  useEffect(() => {
    return () => {
      commentPreviews.forEach(p => p.url && URL.revokeObjectURL(p.url));
    };
  }, [commentPreviews]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
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
      if (commentFiles && commentFiles.length) {
        const fd = new FormData();
        fd.append('message', newComment);
        commentFiles.forEach((f) => fd.append('attachments', f));
        await api.post(`/tickets/${id}/comments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post(`/tickets/${id}/comments`, { message: newComment });
      }
      setNewComment('');
      setCommentFiles([]);
      fetchData();
    } catch (error) {
      console.error('Ошибка при отправке комментария:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommentFilesSelect = (e) => {
    const files = Array.from(e.target.files || []);
    setCommentFiles(files);
    const previews = files.map((f) => ({ file: f, url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null }));
    setCommentPreviews((prev) => {
      prev.forEach(p => p.url && URL.revokeObjectURL(p.url));
      return previews;
    });
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!user || user.role !== 'admin') return;
    try {
      await api.delete(`/tickets/attachments/${attachmentId}`);
      fetchData();
    } catch (e) {
      console.error('Ошибка при удалении вложения:', e);
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
          onClick={() => navigate('/specialist')}
          className="text-primary-600 hover:text-primary-700 flex items-center"
        >
          ← Назад
        </button>
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
          {ticket.attachments && ticket.attachments.length > 0 && (
            <div className="mt-4">
              <h3 className="font-medium text-gray-800 mb-2">Вложения</h3>
              <ul className="space-y-2">
                {ticket.attachments.map((att) => {
                  const created = new Date(att.created_at);
                  const expired = Date.now() - created.getTime() > 30 * 24 * 3600 * 1000;
                  const fileUrl = att.path && (att.path.startsWith('http') ? att.path : `${api.defaults.baseURL.replace(/\/api$/, '')}${att.path}`);
                  return (
                    <li key={att.id} className="flex items-center justify-between">
                      <a href={fileUrl} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">
                        {att.original_name ? transliterateForDisplay(att.original_name) : att.filename}
                      </a>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{new Date(att.created_at).toLocaleString('ru-RU')}</span>
                        {expired && <span className="text-xs text-yellow-600">Устарело</span>}
                        {user?.role === 'admin' && (
                          <button onClick={() => handleDeleteAttachment(att.id)} className="text-red-600 text-sm">Удалить</button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
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
              {comment.attachments && comment.attachments.length > 0 && (
                <div className="mt-2">
                  <h4 className="text-sm font-medium">Вложения:</h4>
                  <ul className="text-sm">
                    {comment.attachments.map((att) => {
                        const fileUrl = att.path && (att.path.startsWith('http') ? att.path : `${api.defaults.baseURL.replace(/\/api$/, '')}${att.path}`);
                        return (
                        <li key={att.id} className="flex items-center justify-between">
                          <a href={fileUrl} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">
                            {att.original_name ? transliterateForDisplay(att.original_name) : att.filename}
                          </a>
                          <div className="text-xs text-gray-500">{new Date(att.created_at).toLocaleString('ru-RU')}</div>
                        </li>
                      )})}
                  </ul>
                </div>
              )}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Вложения</label>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
                Добавить
                <input className="hidden" type="file" multiple onChange={handleCommentFilesSelect} />
              </label>
              <div className="text-sm text-gray-500">Выбранно: {commentFiles.length}</div>
            </div>

            {commentPreviews.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-3">
                {commentPreviews.map((p, idx) => (
                  <div key={idx} className="border rounded-lg p-2 bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {p.url ? (
                        <img src={p.url} alt={p.file.name} className="w-16 h-12 object-cover rounded" />
                      ) : (
                        <div className="w-16 h-12 flex items-center justify-center bg-white border rounded text-xs text-gray-600">FILE</div>
                      )}
                      <div className="text-sm">
                        <div className="font-medium">{p.file.name}</div>
                        <div className="text-xs text-gray-500">{(p.file.size/1024).toFixed(1)} KB</div>
                      </div>
                    </div>
                    <button type="button" onClick={() => {
                      const newFiles = commentFiles.filter((_, i) => i !== idx);
                      setCommentFiles(newFiles);
                      setCommentPreviews(prev => {
                        const toRevoke = prev[idx];
                        if (toRevoke && toRevoke.url) URL.revokeObjectURL(toRevoke.url);
                        return prev.filter((_, i) => i !== idx);
                      });
                    }} className="text-red-600 text-sm ml-2">Удалить</button>
                  </div>
                ))}
              </div>
            )}
          </div>
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

export default SpecialistTicketDetail;

