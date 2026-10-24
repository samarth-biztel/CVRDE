import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

// npm workspace scripts run from backend/, while local configuration stays at the repository root.
config({path:fileURLToPath(new URL('../../.env',import.meta.url))});
