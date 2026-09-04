import adminHandler from './_routes/admin.js';
import auditHandler from './_routes/audit.js';
import authHandler from './_routes/auth.js';
import credentialsHandler from './_routes/credentials.js';
import dispensationsHandler from './_routes/dispensations.js';
import patientsHandler from './_routes/patients.js';
import prescriptionsHandler from './_routes/prescriptions.js';
import providersHandler from './_routes/providers.js';
import verifyHandler from './_routes/verify.js';
import { getPath, corsHeaders } from './_lib/utils.js';

const ROUTE_HANDLERS = {
  admin: adminHandler,
  audit: auditHandler,
  auth: authHandler,
  credentials: credentialsHandler,
  dispensations: dispensationsHandler,
  patients: patientsHandler,
  prescriptions: prescriptionsHandler,
  providers: providersHandler,
  verify: verifyHandler,
};

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Ensure helper methods status(), json(), send() exist on res
  if (!res.status) {
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
  }
  if (!res.json) {
    res.json = (data) => {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json');
      }
      res.end(JSON.stringify(data));
      return res;
    };
  }
  if (!res.send) {
    res.send = (data) => {
      res.end(data);
      return res;
    };
  }

  // Ensure body is parsed if runtime hasn't parsed it
  if (req.body === undefined && req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    try {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const rawBody = Buffer.concat(chunks).toString('utf-8');
      if (rawBody) {
        try {
          req.body = JSON.parse(rawBody);
        } catch {
          req.body = rawBody;
        }
      }
    } catch {
      // Body stream read error fallback
    }
  }

  const path = getPath(req);
  const parts = path.split('/').filter(Boolean);
  // Expected path format: /api/<section>/...
  const section = parts[0] === 'api' ? parts[1] : parts[0];

  const targetHandler = ROUTE_HANDLERS[section];
  if (targetHandler) {
    return targetHandler(req, res);
  }

  return res.status(404).json({ error: `API route not found: ${path}` });
}
