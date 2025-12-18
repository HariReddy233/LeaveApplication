// SSE Service - Manages Server-Sent Events connections for real-time updates

class SSEService {
  constructor() {
    this.clients = new Map(); // Map of userId -> Set of response objects
  }

  /**
   * Add a new SSE client connection
   * @param {string} userId - User ID
   * @param {object} res - Express response object
   */
  addClient(userId, res) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId).add(res);

    // Remove client when connection closes
    res.on('close', () => {
      this.removeClient(userId, res);
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Real-time updates enabled' })}\n\n`);
  }

  /**
   * Remove a client connection
   * @param {string} userId - User ID
   * @param {object} res - Express response object
   */
  removeClient(userId, res) {
    if (this.clients.has(userId)) {
      this.clients.get(userId).delete(res);
      if (this.clients.get(userId).size === 0) {
        this.clients.delete(userId);
      }
    }
  }

  /**
   * Send event to specific user
   * @param {string} userId - User ID
   * @param {object} event - Event data
   */
  sendToUser(userId, event) {
    if (this.clients.has(userId)) {
      const userClients = this.clients.get(userId);
      const message = `data: ${JSON.stringify(event)}\n\n`;
      
      userClients.forEach((res) => {
        try {
          res.write(message);
        } catch (error) {
          console.error('Error sending SSE to client:', error);
          this.removeClient(userId, res);
        }
      });
    }
  }

  /**
   * Send event to all users with specific role
   * @param {string} role - User role (admin, hod, employee)
   * @param {object} event - Event data
   */
  async sendToRole(role, event) {
    // This would require a database query to get all users with the role
    // For now, we'll broadcast to all connected clients
    // In production, you'd want to track user roles in the clients map
    this.clients.forEach((userClients, userId) => {
      userClients.forEach((res) => {
        try {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        } catch (error) {
          console.error('Error sending SSE to client:', error);
          this.removeClient(userId, res);
        }
      });
    });
  }

  /**
   * Broadcast event to all connected clients
   * @param {object} event - Event data
   */
  broadcast(event) {
    const message = `data: ${JSON.stringify(event)}\n\n`;
    this.clients.forEach((userClients) => {
      userClients.forEach((res) => {
        try {
          res.write(message);
        } catch (error) {
          console.error('Error broadcasting SSE:', error);
        }
      });
    });
  }

  /**
   * Get number of connected clients
   * @returns {number}
   */
  getClientCount() {
    let count = 0;
    this.clients.forEach((userClients) => {
      count += userClients.size;
    });
    return count;
  }
}

// Singleton instance
const sseService = new SSEService();

export default sseService;





