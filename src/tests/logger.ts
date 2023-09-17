import { pino } from 'pino';

export const TestLogger = pino({
	level: 'debug',
    transport: {
        target: 'pino-pretty',
    }
});
