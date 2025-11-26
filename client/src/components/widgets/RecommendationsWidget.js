import React, { useState, useEffect } from 'react';

const RecommendationsWidget = ({ clientId, api }) => {
  const [widget, setWidget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    fetchWidget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const fetchWidget = async () => {
    try {
      const response = await api.get(`/widgets/recommendations/${clientId}`);
      setWidget(response.data);
    } catch (error) {
      console.error('Ошибка при загрузке виджета:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRecommendation = async () => {
    if (!selectedRecommendation) return;
    
    try {
      setIsAccepting(true);
      await api.post(`/widgets/recommendations/${selectedRecommendation.id}/accept`);
      alert('Рекомендация принята! Создан новый тикет.');
      setSelectedRecommendation(null);
      fetchWidget();
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка при принятии рекомендации');
    } finally {
      setIsAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    );
  }

  if (!widget || !widget.enabled) {
    return null;
  }

  const hasRecommendations = widget.recommendations && widget.recommendations.length > 0;

  return (
    <div className="rounded-lg border border-gray-200 p-4 bg-blue-50">
      <h3 className="font-semibold text-gray-800 mb-3">Рекомендации</h3>
      
      {!hasRecommendations ? (
        <div className="text-center py-6">
          <div className="text-2xl mb-2">✓</div>
          <p className="text-gray-600">Все работает штатно, новых рекомендаций нет</p>
        </div>
      ) : (
        <div>
          <div className="mb-4 p-3 bg-blue-100 border border-blue-300 rounded text-sm text-blue-800">
            У вас есть <strong>{widget.recommendations.length}</strong> {widget.recommendations.length === 1 ? 'рекомендация' : 'рекомендаций'}
          </div>
          
          <div className="space-y-2">
            {widget.recommendations.map((rec) => (
              <button
                key={rec.id}
                onClick={() => setSelectedRecommendation(rec)}
                className="w-full text-left bg-white hover:bg-gray-50 border border-gray-300 rounded p-3 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-800">{rec.title}</p>
                    {rec.cost && (
                      <p className="text-sm text-gray-600 mt-1">Стоимость: {rec.cost.toLocaleString('ru-RU')} ₽</p>
                    )}
                  </div>
                  <span className="text-primary-600 text-sm">Открыть →</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Модалка с деталями рекомендации */}
      {selectedRecommendation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-800 mb-3">
              {selectedRecommendation.title}
            </h2>

            {selectedRecommendation.description && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">Описание:</p>
                <p className="text-gray-800">{selectedRecommendation.description}</p>
              </div>
            )}

            {selectedRecommendation.cost && (
              <div className="mb-4 p-3 bg-gray-100 rounded">
                <p className="text-sm text-gray-600">Стоимость работы:</p>
                <p className="text-lg font-bold text-gray-800">
                  {selectedRecommendation.cost.toLocaleString('ru-RU')} ₽
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleAcceptRecommendation}
                disabled={isAccepting}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium"
              >
                {isAccepting ? 'Принимаю...' : 'Принять'}
              </button>
              <button
                onClick={() => setSelectedRecommendation(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecommendationsWidget;
