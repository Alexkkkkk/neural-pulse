bot.start(async (ctx) => {
    logger.info(`[CORE] Нажата кнопка СТАРТ пользователем: ${ctx.from.id}`);
    try {
        await ctx.reply(`Привет, ${ctx.from.first_name}! Система Neural Pulse активна.`, 
            Markup.inlineKeyboard([
                [Markup.button.webApp("⚡ ВХОД В ТЕРМИНАЛ", DOMAIN)]
            ])
        );
        logger.info(`[CORE] Ответ отправлен успешно`);
    } catch (err) {
        logger.error(`[CORE] Ошибка при отправке ответа:`, err);
    }
});
