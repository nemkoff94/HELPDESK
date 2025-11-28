import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import formatDate from '../../utils/formatDate';

const ClientWidgetsManager = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ad-campaign');

  // Состояния для виджета рекламных кампаний
  const [adCampaignForm, setAdCampaignForm] = useState({
    enabled: false,
    monthly_budget: '',
    recommended_budget: '',
    status: 'active',
  });

  // Состояния для виджета календаря обновлений
  const [renewalCalendar, setRenewalCalendar] = useState(null);
  const [renewalCalendarForm, setRenewalCalendarForm] = useState({
    enabled: false,
    domain_renewal_date: '',
    hosting_renewal_date: '',
    ssl_renewal_date: '',
    ssl_auto_renewal: false,
  });

  // Состояния для виджета рекомендаций
  const [recommendations, setRecommendations] = useState(null);
  const [recommendationsForm, setRecommendationsForm] = useState({
    enabled: false,
  });
  const [newRecommendation, setNewRecommendation] = useState({
    title: '',
    description: '',
    cost: '',
  });

  // Состояния для виджета доступности сайта
  const [siteAvailability, setSiteAvailability] = useState(null);
  const [siteAvailabilityForm, setSiteAvailabilityForm] = useState({
    enabled: false,
    site_url: '',
  });

  // Состояния для кастомных обновлений в календаре
  const [newCustomUpdate, setNewCustomUpdate] = useState({
    title: '',
    date: '',
  });
  const [isAddingCustomUpdate, setIsAddingCustomUpdate] = useState(false);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchData = async () => {
    try {
      const [clientRes, adRes, renewalRes, recRes, siteRes] = await Promise.all([
        api.get(`/clients/${id}`),
        api.get(`/widgets/ad-campaign/${id}`).catch(() => ({ data: null })),
        api.get(`/widgets/renewal-calendar/${id}`).catch(() => ({ data: null })),
        api.get(`/widgets/recommendations/${id}`).catch(() => ({ data: null })),
        api.get(`/widgets/site-availability/${id}`).catch(() => ({ data: null })),
      ]);

      setClient(clientRes.data);
      setRenewalCalendar(renewalRes.data);
      setRecommendations(recRes.data);
      setSiteAvailability(siteRes.data);

      if (adRes.data) {
        setAdCampaignForm({
          enabled: adRes.data.enabled,
          monthly_budget: adRes.data.monthly_budget || '',
          recommended_budget: adRes.data.recommended_budget || '',
          status: adRes.data.status || 'active',
        });
      }

      if (renewalRes.data) {
        setRenewalCalendarForm({
          enabled: renewalRes.data.enabled,
          domain_renewal_date: renewalRes.data.domain_renewal_date || '',
          hosting_renewal_date: renewalRes.data.hosting_renewal_date || '',
          ssl_renewal_date: renewalRes.data.ssl_renewal_date || '',
          ssl_auto_renewal: renewalRes.data.ssl_auto_renewal,
        });
      }

      if (recRes.data) {
        setRecommendationsForm({
          enabled: recRes.data.enabled,
        });
      }

      if (siteRes.data) {
        setSiteAvailabilityForm({
          enabled: siteRes.data.enabled,
          site_url: siteRes.data.site_url || '',
        });
      }
    } catch (error) {
      console.error('Ошибка при загрузке данных:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAdCampaign = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/widgets/ad-campaign/${id}`, {
        ...adCampaignForm,
        monthly_budget: parseFloat(adCampaignForm.monthly_budget),
        recommended_budget: adCampaignForm.recommended_budget ? parseFloat(adCampaignForm.recommended_budget) : null,
      });
      alert('Виджет рекламных кампаний сохранен');
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при сохранении');
    }
  };

  const handleSaveRenewalCalendar = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/widgets/renewal-calendar/${id}`, renewalCalendarForm);
      alert('Виджет календаря обновлений сохранен');
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при сохранении');
    }
  };

  const handleSaveRecommendations = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/widgets/recommendations/${id}`, recommendationsForm);
      alert('Виджет рекомендаций сохранен');
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при сохранении');
    }
  };

  const handleAddRecommendation = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/widgets/recommendations/${id}/add`, {
        title: newRecommendation.title,
        description: newRecommendation.description || null,
        cost: newRecommendation.cost ? parseFloat(newRecommendation.cost) : null,
      });
      alert('Рекомендация добавлена');
      setNewRecommendation({ title: '', description: '', cost: '' });
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при добавлении рекомендации');
    }
  };

  const handleDeleteRecommendation = async (recId) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту рекомендацию?')) return;

    try {
      await api.delete(`/widgets/recommendations/${recId}`);
      alert('Рекомендация удалена');
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при удалении');
    }
  };

  const handleSaveSiteAvailability = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/widgets/site-availability/${id}`, siteAvailabilityForm);
      alert('Виджет доступности сайта сохранен');
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при сохранении');
    }
  };

  const handleAddCustomUpdate = async (e) => {
    e.preventDefault();
    if (!newCustomUpdate.title || !newCustomUpdate.date) {
      alert('Необходимо заполнить все поля');
      return;
    }

    try {
      setIsAddingCustomUpdate(true);
      await api.post(`/widgets/renewal-calendar/${id}/custom-update`, {
        title: newCustomUpdate.title,
        date: newCustomUpdate.date,
      });
      alert('Кастомное обновление добавлено');
      setNewCustomUpdate({ title: '', date: '' });
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при добавлении кастомного обновления');
    } finally {
      setIsAddingCustomUpdate(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/admin/clients/${id}`)}
          className="text-primary-600 hover:text-primary-700 flex items-center"
        >
          ← Назад
        </button>
        <h1 className="text-2xl font-bold text-gray-800">
          Управление виджетами: {client?.project_name}
        </h1>
      </div>

      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b">
          <nav className="flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('ad-campaign')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'ad-campaign'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Рекламные кампании
            </button>
            <button
              onClick={() => setActiveTab('renewal-calendar')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'renewal-calendar'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Календарь обновлений
            </button>
            <button
              onClick={() => setActiveTab('recommendations')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'recommendations'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Рекомендации
            </button>
            <button
              onClick={() => setActiveTab('site-availability')}
              className={`px-6 py-3 font-medium whitespace-nowrap ${
                activeTab === 'site-availability'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Доступность сайта
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Виджет рекламных кампаний */}
          {activeTab === 'ad-campaign' && (
            <form onSubmit={handleSaveAdCampaign} className="max-w-2xl space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={adCampaignForm.enabled}
                    onChange={(e) => setAdCampaignForm({ ...adCampaignForm, enabled: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="font-medium text-gray-700">Включить виджет</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Текущий месячный бюджет (₽) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={adCampaignForm.monthly_budget}
                  onChange={(e) => setAdCampaignForm({ ...adCampaignForm, monthly_budget: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Рекомендованный бюджет (₽) (опционально)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={adCampaignForm.recommended_budget}
                  onChange={(e) => setAdCampaignForm({ ...adCampaignForm, recommended_budget: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Статус кампании <span className="text-red-500">*</span>
                </label>
                <select
                  value={adCampaignForm.status}
                  onChange={(e) => setAdCampaignForm({ ...adCampaignForm, status: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="active">Активна</option>
                  <option value="paused">На паузе</option>
                  <option value="stopped">Остановлена</option>
                </select>
              </div>

              <button
                type="submit"
                className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 font-medium"
              >
                Сохранить
              </button>
            </form>
          )}

          {/* Виджет календаря обновлений */}
          {activeTab === 'renewal-calendar' && (
            <div className="max-w-2xl space-y-6">
              <form onSubmit={handleSaveRenewalCalendar} className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={renewalCalendarForm.enabled}
                      onChange={(e) => setRenewalCalendarForm({ ...renewalCalendarForm, enabled: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="font-medium text-gray-700">Включить виджет</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Дата продления домена
                  </label>
                  <input
                    type="date"
                    value={renewalCalendarForm.domain_renewal_date}
                    onChange={(e) => setRenewalCalendarForm({ ...renewalCalendarForm, domain_renewal_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Дата продления хостинга
                  </label>
                  <input
                    type="date"
                    value={renewalCalendarForm.hosting_renewal_date}
                    onChange={(e) => setRenewalCalendarForm({ ...renewalCalendarForm, hosting_renewal_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Продление SSL
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={renewalCalendarForm.ssl_auto_renewal}
                        onChange={(e) => setRenewalCalendarForm({ ...renewalCalendarForm, ssl_auto_renewal: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">Обновляется автоматически</span>
                    </label>
                  </div>

                  {!renewalCalendarForm.ssl_auto_renewal && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Дата продления SSL (если не автоматическое)
                      </label>
                      <input
                        type="date"
                        value={renewalCalendarForm.ssl_renewal_date}
                        onChange={(e) => setRenewalCalendarForm({ ...renewalCalendarForm, ssl_renewal_date: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 font-medium"
                >
                  Сохранить
                </button>
              </form>

              {renewalCalendarForm.enabled && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Кастомные обновления</h3>
                  
                  <form onSubmit={handleAddCustomUpdate} className="space-y-4 bg-gray-50 p-4 rounded-lg mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Название обновления <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newCustomUpdate.title}
                        onChange={(e) => setNewCustomUpdate({ ...newCustomUpdate, title: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Например: Обновить CMS, Подключить новый сервис"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Дата <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={newCustomUpdate.date}
                        onChange={(e) => setNewCustomUpdate({ ...newCustomUpdate, date: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isAddingCustomUpdate}
                      className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-medium disabled:opacity-60"
                    >
                      {isAddingCustomUpdate ? 'Добавление...' : 'Добавить обновление'}
                    </button>
                  </form>

                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3">Текущие кастомные обновления</h4>
                    {renewalCalendar?.custom_updates && renewalCalendar.custom_updates.length > 0 ? (
                      <div className="space-y-2">
                        {renewalCalendar.custom_updates.map((update) => {
                          const date = new Date(update.date);
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const targetDate = new Date(update.date);
                          targetDate.setHours(0, 0, 0, 0);
                          const daysUntil = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
                          
                          let statusColor = 'text-gray-600 bg-gray-50';
                          let statusText = `${daysUntil} дн.`;
                          
                          if (daysUntil < 0) {
                            statusColor = 'text-red-700 bg-red-50 font-semibold';
                            statusText = 'Просрочено';
                          } else if (daysUntil < 60) {
                            statusColor = 'text-yellow-700 bg-yellow-50 font-semibold';
                          }

                          return (
                            <div key={update.id} className="bg-gray-50 p-3 rounded border border-gray-200 flex justify-between items-center">
                              <div>
                                <p className="font-medium text-gray-800">{update.title}</p>
                                <p className="text-sm text-gray-600 mt-1">{formatDate(update.date, { year: 'numeric', month: '2-digit', day: '2-digit' })}</p>
                              </div>
                              <span className={`text-sm px-3 py-1 rounded ${statusColor}`}>
                                {statusText}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">Кастомных обновлений нет</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Виджет рекомендаций */}
          {activeTab === 'recommendations' && (
            <div className="space-y-6 max-w-2xl">
              <form onSubmit={handleSaveRecommendations} className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={recommendationsForm.enabled}
                      onChange={(e) => setRecommendationsForm({ ...recommendationsForm, enabled: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="font-medium text-gray-700">Включить виджет</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 font-medium"
                >
                  Сохранить
                </button>
              </form>

              {recommendationsForm.enabled && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Добавить рекомендацию</h3>
                  <form onSubmit={handleAddRecommendation} className="space-y-4 bg-gray-50 p-4 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Тема <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newRecommendation.title}
                        onChange={(e) => setNewRecommendation({ ...newRecommendation, title: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Например: Обновить базы данных"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Описание
                      </label>
                      <textarea
                        value={newRecommendation.description}
                        onChange={(e) => setNewRecommendation({ ...newRecommendation, description: e.target.value })}
                        rows="3"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                        placeholder="Подробное описание рекомендации"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Стоимость работы (₽)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newRecommendation.cost}
                        onChange={(e) => setNewRecommendation({ ...newRecommendation, cost: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <button
                      type="submit"
                      className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-medium"
                    >
                      Добавить рекомендацию
                    </button>
                  </form>

                  <div className="mt-6">
                    <h4 className="font-semibold text-gray-800 mb-3">Текущие рекомендации</h4>
                    {recommendations?.recommendations && recommendations.recommendations.length > 0 ? (
                      <div className="space-y-2">
                        {recommendations.recommendations.map((rec) => (
                          <div key={rec.id} className="bg-gray-50 p-3 rounded border border-gray-200 flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-800">{rec.title}</p>
                              {rec.description && (
                                <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                              )}
                              {rec.cost && (
                                <p className="text-sm font-medium text-primary-600 mt-1">{rec.cost.toLocaleString('ru-RU')} ₽</p>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteRecommendation(rec.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Удалить
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">Рекомендаций нет</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Виджет доступности сайта */}
          {activeTab === 'site-availability' && (
            <form onSubmit={handleSaveSiteAvailability} className="max-w-2xl space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={siteAvailabilityForm.enabled}
                    onChange={(e) => setSiteAvailabilityForm({ ...siteAvailabilityForm, enabled: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="font-medium text-gray-700">Включить виджет</span>
                </label>
              </div>

              {siteAvailabilityForm.enabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL сайта <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    value={siteAvailabilityForm.site_url}
                    onChange={(e) => setSiteAvailabilityForm({ ...siteAvailabilityForm, site_url: e.target.value })}
                    required={siteAvailabilityForm.enabled}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="https://example.com"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Скриншоты будут снимаются автоматически каждый день в 04:00
                  </p>
                </div>
              )}

              {siteAvailability?.last_check_time && (
                <div className="bg-gray-50 p-4 rounded border border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">Последняя проверка:</p>
                  <p className="text-sm text-gray-600">
                    {formatDate(siteAvailability.last_check_time)}
                  </p>
                  <p className="text-sm font-medium mt-2">Статус: {siteAvailability.last_check_status === 'success' ? '✓ Успех' : '✗ Ошибка'}</p>
                  <p className="text-sm text-gray-600 mt-1">{siteAvailability.last_check_message}</p>
                </div>
              )}

              <button
                type="submit"
                className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 font-medium"
              >
                Сохранить
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientWidgetsManager;
