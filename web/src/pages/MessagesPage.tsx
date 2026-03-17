import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/api.client';
import socketService from '../services/socket.service';
import './MessagesPage.css';

interface Conversation {
  id: string;
  full_name: string;
  company_name?: string;
  designation?: string;
  profile_picture_url?: string;
  last_message?: string;
  last_message_image?: string;
  last_message_time?: string;
  unread_count: number;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id?: string;
  content: string;
  created_at: string;
}

const MessagesPage: React.FC = () => {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(conversationId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const onResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    fetchConversations();
    socketService.on('message:new', handleNewMessage);

    return () => {
      socketService.off('message:new', handleNewMessage);
    };
  }, [selectedConversation]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation);
      socketService.joinRoom(`conversation:${selectedConversation}`);

      return () => {
        socketService.leaveRoom(`conversation:${selectedConversation}`);
      };
    }
  }, [selectedConversation]);

  const fetchConversations = async () => {
    try {
      const response = await apiClient.getConversations();
      
      if (response.error) {
        console.error('Failed to fetch conversations:', response.error);
        return;
      }

      let conversationsList: any[] = [];
      if (response.data) {
        // Try to extract conversations from multiple possible shapes
        if (Array.isArray(response.data)) {
          conversationsList = response.data;
        } else if (typeof response.data === 'object') {
          const data = response.data as any;
          if (Array.isArray(data.data)) {
            conversationsList = data.data;
          } else if (Array.isArray(data.conversations)) {
            conversationsList = data.conversations;
          }
        }
      }
      
      setConversations(conversationsList || []);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (userId: string) => {
    try {
      const response = await apiClient.getMessages(userId);
      
      if (response.error) {
        console.error('Failed to fetch messages:', response.error);
        return;
      }

      let messagesList: any[] = [];
      if (response.data) {
        // Try to extract messages from multiple possible shapes
        if (Array.isArray(response.data)) {
          messagesList = response.data;
        } else if (typeof response.data === 'object') {
          const data = response.data as any;
          if (Array.isArray(data.data)) {
            messagesList = data.data;
          } else if (Array.isArray(data.messages)) {
            messagesList = data.messages;
          }
        }
      }
      
      setMessages(messagesList || []);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const handleNewMessage = (message: Message) => {
    const isForSelectedConversation =
      !!selectedConversation &&
      (message.sender_id === selectedConversation || message.receiver_id === selectedConversation);

    if (isForSelectedConversation) {
      setMessages((prev) => [...prev, message]);
    }

    fetchConversations();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage || !selectedConversation || !user?.id) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      sender_id: user.id,
      receiver_id: selectedConversation,
      content: trimmedMessage,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage('');

    try {
      const response = await apiClient.sendMessage(selectedConversation, trimmedMessage);

      if (response.error) {
        setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
        alert(response.error);
        return;
      }

      if (response.data?.message) {
        setMessages((prev) => prev.map((msg) => (msg.id === tempId ? response.data.message : msg)));
      } else {
        // Fallback to server state when shape differs.
        await fetchMessages(selectedConversation);
      }

      fetchConversations();
    } catch (error) {
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    }
  };

  return (
    <div className="messages-page">
      <div className={`messages-sidebar ${isMobileView && selectedConversation ? 'messages-sidebar-hidden' : ''}`}>
        <h2>Messages</h2>
        <div className="conversations-list">
          {loading ? (
            <div className="loading-conversations">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="empty-conversations">No conversations yet</div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`conversation-item ${selectedConversation === conv.id ? 'active' : ''}`}
                onClick={() => setSelectedConversation(conv.id)}
              >
                <div className="conversation-avatar">
                  {conv.profile_picture_url ? (
                    <img src={apiClient.getPublicFileUrl(conv.profile_picture_url)} alt={conv.full_name} />
                  ) : (
                    <div className="avatar-placeholder">
                      {conv.full_name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="conversation-info">
                  <div className="conversation-name">{conv.full_name}</div>
                  {conv.company_name && (
                    <div className="conversation-company">{conv.company_name}</div>
                  )}
                  {conv.last_message && (
                    <div className="conversation-last-message">{conv.last_message}</div>
                  )}
                </div>
                {conv.unread_count > 0 && (
                  <div className="conversation-unread">{conv.unread_count}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className={`messages-main ${isMobileView && !selectedConversation ? 'messages-main-hidden' : ''}`}>
        {selectedConversation ? (
          <>
            <div className="messages-header">
              {isMobileView && (
                <button
                  type="button"
                  className="messages-back-button"
                  onClick={() => setSelectedConversation(null)}
                >
                  Back
                </button>
              )}
              <h3>
                {conversations.find((c) => c.id === selectedConversation)?.full_name || 'Conversation'}
              </h3>
            </div>

            <div className="messages-list">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`message ${msg.sender_id === user?.id ? 'message-sent' : 'message-received'}`}
                >
                  <div className="message-content">{msg.content}</div>
                  <div className="message-time">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendMessage} className="message-input-form">
              <input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="message-input"
              />
              <button type="submit" className="send-button" disabled={!newMessage.trim()}>
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="no-conversation-selected">
            <p>Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesPage;
