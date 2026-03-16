import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/api.client';
import socketService from '../services/socket.service';
import './FeedPage.css';

interface Post {
  id: string;
  author_id: string;
  author_name: string;
  author_company?: string;
  author_title?: string;
  author_picture?: string;
  content: string;
  image_url?: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  created_at: string;
}

interface Comment {
  id: string;
  content: string;
  author_name: string;
  author_title?: string;
  created_at: string;
}

const FeedPage: React.FC = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [comments, setComments] = useState<{ [postId: string]: Comment[] }>({});
  const [commentText, setCommentText] = useState('');
  const [composerMode, setComposerMode] = useState<'story' | 'opportunity' | 'milestone'>('story');
  const [spotlightPost, setSpotlightPost] = useState<Post | null>(null);

  const composerModes = [
    {
      id: 'story' as const,
      title: 'Story',
      hint: 'Share updates, ideas, or reflections with alumni',
      placeholder: 'Share a useful lesson, update, or thought with your alumni network...',
      leadTag: '#story',
    },
    {
      id: 'opportunity' as const,
      title: 'Opportunity',
      hint: 'Post roles, collaborations, or internships',
      placeholder: 'Highlight an opening, project, or collaboration opportunity...',
      leadTag: '#opportunity',
    },
    {
      id: 'milestone' as const,
      title: 'Milestone',
      hint: 'Celebrate achievements and key progress moments',
      placeholder: 'Share a milestone, achievement, or important win...',
      leadTag: '#milestone',
    },
  ];

  const quickTags = ['#hiring', '#mentorship', '#alumni', '#project', '#askbatu'];

  const activeMode = composerModes.find((mode) => mode.id === composerMode) || composerModes[0];

  useEffect(() => {
    fetchPosts();
    socketService.joinRoom('feed');
    socketService.on('feed:new-post', handleNewPost);
    socketService.on('feed:post-updated', handlePostUpdated);

    return () => {
      socketService.leaveRoom('feed');
      socketService.off('feed:new-post', handleNewPost);
      socketService.off('feed:post-updated', handlePostUpdated);
    };
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await apiClient.getPosts();
      if (response.data) {
        setPosts(response.data.posts || response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewPost = (post: Post) => {
    setPosts((prev) => [post, ...prev]);
  };

  const handlePostUpdated = (updatedPost: Post) => {
    setPosts((prev) =>
      prev.map((post) => (post.id === updatedPost.id ? updatedPost : post))
    );
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim()) return;

    setIsPosting(true);
    try {
      let imageUrl = undefined;
      
      if (selectedFile) {
        const uploadResponse = await apiClient.uploadFile(selectedFile, 'post');
        if (uploadResponse.data?.url) {
          imageUrl = uploadResponse.data.url;
        }
      }

      const response = await apiClient.createPost(newPostContent, imageUrl);
      if (response.data) {
        setNewPostContent('');
        setSelectedFile(null);
        setImagePreview(null);
        fetchPosts();
      }
    } catch (error) {
      console.error('Failed to create post:', error);
      alert('Failed to create post');
    } finally {
      setIsPosting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyTag = (tag: string) => {
    const normalized = newPostContent.trim();
    if (!normalized) {
      setNewPostContent(`${activeMode.leadTag} ${tag} `);
      return;
    }

    if (!normalized.includes(tag)) {
      setNewPostContent(`${newPostContent} ${tag}`.trimStart() + ' ');
    }
  };

  const extractTags = (content: string) => {
    const tags = content.match(/#[a-zA-Z0-9_]+/g) || [];
    return tags.slice(0, 3);
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    try {
      if (isLiked) {
        await apiClient.unlikePost(postId);
      } else {
        await apiClient.likePost(postId);
      }
      
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                is_liked: !isLiked,
                likes_count: isLiked ? post.likes_count - 1 : post.likes_count + 1,
              }
            : post
        )
      );
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  };

  const handleToggleComments = async (postId: string) => {
    if (expandedComments === postId) {
      setExpandedComments(null);
    } else {
      setExpandedComments(postId);
      if (!comments[postId]) {
        try {
          const response = await apiClient.getPostComments(postId);
          if (response.data) {
            setComments({ ...comments, [postId]: response.data.comments || response.data });
          }
        } catch (error) {
          console.error('Failed to fetch comments:', error);
        }
      }
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!commentText.trim()) return;

    try {
      const response = await apiClient.addComment(postId, commentText);
      if (response.data) {
        const createdComment = response.data.comment || response.data;
        setComments({
          ...comments,
          [postId]: [...(comments[postId] || []), createdComment],
        });
        setCommentText('');
        
        setPosts((prev) =>
          prev.map((post) =>
            post.id === postId
              ? { ...post, comments_count: post.comments_count + 1 }
              : post
          )
        );
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      await apiClient.deletePost(postId);
      setPosts((prev) => prev.filter((post) => post.id !== postId));
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('Failed to delete post');
    }
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="feed-page">
      <div className="feed-hero">
        <div>
          <h1 className="page-title">Alumni Feed</h1>
          <p className="feed-subtitle">Build visibility through stories, opportunities, and milestones.</p>
        </div>
        <div className="feed-hero-stat">
          <span className="feed-hero-stat-label">Live posts</span>
          <strong>{posts.length}</strong>
        </div>
      </div>

      {/* Create Post */}
      <div className="create-post-card">
        <div className="composer-headline">Spotlight Composer</div>
        <p className="composer-description">Select a lane, add context tags, and publish a high-signal update.</p>

        <div className="composer-modes">
          {composerModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`composer-mode ${composerMode === mode.id ? 'active' : ''}`}
              onClick={() => {
                setComposerMode(mode.id);
                if (!newPostContent.trim()) {
                  setNewPostContent(`${mode.leadTag} `);
                }
              }}
            >
              <span className="composer-mode-title">{mode.title}</span>
              <span className="composer-mode-hint">{mode.hint}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleCreatePost}>
          <div className="composer-context-row">
            <div className="composer-context-pill">Mode: {activeMode.title}</div>
            <div className={`composer-char-count ${newPostContent.length > 250 ? 'active' : ''}`}>
              {newPostContent.length} chars
            </div>
          </div>

          <textarea
            className="create-post-textarea"
            placeholder={activeMode.placeholder}
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            rows={3}
            disabled={isPosting}
          />

          <div className="composer-tags">
            {quickTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="composer-tag"
                onClick={() => handleApplyTag(tag)}
                disabled={isPosting}
              >
                {tag}
              </button>
            ))}
          </div>
          
          {imagePreview && (
            <div className="image-preview">
              <img src={imagePreview} alt="Preview" />
              <button
                type="button"
                className="remove-image"
                onClick={() => {
                  setSelectedFile(null);
                  setImagePreview(null);
                }}
              >
                ✕
              </button>
            </div>
          )}

          <div className="create-post-actions">
            <label className="upload-button">
              Add Photo
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </label>
            <button
              type="submit"
              className="button button-primary"
              disabled={isPosting || !newPostContent.trim()}
            >
              {isPosting ? 'Publishing...' : 'Publish Post'}
            </button>
          </div>
        </form>
      </div>

      {/* Posts List */}
      <div className="posts-list">
        {posts.length === 0 ? (
          <div className="empty-state">
            <p>No posts yet. Be the first to share something!</p>
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="post-card">
              <div className="post-header">
                <div className="post-author">
                  <div className="post-avatar">
                    {post.author_picture ? (
                      <img src={post.author_picture} alt={post.author_name} />
                    ) : (
                      <div className="avatar-placeholder">
                        {post.author_name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="post-author-info">
                    <div className="post-author-name">{post.author_name}</div>
                    {post.author_title && (
                      <div className="post-author-title">
                        {post.author_title}
                        {post.author_company && ` at ${post.author_company}`}
                      </div>
                    )}
                    <div className="post-time">
                      {new Date(post.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                {post.author_id === user?.id && (
                  <button
                    className="delete-post-button"
                    onClick={() => handleDeletePost(post.id)}
                  >
                    🗑️
                  </button>
                )}
              </div>

              <div className="post-meta-row">
                <div className="post-meta-pill">Alumni Spotlight</div>
                <div className="post-tags">
                  {extractTags(post.content).map((tag) => (
                    <span key={`${post.id}-${tag}`} className="post-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="post-content">{post.content}</div>

              {post.image_url && (
                <div
                  className="post-image"
                  onClick={() => setSpotlightPost(post)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setSpotlightPost(post);
                    }
                  }}
                >
                  <img src={post.image_url} alt="Post" />
                </div>
              )}

              <div className="post-stats">
                <span>{post.likes_count} likes</span>
                <span>{post.comments_count} comments</span>
              </div>

              <div className="post-actions">
                <button
                  className={`post-action-button ${post.is_liked ? 'liked' : ''}`}
                  onClick={() => handleLike(post.id, post.is_liked)}
                >
                  {post.is_liked ? '❤️' : '🤍'} Like
                </button>
                <button
                  className="post-action-button"
                  onClick={() => handleToggleComments(post.id)}
                >
                  💬 Comment
                </button>
                <button
                  className="post-action-button spotlight-button"
                  onClick={() => setSpotlightPost(post)}
                >
                  ✨ View
                </button>
              </div>

              {expandedComments === post.id && (
                <div className="comments-section">
                  <div className="add-comment">
                    <input
                      type="text"
                      placeholder="Write a comment..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddComment(post.id);
                        }
                      }}
                    />
                    <button onClick={() => handleAddComment(post.id)}>Send</button>
                  </div>

                  <div className="comments-list">
                    {comments[post.id]?.map((comment) => (
                      <div key={comment.id} className="comment">
                        <div className="comment-author">{comment.author_name}</div>
                        <div className="comment-content">{comment.content}</div>
                        <div className="comment-time">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {spotlightPost && (
        <div className="spotlight-overlay" onClick={() => setSpotlightPost(null)}>
          <div className="spotlight-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="spotlight-close"
              type="button"
              onClick={() => setSpotlightPost(null)}
            >
              ✕
            </button>

            <div className="spotlight-header">
              <div className="spotlight-title-wrap">
                <div className="spotlight-kicker">Spotlight View</div>
                <h3>{spotlightPost.author_name}</h3>
                <p>{new Date(spotlightPost.created_at).toLocaleString()}</p>
              </div>
              <div className="spotlight-stats">
                <span>{spotlightPost.likes_count} likes</span>
                <span>{spotlightPost.comments_count} comments</span>
              </div>
            </div>

            <div className="spotlight-content">{spotlightPost.content}</div>

            {spotlightPost.image_url && (
              <div className="spotlight-image-wrap">
                <img src={spotlightPost.image_url} alt="Spotlight post" className="spotlight-image" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedPage;
