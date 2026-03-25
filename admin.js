// В admin.js
import Express from 'express';
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
// ... твои импорты моделей Sequelize ...

const app = Express();
const admin = new AdminJS({
  databases: [db], // Твоя БД
  rootPath: '/admin',
  dashboard: { component: AdminJS.bundle('./static/dashboard.jsx') },
});

const router = AdminJSExpress.buildRouter(admin);
app.use(admin.options.rootPath, router);

app.listen(3000, () => {
  console.log('💻 ADMIN: Interface online at port 3000');
});
