// 1. Сначала инициализируем SDK и проверяем его наличие
let tg; 

if (window.Telegram && window.Telegram.WebApp) {
    console.log("✅ SDK Telegram загружен!");
    tg = window.Telegram.WebApp;
    tg.ready();    // Сообщаем Telegram, что приложение готово
    tg.expand();   // Расширяем на весь экран
} else {
    console.error("❌ Скрипт Telegram не найден!");
    // Используем заглушку для разработки вне Telegram, чтобы код не "падал"
    tg = {
        initData: "",
        initDataUnsafe: { user: { id: 12345 } }, // Тестовый ID
        ready: () => {},
        expand: () => {},
        showAlert: (msg) => alert(msg)
    };
}

// 2. Универсальная функция запроса (теперь использует актуальный tg)
async function apiRequest(url, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    
    // Берем данные напрямую из объекта WebApp
    const currentInitData = tg.initData;

    // Добавляем заголовок ТОЛЬКО если данные есть
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
        
        if (res.status === 401) {
            console.error("⛔ Ошибка 401: Сервер или прокси хостинга отклонили токен.");
            return { status: "error", message: "Unauthorized" };
        }

        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await res.json();
        } else {
            return { status: "ok" }; 
        }

    } catch (e) {
        console.error("🌐 Ошибка сети или сервера:", e);
        return { status: "error", message: e.message };
    }
}
