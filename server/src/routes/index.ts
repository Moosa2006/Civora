import { Router } from 'express';
import healthRouter from './health.routes.js';
import metaRouter from './meta.routes.js';
import authRouter from './auth.routes.js';
import complaintsRouter from './complaints.routes.js';
import adminComplaintsRouter from './adminComplaints.routes.js';
import adminRouter from './admin.routes.js';
import officialRouter from './official.routes.js';
import transparencyRouter from './transparency.routes.js';
import projectsRouter from './projects.routes.js';
import notificationsRouter from './notifications.routes.js';
import engagementRouter from './engagement.routes.js';
import slaRouter from './sla.routes.js';
import evidenceRouter from './evidence.routes.js';
import geoRouter from './geo.routes.js';
import moderationRouter from './moderation.routes.js';
import accessibilityRouter from './accessibility.routes.js';
import tendersRouter from './tenders.routes.js';
import contractorRouter from './contractor.routes.js';

const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/meta', metaRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/complaints', complaintsRouter);
apiRouter.use('/admin/complaints', adminComplaintsRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/official', officialRouter);
apiRouter.use('/transparency', transparencyRouter);
apiRouter.use('/projects', projectsRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/engagement', engagementRouter);
apiRouter.use('/sla', slaRouter);
apiRouter.use('/evidence', evidenceRouter);
apiRouter.use('/geo', geoRouter);
apiRouter.use('/moderation', moderationRouter);
apiRouter.use('/accessibility', accessibilityRouter);
apiRouter.use('/tenders', tendersRouter);
apiRouter.use('/contractor', contractorRouter);

export default apiRouter;

