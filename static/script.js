// Функция запроса с "умной" авторизацией
async function apiRequest(url, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    
    // Берем данные напрямую из объекта WebApp в момент вызова
    const currentInitData = window.Telegram.WebApp.initData;

    // Добавляем заголовок ТОЛЬКО если данные есть, чтобы не отправлять "Bearer undefined"
    if (currentInitData && currentInitData.trim() !== "") {
        headers['Authorization'] = `Bearer ${currentInitData}`;
    }

    const options = { 
        method: method, 
        headers: headers 
    };

    if (body) options.body = JSON.stringify(body);
    
    try {
        const res = await fetch(url, options);
        
        // Обработка 401 ошибки (Unauthorized)
        if (res.status === 401) {
            console.error("⛔ Ошибка 401: Сервер или прокси хостинга отклонили токен.");
            // Можно вывести уведомление пользователю, если это критично
            return { status: "error", message: "Unauthorized" };
        }

        // Проверка, что ответ вообще является JSON
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await res.json();
        } else {
            return { status: "ok" }; // Если сервер вернул пустой успех
        }

    } catch (e) {
        console.error("🌐 Ошибка сети или сервера:", e);
        return { status: "error", message: e.message };
    }
}
