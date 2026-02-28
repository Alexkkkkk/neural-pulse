async function openStats() {
    openModal('stats');
    // Добавляем ?user_id=... в конец ссылки
    try {
        const response = await fetch(`/api/leaderboard?user_id=${userId}`);
        const data = await response.json();
        renderLeaderboard(data.top10);
        if (data.user_rank) {
            document.getElementById('my-rank').textContent = data.user_rank;
        }
    } catch (e) {
        console.error("Rank error", e);
    }
}
