import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

const ClientNewTicket = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });
  const [attachments, setAttachments] = useState([]);
  const [attachmentPreviews, setAttachmentPreviews] = useState([]);

  // cleanup previews on unmount
  useEffect(() => {
    return () => {
      attachmentPreviews.forEach(p => p.url && URL.revokeObjectURL(p.url));
    };
  }, [attachmentPreviews]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (attachments && attachments.length) {
        const fd = new FormData();
        fd.append('title', formData.title);
        fd.append('description', formData.description);
        attachments.forEach((f) => fd.append('attachments', f));
        const response = await api.post('/tickets', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        navigate(`/client/tickets/${response.data.id}`);
      } else {
        const response = await api.post('/tickets', formData);
        navigate(`/client/tickets/${response.data.id}`);
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Ошибка при создании тикета');
    } finally {
      setLoading(false);
    }
  };

  const handleFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    setAttachments(files);
    const previews = files.map((f) => ({
      file: f,
      url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
    }));
    setAttachmentPreviews((prev) => {
      prev.forEach(p => p.url && URL.revokeObjectURL(p.url));
      return previews;
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate('/client')}
          className="text-primary-600 hover:text-primary-700 flex items-center"
        >
          ← Назад
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          Создать новый тикет
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Тема <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Описание проблемы <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows="6"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4 pt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Вложения</label>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
                  Прикрепить файлы
                  <input className="hidden" type="file" name="attachments" multiple onChange={handleFilesChange} />
                </label>
                <div className="text-sm text-gray-500">Выбранно: {attachments.length}</div>
              </div>

              {attachmentPreviews.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {attachmentPreviews.map((p, idx) => (
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
                        const newFiles = attachments.filter((_, i) => i !== idx);
                        setAttachments(newFiles);
                        setAttachmentPreviews(prev => {
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
              disabled={loading}
              className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Создание...' : 'Создать тикет'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/client')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientNewTicket;

