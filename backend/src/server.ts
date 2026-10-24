import './env.js';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import { api } from './routes.js';
import { HttpError } from './core.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: process.env.APP_ORIGIN || (process.env.VERCEL ? false : 'http://localhost:5173'), credentials: true }));
app.use(express.json({limit:'1mb'}));
app.use(cookieParser());
app.get('/health',(_req,res)=>res.json({ok:true}));
app.use('/api/v1',api);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof HttpError) return res.status(error.status).json({error:error.message});
  if (error instanceof multer.MulterError) return res.status(error.code==='LIMIT_FILE_SIZE'?413:400).json({error:error.code==='LIMIT_FILE_SIZE'?'File exceeds 20 MB':'Invalid upload'});
  if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') return res.status(400).json({error:'Invalid input',details:error});
  console.error(error instanceof Error ? error.message : 'Unexpected error');
  return res.status(500).json({error:'Internal server error'});
});
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) app.listen(Number(process.env.PORT || 3001),()=>console.log(`API listening on ${process.env.PORT || 3001}`));
