//Internal Lib Import
import sseService from '../../services/SSE/SSEService.js';
import { CreateError } from '../../helper/ErrorHandler.js';

/**
 * SSE Connection Endpoint
 * Establishes Server-Sent Events connection for real-time updates
 * Note: EventSource doesn't support custom headers, so we use query parameter for token
 */
export const SSEConnection = async (req, res) => {
  try {
    // Get token from query parameter (EventSource doesn't support custom headers)
    const token = req.query.token;
    
    if (!token) {
      throw CreateError("Token required", 401);
    }

    // Verify token and get user
    const DecodedToken = (await import('../../utility/DecodedToken.js')).default;
    const decoded = await DecodedToken(token);
    
    const userId = decoded.id?.toString();
    
    if (!userId) {
      throw CreateError("User ID required", 401);
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx

    // Add client to SSE service
    sseService.addClient(userId, res);

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch (error) {
        clearInterval(heartbeatInterval);
        sseService.removeClient(userId, res);
      }
    }, 30000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      sseService.removeClient(userId, res);
    });

  } catch (error) {
    console.error('SSE connection error:', error);
    if (!res.headersSent) {
      res.status(error.status || 500).json({
        message: error.message || 'SSE connection failed'
      });
    }
  }
};

export default {
  SSEConnection
};

